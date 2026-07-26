// Full-matrix runner: drives N personas through the REAL wizard, then waits for
// their generations to settle and reports the truth about each one.
//
// Three phases, because they have different failure modes:
//   1. JOURNEY  — signup + onboarding + trigger, via journey.mjs (concurrency-limited)
//   2. SETTLE   — poll plan_generations until terminal; `ready` is NOT the finish
//                 line (plan_data.generating flips false before the second-chance
//                 retry wave and before the final token/cost write)
//   3. VERIFY   — per-account checks: day completeness, calorie floor, members stored
//
// The email ledger is written the moment an account is created, BEFORE anything
// can fail, so a crash never orphans a real production account. Cleanup reads it.
//
//   node run-matrix.mjs --only=solo-loss,fam-2 [--concurrency=3] [--settle-min=25]

import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { PERSONAS } from "./personas.mjs";
import { discoverSupabaseCreds, PASSWORD } from "./creds.mjs";

const arg = (k) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};
const ONLY = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const CONCURRENCY = Number(arg("concurrency") ?? 3);
const SETTLE_MIN = Number(arg("settle-min") ?? 25);
const LEDGER = "matrix-accounts.json";
const RESULTS = "matrix-results.json";

const selected = ONLY ? PERSONAS.filter((p) => ONLY.includes(p.key)) : PERSONAS;
if (selected.length === 0) throw new Error(`no personas matched --only=${ONLY}`);

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`[${stamp()}] ${m}`);

function emailFor(key) {
  return `fitlife.qa+${key}-${Math.random().toString(36).slice(2, 9)}@gmail.com`;
}

// ─── Ledger — written before any work, so cleanup can always find accounts ──
function loadLedger() {
  if (!existsSync(LEDGER)) return {};
  try {
    return JSON.parse(readFileSync(LEDGER, "utf8"));
  } catch {
    return {};
  }
}
function recordAccount(key, email) {
  const led = loadLedger();
  led[key] = { email, password: PASSWORD, created_at: new Date().toISOString() };
  writeFileSync(LEDGER, JSON.stringify(led, null, 2));
}

// ─── Phase 1 — journeys ─────────────────────────────────────────────────────
function runJourney(persona, email) {
  return new Promise((resolve) => {
    const shots = `shots/${persona.key}`;
    mkdirSync(shots, { recursive: true });
    const child = spawn(
      process.execPath,
      ["journey.mjs", `--persona=${persona.key}`, `--email=${email}`, `--shots=${shots}`],
      { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    // Generous: the wizard is 10-11 adaptive steps against production.
    const killer = setTimeout(() => child.kill("SIGKILL"), 12 * 60_000);
    child.on("close", (code) => {
      clearTimeout(killer);
      writeFileSync(`${shots}/runner.log`, out);
      resolve({ code, out });
    });
  });
}

async function pool(items, n, fn) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return results;
}

// ─── Phase 2/3 — read the account's own rows under its JWT ──────────────────
async function inspect(creds, email) {
  const sb = createClient(creds.url, creds.anon);
  const { data: auth, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) return { signIn: `FAILED: ${error.message}` };
  const userId = auth.user.id;

  const { data: gens } = await sb
    .from("plan_generations")
    .select("status,error_message,tokens_in,tokens_out,cost_usd,duration_ms,started_at,completed_at,plan_kind")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  const { data: plans } = await sb
    .from("meal_plans")
    .select("id,status,plan_data,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: members } = await sb
    .from("family_members")
    .select("name,role,member_type,birth_year,preferred_language")
    .eq("user_id", userId);

  return { userId, gens: gens ?? [], plan: plans?.[0] ?? null, members: members ?? [] };
}

const isTerminal = (g) => g.status === "completed" || g.status === "failed";

async function settle(creds, accounts) {
  const deadline = Date.now() + SETTLE_MIN * 60_000;
  const pending = new Map(accounts.map((a) => [a.key, a]));
  const done = new Map();

  while (pending.size > 0 && Date.now() < deadline) {
    for (const [key, acct] of [...pending]) {
      const snap = await inspect(creds, acct.email).catch((e) => ({ signIn: `ERR ${e.message}` }));
      if (snap.signIn) {
        // Rejection personas never create a usable account — that's a PASS there.
        done.set(key, { ...acct, ...snap });
        pending.delete(key);
        continue;
      }
      const meal = snap.gens.find((g) => (g.plan_kind ?? "meal") === "meal");
      if (meal && isTerminal(meal)) {
        done.set(key, { ...acct, ...snap });
        pending.delete(key);
        log(`settled ${key}: ${meal.status} (${Math.round((meal.duration_ms ?? 0) / 1000)}s, $${meal.cost_usd ?? "?"})`);
      }
    }
    if (pending.size === 0) break;
    log(`waiting on ${pending.size}: ${[...pending.keys()].join(", ")}`);
    await new Promise((r) => setTimeout(r, 30_000));
  }

  for (const [key, acct] of pending) {
    const snap = await inspect(creds, acct.email).catch(() => ({}));
    done.set(key, { ...acct, ...snap, timedOut: true });
    log(`TIMED OUT (still running after ${SETTLE_MIN}m): ${key}`);
  }
  return done;
}

// ─── Verification ───────────────────────────────────────────────────────────
// Mirrors packages/plan-engine/src/calorieFloor.ts — the P0 fix's first
// production exercise.
function floorFor(m) {
  const age = m.age ?? null;
  if (m.is_child === true || (age != null && age < 18)) return 1600;
  return m.sex === "male" ? 1500 : 1200;
}

function verify(persona, snap) {
  const notes = [];
  if (persona.expectRejection) {
    const blocked = !!snap.signIn || !snap.plan;
    notes.push(blocked ? "PASS — no plan produced (refused as intended)" : "FAIL — a plan was produced for a minor");
    return { verdict: blocked ? "PASS" : "FAIL", notes };
  }
  if (snap.signIn) return { verdict: "FAIL", notes: [`could not sign in: ${snap.signIn}`] };

  const meal = (snap.gens ?? []).find((g) => (g.plan_kind ?? "meal") === "meal");
  if (!meal) notes.push("no plan_generations row");
  else {
    notes.push(`generation: ${meal.status}${meal.error_message ? ` — ${meal.error_message}` : ""}`);
    if (meal.status !== "completed") notes.push("NOT completed");
  }

  const pd = snap.plan?.plan_data;
  if (!pd) notes.push("no plan_data");
  else {
    for (const m of pd.members ?? []) {
      const filled = (m.days ?? []).filter((d) => (d.meals ?? []).length > 0).length;
      if (filled < (pd.days_total ?? 7)) {
        notes.push(`${m.member_name_ar ?? m.member_id}: ${filled}/${pd.days_total ?? 7} days — EMPTY DAY`);
      }
      const kcal = m.daily_calories ?? m.targets?.calories ?? null;
      if (kcal != null) {
        const floor = floorFor(m);
        if (kcal < floor) notes.push(`CALORIE FLOOR BREACH: ${m.member_name_ar ?? m.member_id} ${kcal} < ${floor}`);
      }
    }
  }

  // Household storage — the part that works without a paid subscription.
  if (persona.household) {
    const want = (persona.beneficiaries ?? 1) - 1; // minus mom
    const hk = (snap.members ?? []).filter((m) => m.role === "housekeeper" || m.member_type === "housekeeper").length;
    const benef = (snap.members ?? []).length - hk;
    notes.push(`members stored: ${snap.members.length} (${benef} beneficiaries + ${hk} housekeeper), expected ${want} + housekeeper`);
    if (benef !== want) notes.push(`MEMBER COUNT MISMATCH: got ${benef}, expected ${want}`);
  }

  const bad = notes.some((n) => /FAIL|BREACH|MISMATCH|EMPTY DAY|NOT completed|no plan/.test(n));
  return { verdict: bad ? "FAIL" : "PASS", notes };
}

// ─── Main ───────────────────────────────────────────────────────────────────
const creds = await discoverSupabaseCreds();
log(`personas: ${selected.map((p) => p.key).join(", ")}`);
log(`concurrency ${CONCURRENCY}, settle window ${SETTLE_MIN}m`);

const accounts = selected.map((p) => {
  const email = emailFor(p.key);
  recordAccount(p.key, email); // ledger FIRST
  return { key: p.key, persona: p, email };
});

log(`── phase 1: journeys ──`);
await pool(accounts, CONCURRENCY, async (a) => {
  const t = Date.now();
  const { code } = await runJourney(a.persona, a.email);
  log(`journey ${a.key}: exit ${code} in ${Math.round((Date.now() - t) / 1000)}s`);
  a.journeyExit = code;
});

log(`── phase 2: settle ──`);
const settled = await settle(creds, accounts);

log(`── phase 3: verify ──`);
let spend = 0;
const report = [];
for (const a of accounts) {
  const snap = settled.get(a.key) ?? {};
  for (const g of snap.gens ?? []) spend += Number(g.cost_usd ?? 0);
  const v = verify(a.persona, snap);
  report.push({
    key: a.key,
    label: a.persona.label,
    email: a.email,
    expect: a.persona.expect,
    verdict: v.verdict,
    notes: v.notes,
    gens: (snap.gens ?? []).map((g) => ({
      kind: g.plan_kind ?? "meal",
      status: g.status,
      seconds: Math.round((g.duration_ms ?? 0) / 1000),
      cost_usd: g.cost_usd,
      error: g.error_message,
    })),
    members: snap.members ?? [],
  });
  console.log(`\n${v.verdict === "PASS" ? "✓" : "✗"} ${a.key} — ${a.persona.label}`);
  v.notes.forEach((n) => console.log(`    ${n}`));
}

writeFileSync(RESULTS, JSON.stringify({ ranAt: new Date().toISOString(), totalCostUsd: spend, report }, null, 2));
log(`\nMEASURED SPEND: $${spend.toFixed(4)} across ${report.length} accounts`);
log(`pass ${report.filter((r) => r.verdict === "PASS").length} / fail ${report.filter((r) => r.verdict === "FAIL").length}`);
log(`results → ${RESULTS}, accounts → ${LEDGER}`);
