// Cross-account data isolation. RLS is the control under test: signed in as A,
// every read of B's rows must come back empty and every write must be refused.
//
// Also checks the app layer — /journey takes ?member=<uuid>, so a raw id swap is
// the obvious way to try to read someone else's record through the UI.
//
// Usage: node isolation.mjs <emailA> <emailB>
import { chromium } from "playwright-core";
import { BASE, PASSWORD, signInAs } from "./creds.mjs";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const [emailA, emailB] = process.argv.slice(2);
if (!emailA || !emailB) {
  console.error("usage: node isolation.mjs <emailA> <emailB>");
  process.exit(1);
}
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const pass = (ok, msg) => log(`${ok ? "PASS" : "**FAIL**"} — ${msg}`);

const A = await signInAs(emailA);
const B = await signInAs(emailB);
log(`A=${A.userId} (${emailA})`);
log(`B=${B.userId} (${emailB})`);

// B's real row ids, fetched as B, to target as A.
const bPlan = (await B.sb.from("meal_plans").select("id").eq("user_id", B.userId).limit(1)).data?.[0];
const bMember = (await B.sb.from("family_members").select("id").eq("user_id", B.userId).limit(1)).data?.[0];
log(`B plan=${bPlan?.id ?? "none"} member=${bMember?.id ?? "none"}`);

// ── reads as A, targeting B ──
for (const table of ["profiles", "meal_plans", "plan_generations", "family_members", "meal_checkins", "body_logs", "workout_plans"]) {
  const col = table === "profiles" ? "id" : "user_id";
  const { data, error } = await A.sb.from(table).select("*").eq(col, B.userId);
  if (error) { log(`  ${table}: query error (${error.message.slice(0, 60)})`); continue; }
  pass((data ?? []).length === 0, `A reading ${table} of B → ${data?.length ?? 0} rows`);
}

// Direct fetch by primary key (not by user_id) — the sharper test, since a
// missing RLS policy often still allows a by-id lookup.
if (bPlan) {
  const { data } = await A.sb.from("meal_plans").select("*").eq("id", bPlan.id);
  pass((data ?? []).length === 0, `A fetching B's meal_plan BY ID → ${data?.length ?? 0} rows`);
}

// ── writes as A, targeting B ──
if (bPlan) {
  const { error } = await A.sb.from("meal_plans").update({ status: "failed" }).eq("id", bPlan.id);
  const { data: after } = await B.sb.from("meal_plans").select("status").eq("id", bPlan.id).single();
  pass(after?.status !== "failed", `A updating B's plan → B's status still "${after?.status}"${error ? ` (err: ${error.message.slice(0, 40)})` : " (no error raised)"}`);
}
{
  const { error } = await A.sb.from("family_members").insert({ user_id: B.userId, name: "INTRUDER", role: "dad", preferred_language: "ar" });
  const { data: after } = await B.sb.from("family_members").select("name").eq("user_id", B.userId);
  const injected = (after ?? []).some((m) => m.name === "INTRUDER");
  pass(!injected, `A inserting a member into B's family → ${injected ? "INJECTED" : "refused"}${error ? ` (${error.message.slice(0, 50)})` : ""}`);
}

// ── app layer: ?member= swap and the export endpoint ──
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "ar-SA", viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
try {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emailA);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);

  if (bMember) {
    const res = await page.goto(`${BASE}/journey?member=${bMember.id}`, { waitUntil: "domcontentloaded" });
    const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
    pass(!body.includes("خالد"), `A opening /journey?member=<B's member id> → HTTP ${res?.status()}, no B data rendered`);
  }

  const exp = await page.request.get(`${BASE}/api/account/export`);
  const text = await exp.text();
  pass(!text.includes(B.userId), `A's /api/account/export does not contain B's user id (HTTP ${exp.status()}, ${text.length}b)`);
} finally {
  await ctx.close();
  await browser.close();
}
