// Exercise the workout viewer the way a user does: switch to the التمارين tab,
// open an exercise (which lazy-fetches its Lottie form animation), mark a
// session done, and rate its intensity — checking each write reached the DB.
//
// The intensity chips are 00022 and the action retries without the column when
// prod predates it, so a rating that silently vanishes looks like a working tap.
//
// Usage: node workout-ui.mjs <email> [--shots=<dir>]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { BASE, PASSWORD, signInAs } from "./creds.mjs";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const email = process.argv[2];
const SHOTS = arg("shots") ?? "./workout-ui";
if (!email) {
  console.error("usage: node workout-ui.mjs <email> [--shots=dir]");
  process.exit(1);
}
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
mkdirSync(SHOTS, { recursive: true });

const { sb, userId } = await signInAs(email);
const checkins = async () =>
  (await sb.from("workout_checkins").select("*").eq("user_id", userId)).data ?? [];

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "ar-SA", viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const lottieRequests = [];
const errors = [];
page.on("request", (r) => {
  if (/\/lottie\/exercises\//.test(r.url())) lottieRequests.push(r.url().split("/").pop());
});
page.on("response", async (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 110)}`);
});
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

try {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);
  await page.goto(`${BASE}/plan?view=workout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/01-workout-view.png`, fullPage: true });

  const split = await page.evaluate(() => document.body.innerText.slice(0, 400));
  log(`workout view text starts: ${JSON.stringify(split.replace(/\n+/g, " | ").slice(0, 220))}`);

  // Open an exercise row → lazy-loads its Lottie.
  const exercise = page.locator("button").filter({ hasText: /سكوات|الضغط|التجديف|الطعنات|الجلوس/ }).first();
  if (await exercise.count()) {
    await exercise.click().catch(() => null);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/02-exercise-open.png`, fullPage: true });
    const canvasOrSvg = await page.evaluate(
      () => document.querySelectorAll("svg, canvas").length,
    );
    log(`lottie files requested: ${JSON.stringify(lottieRequests)} | svg/canvas nodes: ${canvasOrSvg}`);
  } else {
    log("no exercise row matched");
  }

  // Mark a session done.
  const before = (await checkins()).length;
  const done = page.getByRole("button", { name: /أنجزتها/ }).first();
  log(`«أنجزتها» present: ${(await done.count()) > 0}`);
  if (await done.count()) {
    await done.click();
    await page.waitForTimeout(3500);
    const rows = await checkins();
    log(`workout_checkins ${before} → ${rows.length} ${rows.length > before ? "✓ PERSISTED" : "✗ NOT PERSISTED"}`);
    rows.forEach((r) => log(`   row: day=${r.day_index} status=${r.status} member=${r.member_id} date=${r.local_date} intensity=${r.intensity ?? "—"}`));
    await page.screenshot({ path: `${SHOTS}/03-session-marked.png`, fullPage: true });

    // Intensity chips appear only on a done mark (00022).
    const intensity = page.getByRole("button", { name: /مناسبة|سهلة|صعبة/ }).first();
    log(`intensity chips present after «أنجزتها»: ${(await intensity.count()) > 0}`);
    if (await intensity.count()) {
      const label = (await intensity.textContent())?.trim();
      await intensity.click();
      await page.waitForTimeout(3000);
      const rows2 = await checkins();
      const rated = rows2.find((r) => r.intensity);
      log(`clicked «${label}» → intensity persisted: ${rated ? `✓ ${rated.intensity}` : "✗ still null"}`);
      await page.screenshot({ path: `${SHOTS}/04-intensity.png`, fullPage: true });
    }
  }
  if (errors.length) errors.slice(0, 6).forEach((e) => log(`  ! ${e}`));
} finally {
  log(`screenshots in ${SHOTS}`);
  await ctx.close();
  await browser.close();
}
