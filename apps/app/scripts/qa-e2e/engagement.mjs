// Exercise the /plan engagement loop the way a user does: expand a meal, tap a
// check-in chip, then confirm the row actually reached the database.
//
// Worth testing explicitly because the engagement tables arrived in migrations
// 00017-00022, which CLAUDE.md records as NOT YET APPLIED to production. The
// write paths are written to fail soft, so a tap that persists nothing looks
// identical to a tap that worked — only the DB can tell them apart.
//
// Usage: node engagement.mjs <email> [--shots=<dir>]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { BASE, PASSWORD, signInAs } from "./creds.mjs";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const email = process.argv[2];
const SHOTS = arg("shots") ?? "./engagement";
if (!email) {
  console.error("usage: node engagement.mjs <email> [--shots=dir]");
  process.exit(1);
}
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
mkdirSync(SHOTS, { recursive: true });

const { sb, userId } = await signInAs(email);

/** Count rows, tolerating a table that prod has not had the migration applied for. */
async function countRows(table) {
  const { data, error } = await sb.from(table).select("*").eq("user_id", userId);
  if (error) return { error: error.message };
  return { rows: data ?? [] };
}

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "ar-SA", viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
page.on("response", async (r) => {
  if (r.status() >= 400) pageErrors.push(`HTTP ${r.status()} ${r.url().slice(0, 110)}`);
});

try {
  for (const t of ["meal_checkins", "meal_verdicts", "workout_checkins", "meal_absences", "body_logs"]) {
    const r = await countRows(t);
    log(`${t.padEnd(16)} ${r.error ? `UNAVAILABLE — ${r.error}` : `${r.rows.length} row(s)`}`);
  }

  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);
  await page.goto(`${BASE}/plan`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Expand the first meal card so its tracking controls render.
  const firstMeal = page.locator("button").filter({ hasText: /سعرة|الفطور/ }).first();
  if (await firstMeal.count()) {
    await firstMeal.click().catch(() => null);
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${SHOTS}/01-meal-expanded.png`, fullPage: true });

  // The check-in vocabulary from engagement/types.ts.
  const chip = page.getByRole("button", { name: /طبختها كما هي/ }).first();
  const chipCount = await chip.count();
  log(`«طبختها كما هي» chip present: ${chipCount > 0}`);
  if (chipCount === 0) {
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => b.getBoundingClientRect().height > 0)
        .map((b) => b.textContent.trim().replace(/\s+/g, " "))
        .filter((t) => t && t.length < 40)
        .slice(0, 40),
    );
    log(`visible buttons: ${JSON.stringify(visible)}`);
  } else {
    const before = await countRows("meal_checkins");
    await chip.click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SHOTS}/02-after-checkin.png`, fullPage: true });
    const after = await countRows("meal_checkins");
    if (after.error) {
      log(`TAP PERSISTED NOTHING — meal_checkins unavailable: ${after.error}`);
    } else {
      const b = before.rows?.length ?? 0;
      log(`meal_checkins ${b} → ${after.rows.length} row(s) ${after.rows.length > b ? "✓ PERSISTED" : "✗ NOT PERSISTED"}`);
      after.rows.forEach((r) =>
        log(`   row: day=${r.day_index} slot=${r.slot} status=${r.status} member=${r.member_id ?? "—"} date=${r.local_date}`),
      );
    }

    // Verdict control appears only once the meal is marked cooked.
    const verdict = page.getByRole("button", { name: /نحبّها|نحبها/ }).first();
    log(`verdict «نحبّها» present after check-in: ${(await verdict.count()) > 0}`);
    if (await verdict.count()) {
      await verdict.click();
      await page.waitForTimeout(3000);
      const v = await countRows("meal_verdicts");
      log(v.error ? `verdict write unavailable: ${v.error}` : `meal_verdicts: ${v.rows.length} row(s) ✓`);
      await page.screenshot({ path: `${SHOTS}/03-after-verdict.png`, fullPage: true });
    }
  }
  if (pageErrors.length) pageErrors.slice(0, 6).forEach((e) => log(`  ! ${e}`));
} finally {
  log(`screenshots in ${SHOTS}`);
  await ctx.close();
  await browser.close();
}
