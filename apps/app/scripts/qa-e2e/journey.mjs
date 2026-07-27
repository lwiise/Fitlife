// Walk the REAL user journey through the deployed UI: sign up, then click
// through the actual onboarding wizard screen by screen — no PostgREST writes.
//
// run.mjs deliberately skips the wizard (it writes the questionnaire directly),
// so the adaptive Arabic flow it bypasses is exactly what this exercises.
//
// The driver is ADAPTIVE rather than a hardcoded 10-step script: at each screen
// it reads the DOM, fills what it finds, selects any option group nothing is
// chosen in, and presses the advance button. That survives prod drifting from
// the checked-out code, and it fails the way a user does — on a button that
// doesn't advance — instead of on a stale selector.
//
// Usage: node journey.mjs [--email=<addr>] [--shots=<dir>]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, PASSWORD } from "./creds.mjs";
import { getPersona } from "./personas.mjs";
import { expandHousehold, memberFieldRules } from "./memberFields.mjs";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const arg = (k) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3); // keep "=" inside values
const SHOTS = arg("shots") ?? "./shots";
// A persona supplies the whole profile — field values, the option preferences
// that steer each step, forced choices, and the plan scope. Without one the
// driver runs the original solo fat-loss profile.
const persona = arg("persona") ? getPersona(arg("persona")) : null;
const SCOPE = persona?.scope ?? arg("scope") ?? "meals";
const email =
  arg("email") ??
  persona?.email ??
  `fitlife.qa+journey-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 7)}@gmail.com`;

const MAX_SCREENS = 40;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
mkdirSync(SHOTS, { recursive: true });

// Values for inputs we recognise, by input id. Defaults mirror run.mjs's
// solo-loss profile so a persona-less run stays comparable to a harness run.
const FIELD_VALUES = {
  display_name: "نورة",
  birth_year: "1992",
  height_cm: "162",
  weight_kg: "78",
  target_weight_kg: "68",
  waist_cm: "88",
  hip_cm: "104",
  phone: "",
  ...(persona?.fields ?? {}),
};
// ORDERED: the first match in an unanswered option group wins, otherwise that
// group's first option is taken (which is the neutral answer for sex→أنثى and
// pregnancy→«لست حاملاً»).
const PREFERRED_OPTIONS = persona?.preferred ?? [/خسارة\s*الوزن|إنقاص/, /نشاط\s*خفيف|خفيف/, /نادراً/];
// Choices the escalation would NEVER make on its own: either the group is an
// optional multi-select nothing forces (medical conditions) or its default is
// the wrong branch for this persona (sex, pregnancy status). Applied on every
// attempt, before the generic pass.
const FORCED_OPTIONS = persona?.force ?? [];
// Free-text chip fields, matched on the input's placeholder.
const CHIP_ANSWERS = persona?.chips ?? [{ match: /كبدة/, chips: ["كبدة"] }];
// Members screen: toggles/steppers to apply before pressing the CTA.
const HOUSEHOLD = persona?.household ?? null;
// Flat sequence of members the wizard will ask about, in the app's own queue
// order, so each one gets an age-appropriate birth year (children get DISTINCT
// ages — that is the point of the multi-child personas).
const MEMBER_QUEUE = expandHousehold(HOUSEHOLD);
let memberPointer = -1;
let lastMemberProgress = null;
// The household is composed exactly once per run — see the call site for why a
// second pass over the picker corrupts the run.
let householdApplied = false;

const journal = [];

async function screenState(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // The step's own question is the h2. h1 is the sticky wizard chrome
    // ("ملفك الشخصي") and is identical on every screen, so keying progress off
    // it makes an advancing wizard look stuck.
    const h2 = [...document.querySelectorAll("h2")].filter(vis).map((h) => h.textContent.trim())[0];
    const h1 = [...document.querySelectorAll("h1")].filter(vis).map((h) => h.textContent.trim())[0];
    const heading = h2 ?? h1 ?? "";
    const alerts = [...document.querySelectorAll('[role="alert"]')]
      .filter(vis)
      .map((a) => a.textContent.trim())
      .filter(Boolean);
    const buttons = [...document.querySelectorAll("button")].filter(vis).map((b) => ({
      text: b.textContent.trim().replace(/\s+/g, " "),
      disabled: b.disabled,
      pressed: b.getAttribute("aria-pressed"),
      checked: b.getAttribute("aria-checked"),
    }));
    const inputs = [...document.querySelectorAll("input,textarea")].filter(vis).map((i) => ({
      id: i.id || null,
      type: i.type || i.tagName.toLowerCase(),
      placeholder: i.placeholder || null,
      ariaLabel: i.getAttribute("aria-label"),
      value: i.value,
    }));
    return { heading, alerts, buttons, inputs, progress: document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow") ?? null };
  });
}

/** Fill recognised + generic empty inputs. Returns a list of what it did. */
async function fillInputs(page, memberRules = null) {
  const acted = [];
  const inputs = page.locator("input:visible, textarea:visible");
  for (let i = 0; i < (await inputs.count()); i++) {
    const el = inputs.nth(i);
    const id = await el.getAttribute("id");
    const placeholder = (await el.getAttribute("placeholder")) ?? "";
    const current = await el.inputValue().catch(() => "");

    // Family-member wizard: its ids are abbreviated (m-name, m-by, m-h, m-w) and
    // match nothing in FIELD_VALUES, which holds the OWNER's answers. Without
    // this the generic numeric fallback below wrote "2" into the birth year and
    // never touched the name, so every household run died on «أكملي الاسم وسنة
    // الميلاد» — the app refusing junk, which read as a product bug.
    if (memberRules) {
      const type = await el.getAttribute("type");
      if (type === "checkbox" || type === "radio") continue;
      if (current) continue;
      const rule = memberRules.find(([re]) => re.test(id ?? ""));
      if (rule) {
        await el.fill(rule[1]);
        acted.push(`${id}=${rule[1]}`);
      } else if (type === "number") {
        // Never invent a number here. A wrong one passes the form and fails
        // server-side validation, where a harness gap looks like a product bug.
        acted.push(`${id ?? "num"}=SKIPPED(unmapped)`);
      }
      continue;
    }

    if (id && id in FIELD_VALUES) {
      const want = FIELD_VALUES[id];
      if (want && current !== want) {
        await el.fill(want);
        acted.push(`${id}=${want}`);
      }
      continue;
    }
    // Chip input: type each chip and press Enter.
    const chipRule = CHIP_ANSWERS.find((c) => c.match.test(placeholder));
    if (chipRule) {
      for (const chip of chipRule.chips) {
        await el.fill(chip);
        await el.press("Enter");
      }
      acted.push(`chips[${placeholder}]=${chipRule.chips.join("،")}`);
      continue;
    }
    // Anything else still empty: only fill numbers, so free-text stays untouched
    // (an unanswered optional text box is a legitimate user choice).
    if (!current && (await el.getAttribute("type")) === "number") {
      await el.fill("2");
      acted.push(`${id ?? placeholder ?? "number"}=2`);
    }
  }
  return acted;
}

/**
 * Select one option per group that has nothing selected. Groups are keyed by
 * parent element, which matches how the wizard lays out its option rows.
 */
async function chooseOptions(page) {
  return page.evaluate(
    ({ preferred }) => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const opts = [...document.querySelectorAll("button[aria-pressed], button[aria-checked]")].filter(vis);
      const groups = new Map();
      for (const b of opts) {
        const key = b.parentElement;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(b);
      }
      const acted = [];
      for (const [, buttons] of groups) {
        const isOn = (b) => b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true";
        if (buttons.some(isOn)) continue;
        let pick = null;
        for (const re of preferred.map((r) => new RegExp(r))) {
          pick = buttons.find((b) => re.test(b.textContent));
          if (pick) break;
        }
        pick ??= buttons[0];
        pick.click();
        acted.push(pick.textContent.trim().replace(/\s+/g, " ").slice(0, 40));
      }
      return acted;
    },
    { preferred: PREFERRED_OPTIONS.map((r) => r.source) },
  );
}

// Priority-ordered SUBSTRING patterns, not exact matches: real CTAs carry
// punctuation and extra words ("جاهزة – أنشئي خطتي"), which an anchored regex
// silently misses and reports as "no advance button". Skip links come last so
// they're only used when nothing else will move the screen.
const ADVANCE_PATTERNS = [
  /أنشئي خطتي|أنشئ خطتي/,
  /حفظ ومتابعة/,
  // NOT anchored. On the members screen the CTA gains a suffix once a household
  // is selected ("التالي — إضافة زوج"); an anchored /^التالي$/ misses it and the
  // click falls through to the «تخطّي» skip link, silently discarding the
  // household that was just configured.
  /التالي/,
  /جاهزة/,
  /^متابعة$/,
  /^(ابدئي|ابدأ|تم)$/,
  /تخطّي|تخطي/,
];

/**
 * Click persona-forced options that aren't already selected. Runs BEFORE the
 * generic pass on every attempt, because these are choices the escalation can't
 * reach: an optional multi-select (conditions) never blocks the step, and the
 * groups whose default is wrong (sex, pregnancy) would be silently accepted.
 * Clicks go one at a time — a revealed sub-block (pregnancy month, high-risk)
 * only exists after the parent choice has re-rendered.
 */
async function forceOptions(page) {
  const acted = [];
  for (const pattern of FORCED_OPTIONS) {
    const hit = await page.evaluate((src) => {
      const re = new RegExp(src);
      const btn = [...document.querySelectorAll("button")]
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !b.disabled;
        })
        .find(
          (b) =>
            re.test(b.textContent.trim()) &&
            b.getAttribute("aria-pressed") !== "true" &&
            b.getAttribute("aria-checked") !== "true",
        );
      if (!btn) return null;
      btn.click();
      return btn.textContent.trim().replace(/\s+/g, " ").slice(0, 30);
    }, pattern.source);
    if (hit) {
      acted.push(hit);
      await page.waitForTimeout(500); // let the revealed sub-block mount
    }
  }
  return acted;
}

/**
 * Members screen: apply the persona's household before pressing the CTA.
 * Toggles are switch-like buttons; steppers are +/- pairs inside the row, so
 * the "+" is located relative to the row's label rather than by index.
 *
 * NOT idempotent, by construction: a toggle already on is left alone (the
 * aria-pressed check), but a stepper is pressed row.count times with no read of
 * the value it already holds — so a second pass ADDS that many again. The
 * caller, not this function, is responsible for running it once.
 */
async function applyHousehold(page, household) {
  const acted = [];
  for (const row of household) {
    for (let i = 0; i < (row.type === "stepper" ? row.count : 1); i++) {
      const done = await page.evaluate(
        ({ label, type }) => {
          const vis = (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          // Deepest element that still contains both the label and a button —
          // that is the row, not the whole card.
          const rows = [...document.querySelectorAll("div,li,label,section")].filter(
            (el) => vis(el) && el.textContent.includes(label) && el.querySelector("button"),
          );
          if (!rows.length) return false;
          const rowEl = rows.reduce((a, b) =>
            (a.textContent ?? "").length <= (b.textContent ?? "").length ? a : b,
          );
          const buttons = [...rowEl.querySelectorAll("button")].filter(vis);
          if (type === "toggle") {
            const btn = buttons.find((b) => b.getAttribute("aria-pressed") !== "true");
            if (!btn) return false;
            btn.click();
            return true;
          }
          // Stepper: the increment is the button whose own text is "+" or which
          // sits last in the row; never the one showing the current count.
          const plus =
            buttons.find((b) => /^\+$/.test(b.textContent.trim())) ??
            buttons.find((b) => /increment|زيادة|add/i.test(b.getAttribute("aria-label") ?? "")) ??
            buttons[0];
          if (!plus || plus.disabled) return false;
          plus.click();
          return true;
        },
        { label: row.label, type: row.type },
      );
      if (done) acted.push(`${row.label}${row.type === "stepper" ? "+1" : ""}`);
      await page.waitForTimeout(400);
    }
  }
  return acted;
}

/** Tick visible unchecked checkboxes (consent/confirmation gates). */
async function checkBoxes(page) {
  return page.evaluate(() => {
    const acted = [];
    for (const c of document.querySelectorAll('input[type="checkbox"]')) {
      const r = c.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && !c.checked) {
        c.click();
        acted.push(c.closest("label")?.textContent.trim().slice(0, 40) ?? "checkbox");
      }
    }
    return acted;
  });
}

async function clickAdvance(page) {
  const buttons = page.locator("button:visible");
  const n = await buttons.count();
  const candidates = [];
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const text = (await b.textContent())?.trim().replace(/\s+/g, " ") ?? "";
    if (await b.isEnabled()) candidates.push({ b, text });
  }
  for (const pattern of ADVANCE_PATTERNS) {
    // Never take the skip link when a household is configured — skipping is
    // exactly what we are trying not to do on that screen.
    if (HOUSEHOLD && /تخطّي|تخطي/.source === pattern.source) continue;
    const hit = candidates.find((c) => pattern.test(c.text));
    if (hit) {
      // A click that cannot land must not kill the run: report it as "did not
      // move" and let the escalation + 3-strike abort handle it, the same as a
      // button that simply refused. A bare throw here loses every screen after.
      try {
        await hit.b.click({ timeout: 15_000 });
      } catch {
        return `${hit.text} (CLICK BLOCKED)`;
      }
      return hit.text;
    }
  }
  return null;
}

/**
 * The plan-scope fork is a two-card choice, not an option group. `--scope`
 * selects which branch: meals-only (the free path run.mjs exercises) or the
 * combined meals+workout opt-in.
 */
async function handlePlanScope(page) {
  const wanted = SCOPE === "workout" ? /وجبات وتمارين/ : /وجبات فقط/;
  const btn = page.locator("button:visible, a:visible").filter({ hasText: wanted });
  if ((await btn.count()) === 0) return null;
  const text = (await btn.first().textContent())?.trim().replace(/\s+/g, " ").slice(0, 40) ?? "";
  await btn.first().click();
  return text;
}

/**
 * The workout "shape" step needs the weekday picker filled to EXACTLY
 * desired_days, and its chips disable once that cap is reached. Two reasons this
 * can't ride on the generic option handler: the group needs N selections rather
 * than one, and the chips only render after a day count is chosen.
 *
 * Clicks go one at a time through Playwright rather than in a single evaluate()
 * — each handler recomputes from React state, so a synchronous burst would have
 * every click read the same stale draft and only the last would stick.
 */
async function handleWorkoutDays(page) {
  const acted = [];
  const countGroup = page.locator("button:visible").filter({ hasText: /^[3-6]$/ });
  const anyChosen = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some(
      (b) => /^[3-6]$/.test(b.textContent.trim()) && b.getAttribute("aria-pressed") === "true",
    ),
  );
  if (!anyChosen && (await countGroup.count())) {
    await countGroup.first().click(); // 3 days/week
    acted.push("desired_days=3");
    await page.waitForTimeout(600);
  }

  // Take the element with the SHORTEST textContent among those containing the
  // label — i.e. the deepest one. Matching "first in document order" instead
  // selects <html>, whose textContent is the whole page, so the count is read
  // from whatever digit appears first (the "1 / 3" step counter).
  const wanted = await page.evaluate(() => {
    const hits = [...document.querySelectorAll("*")].filter((e) =>
      /أي أيام الأسبوع؟/.test(e.textContent ?? ""),
    );
    if (!hits.length) return 0;
    const deepest = hits.reduce((a, b) =>
      (a.textContent ?? "").length <= (b.textContent ?? "").length ? a : b,
    );
    const m = deepest.textContent?.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  if (!wanted) return acted;

  for (let guard = 0; guard < 10; guard++) {
    const state = await page.evaluate(() => {
      // Note the spelling: the app uses "الاثنين" (no hamza).
      const NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const chips = [...document.querySelectorAll("button")].filter((b) =>
        NAMES.includes(b.textContent.trim()),
      );
      return {
        pressed: chips.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent.trim()),
        next: chips.find((b) => b.getAttribute("aria-pressed") !== "true" && !b.disabled)?.textContent.trim() ?? null,
      };
    });
    if (state.pressed.length >= wanted || !state.next) {
      if (state.pressed.length) acted.push(`days=${state.pressed.join("،")}`);
      break;
    }
    await page.locator("button:visible").filter({ hasText: new RegExp(`^${state.next}$`) }).first().click();
    await page.waitForTimeout(450);
  }
  return acted;
}

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "ar-SA", viewport: { width: 420, height: 900 } });
// Answer the analytics consent bar BEFORE the first paint, so it never mounts.
//
// It is `fixed bottom-0`, so it covers the bottom of the VIEWPORT at any scroll
// position — the body-padding mitigation in CookieConsent only clears it at max
// scroll. On any wizard step taller than the viewport (the ~28-chip health
// screen) «التالي» lands under it and Playwright reports the button as visible
// and stable but pointer-intercepted, which killed whole runs.
//
// "declined" rather than "accepted": bot traffic must not land in PostHog.
// NOTE: this makes the driver blind to that overlap by construction — the
// consent bar itself needs its own targeted test, not this one.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("fitlife_cookie_consent", "declined");
  } catch {
    /* private mode — the bar will mount and the run may hit the overlap */
  }
});
const page = await ctx.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
// A silently-failing server action shows the user nothing, so the HTTP layer is
// the only place the reason exists. Capture status + body for every 4xx/5xx.
page.on("response", async (res) => {
  if (res.status() < 400) return;
  const body = await res.text().catch(() => "<unreadable>");
  failedRequests.push({
    status: res.status(),
    method: res.request().method(),
    url: res.url().slice(0, 160),
    body: body.slice(0, 600),
  });
});

try {
  log(`email: ${email}`);
  await page.goto(`${BASE}/auth/login?mode=signup`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);
  // An explicit --email may already have an account (e.g. resuming a run that
  // stopped mid-wizard). Signup refuses it, so fall back to signing in and
  // continue from wherever /onboarding routes them.
  if (new URL(page.url()).pathname.startsWith("/auth/login")) {
    log("signup refused (account exists?) — signing in instead");
    await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
    ]);
  }
  log(`authenticated → ${new URL(page.url()).pathname}`);

  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });

  let stuck = 0;
  let pricingClicked = false;
  for (let screen = 1; screen <= MAX_SCREENS; screen++) {
    await page.waitForTimeout(600); // let the step transition settle
    const before = await screenState(page);
    const path = new URL(page.url()).pathname;
    // Progress belongs in the key: several wizard steps legitimately reuse a
    // heading, and the step counter is what actually distinguishes them.
    const key = `${path}::${before.progress}::${before.heading}`;
    const shot = `${SHOTS}/${String(screen).padStart(2, "0")}-${path.replace(/\//g, "_")}.png`;
    await page.screenshot({ path: shot });

    if (path.startsWith("/plan")) {
      log(`✓ reached ${path} — onboarding complete, generation triggered`);
      journal.push({ screen, path, heading: before.heading, terminal: true });
      break;
    }
    // The free path. Same hydration trap run.mjs documents: the button is
    // server-rendered, so it is clickable before React attaches its handler and
    // an early click is swallowed with no generation started.
    if (path.startsWith("/pricing")) {
      // Only ever click the free path ONCE. The server action can take longer
      // than waitForURL allows, which drops us back here with the button now
      // disabled (pending) — a second attempt then dies on a click timeout and
      // masks a generation that actually started fine.
      if (pricingClicked) {
        log(`${String(screen).padStart(2)}. still on ${path} after the free-path click — generation may already be running; stopping the driver`);
        journal.push({ screen, path, note: "free path clicked once; did not route to /plan in time" });
        break;
      }
      pricingClicked = true;
      const free = page.getByRole("button", { name: /أكملي بخطتك/ });
      if ((await free.count()) === 0) {
        log(`✗ /pricing rendered without the free-path button — stopping`);
        journal.push({ screen, path, heading: before.heading, error: "no free-path button" });
        break;
      }
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll("button")].some((el) =>
              Object.keys(el).some((k) => k.startsWith("__react")),
            ),
          { timeout: 30_000 },
        )
        .catch(() => null);
      await free.first().click();
      log(`${String(screen).padStart(2)}. ${path} → clicked «أكملي بخطتك» (free path)`);
      journal.push({ screen, path, heading: before.heading, clicked: "أكملي بخطتك" });
      await page.waitForURL((u) => u.pathname.startsWith("/plan"), { timeout: 120_000 }).catch(() => null);
      continue;
    }

    // Escalate the way a person does. Most option groups here are OPTIONAL
    // multi-selects with no "none" choice (health conditions, allergies) — a
    // user with nothing to declare just presses التالي. So attempt 1 only fills
    // text fields and tries to advance; we start making selections and ticking
    // consent boxes only once the step actually refuses to move. That keeps the
    // profile honest AND tells us which groups are genuinely required.
    // Which member is the wizard asking about? Every member restarts at step 1,
    // so a progress reset to "1" on the members path means the next one in the
    // queue. The queue order mirrors OnboardingFamilyBuilder.start(). This has to
    // be right: an adult's birth year fails a child's form.
    if (path.startsWith("/onboarding/members") && before.progress === "1") {
      if (lastMemberProgress !== "1") memberPointer += 1;
    }
    if (path.startsWith("/onboarding/members")) lastMemberProgress = before.progress;

    const currentMember = path.startsWith("/onboarding/members")
      ? MEMBER_QUEUE[memberPointer]
      : null;
    const filled = await fillInputs(
      page,
      currentMember ? memberFieldRules(currentMember) : null,
    );
    const forced = await forceOptions(page);
    // The path is NOT enough to identify the picker: /onboarding/members serves
    // both «من معكِ في المنزل؟» (the toggles/steppers) and every per-member
    // detail step («الطول والوزن», «الاسم وسنة الميلاد», …). applyHousehold is
    // label-based, so on a re-render of the picker — a stuck retry, a re-mount —
    // it presses each "+" row.count times AGAIN. Nothing fails at that moment;
    // the household silently grows and the run only breaks screens later, as a
    // wizard queue and a stored beneficiary count nobody asked for. So: match
    // the picker heading (the app genders it, معكِ / معكَ) and compose once.
    if (HOUSEHOLD && !householdApplied && /من مع.*في المنزل/.test(before.heading)) {
      householdApplied = true;
      forced.push(...(await applyHousehold(page, HOUSEHOLD)));
    }
    const chosen = stuck >= 1 ? await chooseOptions(page) : [];
    // The weekday picker needs N selections, so it runs after the generic pass
    // (which supplies focus area / day count / session length) rather than
    // instead of it.
    if (stuck >= 1 && path.startsWith("/onboarding/workout")) {
      chosen.push(...(await handleWorkoutDays(page)));
    }
    const ticked = stuck >= 2 ? await checkBoxes(page) : [];
    await page.waitForTimeout(200);
    const clicked = path.startsWith("/onboarding/plan-scope")
      ? await handlePlanScope(page)
      : await clickAdvance(page);
    // POLL for the transition rather than sleeping a fixed amount. A single
    // fixed wait has to be longer than the slowest server action or it reports a
    // screen that DID advance as stuck — and because `stuck` drives both the
    // escalation and the 3-strike abort, two mis-reads in a row kill a run that
    // was progressing fine. Must be built exactly like `key`: a shape mismatch
    // here makes every screen look like it advanced instead.
    const settleKey = async () => {
      const s = await screenState(page);
      return [`${new URL(page.url()).pathname}::${s.progress}::${s.heading}`, s];
    };
    let [movedTo, after] = await settleKey();
    for (let waited = 0; movedTo === key && waited < 9000; waited += 600) {
      await page.waitForTimeout(600);
      [movedTo, after] = await settleKey();
    }
    const advanced = movedTo !== key;

    const entry = {
      screen,
      path,
      heading: before.heading,
      progress: before.progress,
      filled,
      forced,
      chosen,
      ticked,
      clicked,
      advanced,
      attempt: stuck + 1,
      alerts: after.alerts,
      shot,
    };
    journal.push(entry);
    log(
      `${String(screen).padStart(2)}. ${path} «${before.heading.slice(0, 46)}»` +
        `${before.progress ? ` [${before.progress}]` : ""}` +
        `${stuck ? ` (retry ${stuck})` : ""}` +
        ` → ${clicked ? `«${clicked}»` : "NO ADVANCE BUTTON"} ${advanced ? "✓" : "✗ did not move"}` +
        `${filled.length ? ` | filled: ${filled.join(", ")}` : ""}` +
        `${forced.length ? ` | FORCED: ${forced.join(" / ")}` : ""}` +
        `${chosen.length ? ` | chose: ${chosen.join(" / ")}` : ""}` +
        `${ticked.length ? ` | ticked: ${ticked.join(" / ")}` : ""}` +
        `${after.alerts.length ? ` | ALERT: ${after.alerts.join(" ¶ ")}` : ""}`,
    );

    if (!advanced) {
      stuck++;
      if (stuck >= 3) {
        log(`STUCK on «${before.heading}» after 3 attempts — stopping.`);
        entry.stuckFinal = true;
        break;
      }
    } else {
      stuck = 0;
    }
  }
} catch (err) {
  log(`ERROR: ${err.message.split("\n")[0]}`);
  journal.push({ error: err.message });
} finally {
  writeFileSync(
    `${SHOTS}/journal.json`,
    JSON.stringify({ email, password: PASSWORD, journal, consoleErrors, failedRequests }, null, 2),
  );
  log(`console errors: ${consoleErrors.length}, failed requests: ${failedRequests.length}`);
  consoleErrors.slice(0, 8).forEach((e) => log(`  ! ${e}`));
  failedRequests.slice(0, 8).forEach((r) =>
    log(`  ✗ ${r.status} ${r.method} ${r.url}\n      ${r.body.replace(/\n/g, " ").slice(0, 300)}`),
  );
  log(`journal + screenshots in ${SHOTS}`);
  await ctx.close();
  await browser.close();
}
