// Drive the POST-onboarding /family add flow: pick a household, walk the member
// wizard, and capture the tier-cap interstitial.
//
// This is where the starter trial's max_people = 1 actually bites — the member
// is SAVED first and the upgrade card appears after, so the copy and the state
// it leaves behind are both worth capturing.
//
// Usage: node family-add.mjs <email> [--shots=<dir>]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { BASE, PASSWORD, signInAs } from "./creds.mjs";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const email = process.argv[2];
const SHOTS = arg("shots") ?? "./family-add";
if (!email) {
  console.error("usage: node family-add.mjs <email> [--shots=dir]");
  process.exit(1);
}
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
mkdirSync(SHOTS, { recursive: true });

const { sb, userId } = await signInAs(email);
const members = async () =>
  (await sb.from("family_members").select("name,role,member_type,preferred_language").eq("user_id", userId)).data ?? [];

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "ar-SA", viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(String(e).slice(0, 160)));
page.on("response", async (r) => {
  if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url().slice(0, 110)}`);
});

// The member wizard uses ABBREVIATED ids (m-name, m-by, m-h, m-w), so match on
// patterns rather than full column names. Getting this wrong is silent: a
// birth year of "3" fails validation and the member is simply never saved.
const FIELD_RULES = [
  [/name/i, "خالد"],
  [/(^|-)by$|birth|year/i, "1985"],
  [/(^|-)h$|height/i, "175"],
  [/(^|-)w$|weight/i, "82"],
  [/tw|target/i, "78"],
  [/waist/i, "92"],
  [/hip/i, "100"],
];

async function fill(page) {
  const acted = [];
  const seen = [];
  const inputs = page.locator("input:visible, textarea:visible");
  for (let i = 0; i < (await inputs.count()); i++) {
    const el = inputs.nth(i);
    const id = (await el.getAttribute("id")) ?? "";
    const type = await el.getAttribute("type");
    if (type === "checkbox" || type === "radio") continue;
    seen.push(id || `(${type})`);
    if ((await el.inputValue().catch(() => "")) !== "") continue;
    const rule = FIELD_RULES.find(([re]) => re.test(id));
    if (rule) {
      await el.fill(rule[1]);
      acted.push(`${id}=${rule[1]}`);
    } else if (type === "number") {
      // Unrecognised numeric — leave it alone rather than inventing a value
      // that silently fails validation downstream.
      acted.push(`${id || "num"}=SKIPPED(unmapped)`);
    }
  }
  if (seen.length) acted.push(`[inputs: ${seen.join(",")}]`);
  return acted;
}
async function choose(page) {
  return page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const opts = [...document.querySelectorAll("button[aria-pressed], button[aria-checked]")].filter(vis);
    const groups = new Map();
    for (const b of opts) { const k = b.parentElement; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b); }
    const acted = [];
    for (const [, bs] of groups) {
      if (bs.some((b) => b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true")) continue;
      bs[0].click();
      acted.push(bs[0].textContent.trim().slice(0, 24));
    }
    return acted;
  });
}
// «أنشئي الخطة» is the member wizard's TERMINAL button (step 10/10, after the
// doctor checkbox) — it must be listed or the wizard dead-ends with the member
// filled in but never saved.
const ADVANCE = [/أنشئي الخطة|أنشئ الخطة/, /حفظ|إضافة|أضيفي/, /التالي/, /جاهزة/, /^متابعة$/, /^تم$/];
async function advance(page) {
  const btns = page.locator("button:visible");
  const cands = [];
  for (let i = 0; i < (await btns.count()); i++) {
    const b = btns.nth(i);
    if (await b.isEnabled()) cands.push({ b, t: (await b.textContent())?.trim().replace(/\s+/g, " ") ?? "" });
  }
  for (const p of ADVANCE) {
    const hit = cands.find((c) => p.test(c.t));
    if (hit) { await hit.b.click(); return hit.t; }
  }
  return null;
}

try {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);
  log(`before: ${JSON.stringify(await members())}`);

  await page.goto(`${BASE}/family`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/01-family.png`, fullPage: true });
  log(`/family buttons: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("button,a")].filter(b => b.getBoundingClientRect().height > 0).map(b => b.textContent.trim().replace(/\s+/g, " ")).filter(t => t && t.length < 40).slice(0, 18)))}`);

  // The builder is already on /family and its CTA starts DISABLED
  // («اختاري فرداً للإضافة») — a member type has to be picked before the button
  // becomes clickable, so selection comes first.
  const spouse = page.locator("button:visible").filter({ hasText: /^(زوج|زوجة)$/ }).first();
  if (await spouse.count()) {
    await spouse.click();
    log("selected زوج");
    await page.waitForTimeout(800);
  } else {
    log("no spouse toggle found — falling back to the first member toggle");
    const anyToggle = page.locator("button[aria-pressed]:visible").first();
    if (await anyToggle.count()) await anyToggle.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `${SHOTS}/02-builder.png`, fullPage: true });

  const addBtn = page
    .locator("button:visible, a:visible")
    .filter({ hasText: /إضافة فرد|أضيفي فرد|اختاري فرداً|إضافة/ })
    .first();
  if ((await addBtn.count()) && (await addBtn.isEnabled())) {
    await addBtn.click();
    await page.waitForTimeout(1500);
  } else {
    log("add CTA still disabled after selection — continuing into whatever rendered");
  }

  for (let i = 1; i <= 14; i++) {
    await page.waitForTimeout(700);
    const state = await page.evaluate(() => ({
      h: [...document.querySelectorAll("h1,h2")].filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent.trim())[0] ?? "",
      body: document.body.innerText.slice(0, 260).replace(/\n+/g, " | "),
      url: location.pathname,
    }));
    // The tier-cap interstitial is the thing we came for.
    if (/باقة أكبر|ترقي|تحتاجين باقة/.test(state.body)) {
      log(`TIER CAP HIT at step ${i}: ${JSON.stringify(state.body.slice(0, 220))}`);
      await page.screenshot({ path: `${SHOTS}/03-tier-cap.png`, fullPage: true });
      break;
    }
    const f = await fill(page);
    const c = await choose(page);
    // The doctor-consent step is a checkbox with no option buttons, so without
    // this the wizard dead-ends with "NO BTN" and the member is never saved.
    const t = await page.evaluate(() => {
      const acted = [];
      for (const cb of document.querySelectorAll('input[type="checkbox"]')) {
        const r = cb.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && !cb.checked) {
          cb.click();
          acted.push(cb.closest("label")?.textContent.trim().slice(0, 30) ?? "checkbox");
        }
      }
      return acted;
    });
    const a = await advance(page);
    log(
      `${i}. ${state.url} «${state.h.slice(0, 40)}» → ${a ?? "NO BTN"}` +
        `${f.length ? ` | ${f.join(",")}` : ""}${c.length ? ` | ${c.join("/")}` : ""}` +
        `${t.length ? ` | ticked: ${t.join("/")}` : ""}`,
    );
    if (!a && !f.length && !c.length && !t.length) break;
  }
  await page.screenshot({ path: `${SHOTS}/04-final.png`, fullPage: true });
  log(`after: ${JSON.stringify(await members())}`);
  if (problems.length) problems.slice(0, 6).forEach((p) => log(`  ! ${p}`));
} finally {
  log(`screenshots in ${SHOTS}`);
  await ctx.close();
  await browser.close();
}
