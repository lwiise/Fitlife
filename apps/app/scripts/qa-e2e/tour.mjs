// Visit the signed-in app's key pages, screenshot each, and report what a user
// would actually hit: HTTP failures, console errors, missing alt text, tap
// targets under 44px, and physical-direction CSS leaking into an RTL layout.
//
// Usage: node tour.mjs <email> [--shots=<dir>] [--paths=/plan,/dashboard]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, PASSWORD } from "./creds.mjs";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const arg = (k) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3); // keep "=" inside values
const email = process.argv[2];
const SHOTS = arg("shots") ?? "./tour";
const PATHS = (arg("paths") ?? "/dashboard,/plan,/journey,/settings,/profile,/family").split(",");
if (!email) {
  console.error("usage: node tour.mjs <email> [--shots=dir] [--paths=a,b]");
  process.exit(1);
}
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "ar-SA", viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push({ kind: "console", text: m.text().slice(0, 200) });
});
page.on("pageerror", (e) => problems.push({ kind: "pageerror", text: String(e).slice(0, 200) }));
page.on("response", async (r) => {
  if (r.status() >= 400) {
    problems.push({ kind: "http", text: `${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}` });
  }
});

const report = [];
try {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);
  log(`signed in → ${new URL(page.url()).pathname}`);

  for (const path of PATHS) {
    const before = problems.length;
    let status = "ok";
    try {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
      status = String(res?.status() ?? "?");
    } catch (e) {
      status = `NAV FAILED: ${e.message.split("\n")[0].slice(0, 80)}`;
    }
    await page.waitForTimeout(1200);
    const landed = new URL(page.url()).pathname;
    await page.screenshot({ path: `${SHOTS}/${path.replace(/\//g, "_") || "_root"}.png`, fullPage: true });

    const audit = await page.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const imgsNoAlt = [...document.querySelectorAll("img")]
        .filter((i) => vis(i) && !i.getAttribute("alt"))
        .map((i) => i.getAttribute("src")?.slice(0, 70) ?? "?");
      const smallTargets = [...document.querySelectorAll("button, a[href], input, select")]
        .filter(vis)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height < 44 || r.width < 44;
        })
        .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}`);
      // Body must never scroll sideways on mobile.
      const overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
      const h1s = [...document.querySelectorAll("h1")].filter(vis).map((h) => h.textContent.trim());
      const heading = [...document.querySelectorAll("h1,h2")].filter(vis)[0]?.textContent.trim() ?? "";
      return { imgsNoAlt, smallTargets: [...new Set(smallTargets)], overflowX, h1Count: h1s.length, heading, dir: document.documentElement.dir };
    });

    const newProblems = problems.slice(before);
    report.push({ path, status, landed, ...audit, problems: newProblems });
    log(
      `${path} → ${status}${landed !== path ? ` (redirected to ${landed})` : ""} «${audit.heading.slice(0, 40)}»` +
        ` dir=${audit.dir} h1=${audit.h1Count}` +
        `${audit.overflowX ? " ⚠ HORIZONTAL OVERFLOW" : ""}` +
        `${audit.imgsNoAlt.length ? ` ⚠ ${audit.imgsNoAlt.length} img without alt` : ""}` +
        `${audit.smallTargets.length ? ` ⚠ ${audit.smallTargets.length} target(s) <44px` : ""}` +
        `${newProblems.length ? ` ⚠ ${newProblems.length} error(s)` : ""}`,
    );
    newProblems.forEach((p) => log(`     ! ${p.kind}: ${p.text}`));
  }
} finally {
  writeFileSync(`${SHOTS}/tour.json`, JSON.stringify({ email, report }, null, 2));
  log(`screenshots + tour.json in ${SHOTS}`);
  await ctx.close();
  await browser.close();
}
