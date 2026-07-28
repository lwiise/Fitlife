// Run a household of size N on an account that ALREADY holds a paid subscription,
// by resizing its household and regenerating.
//
// Why this shape: a subscription cannot be minted (the Lemonsqueezy API has
// createCheckout/createCustomer/createDiscount but NO createSubscription — they
// only come from a completed checkout, and checkout is captcha-guarded against
// automation). So instead of one paid account per household size, ONE paid account
// is re-shaped between runs. It tests multi-member GENERATION — which has never
// been exercised — rather than signup-then-pay, which has.
//
// The member rows are NOT invented. On first use the account's existing members are
// snapshotted, and a size-N run re-inserts the first N-1 of them. Every row is
// therefore one the app's own wizard wrote, so a generation failure cannot be
// blamed on hand-made data.
//
//   node paid-household.mjs <email> <beneficiaries 2..6> [--watch-min=20]

import { readFileSync, writeFileSync, existsSync } from "node:fs";

import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

import { BASE, PASSWORD, discoverSupabaseCreds } from "./creds.mjs";

const email = process.argv[2];
const SIZE = Number(process.argv[3]);
const WATCH_MIN = Number(
  process.argv.find((a) => a.startsWith("--watch-min="))?.slice(12) ?? 20,
);
if (!email || !Number.isFinite(SIZE) || SIZE < 2 || SIZE > 6) {
  console.error("usage: node paid-household.mjs <email> <beneficiaries 2..6>");
  process.exit(1);
}

const SNAP = `household-snapshot-${email.replace(/[^a-z0-9]/gi, "_")}.json`;
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const creds = await discoverSupabaseCreds();
const sb = createClient(creds.url, creds.anon);
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
if (authErr) throw new Error(`sign-in failed: ${authErr.message}`);
const userId = auth.user.id;

// Refuse on a non-paid account — otherwise the run silently degrades to a
// starter-capped mom-only plan and "6 members generated" would be a lie.
const { data: subs } = await sb
  .from("subscriptions")
  .select("tier,status")
  .eq("user_id", userId);
const paid = (subs ?? []).find((s) => ["active", "trialing"].includes(s.status) && s.tier !== "starter");
if (!paid) throw new Error(`no paid subscription on ${email} — got ${JSON.stringify(subs)}`);
log(`subscription: ${paid.tier}/${paid.status}`);

// ── Snapshot the app-authored members once, then resize from it ──────────────
const COLS = "name,role,member_type,birth_year,height_cm,weight_kg,activity_level,primary_goal,preferred_language,display_order,sex";
if (!existsSync(SNAP)) {
  const { data: cur } = await sb.from("family_members").select(COLS).eq("user_id", userId).order("display_order");
  if (!cur?.length) throw new Error("no members to snapshot — run a household persona on this account first");
  writeFileSync(SNAP, JSON.stringify(cur, null, 2));
  log(`snapshotted ${cur.length} app-authored members → ${SNAP}`);
}
const snapshot = JSON.parse(readFileSync(SNAP, "utf8"));
const want = SIZE - 1; // beneficiaries include the owner, who lives in `profiles`
if (want > snapshot.length) throw new Error(`snapshot holds ${snapshot.length} members; size ${SIZE} needs ${want}`);

const { error: delErr } = await sb.from("family_members").delete().eq("user_id", userId);
if (delErr) throw new Error(`clearing members failed: ${delErr.message}`);
const rows = snapshot.slice(0, want).map((m, i) => ({ ...m, user_id: userId, display_order: i }));
const { error: insErr } = await sb.from("family_members").insert(rows);
if (insErr) throw new Error(`inserting members failed: ${insErr.message}`);
log(`household set to ${SIZE} beneficiaries (mom + ${want}): ${rows.map((r) => `${r.name}/${r.member_type}`).join(", ")}`);

// ── Trigger a real generation through the app's own endpoint ─────────────────
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ locale: "ar-SA" });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("fitlife_cookie_consent", "declined");
  } catch {
    /* private mode */
  }
});
const page = await ctx.newPage();
await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
await page.fill("#email", email);
await page.fill("#password", PASSWORD);
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
]);

const res = await page.evaluate(async () => {
  const r = await fetch("/api/plans/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ issues: "", improvements: "" }),
  });
  return { status: r.status, body: (await r.text()).slice(0, 300) };
});
log(`POST /api/plans/generate → ${res.status} ${res.body}`);
await browser.close();
if (res.status !== 200) {
  // 409 = the 00014 per-kind lock still held by a previous run, including one
  // Netlify killed (its row stays 'started' until a later dispatch reclassifies
  // it after STALE_GENERATION_MIN).
  throw new Error(`generation not dispatched (${res.status})`);
}

// ── Watch to terminal ───────────────────────────────────────────────────────
const t0 = Date.now();
let last = "";
for (let i = 0; i < (WATCH_MIN * 60) / 20; i++) {
  const { data: g } = await sb
    .from("plan_generations")
    .select("status,duration_ms,cost_usd,error_message,started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1);
  const { data: p } = await sb
    .from("meal_plans")
    .select("plan_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const pd = p?.[0]?.plan_data;
  const line = (pd?.members ?? [])
    .map((m) => `${m.member_name_ar ?? m.member_id}:${(m.days ?? []).filter((d) => (d.meals ?? []).length > 0).length}`)
    .join(" ");
  const el = Math.round((Date.now() - t0) / 1000);
  if (line !== last) {
    console.log(`+${el}s  ${line}`);
    last = line;
  }
  const row = g?.[0];
  if (row && (row.status === "completed" || row.status === "failed")) {
    console.log(
      `TERMINAL ${row.status} after ${Math.round((row.duration_ms ?? 0) / 1000)}s | $${row.cost_usd ?? "?"}` +
        (row.error_message ? ` | ${row.error_message}` : ""),
    );
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 20_000));
}
// The state Netlify's hard kill leaves behind: no catch, no terminal write.
console.log(`STILL 'started' after ${WATCH_MIN}m — consistent with the worker being killed at its 15-minute budget`);
process.exit(3);
