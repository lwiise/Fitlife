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
import {
  expandHousehold,
  memberFieldRules,
  memberFromScreen,
  MEMBER_BATCH_BADGE,
} from "./memberFields.mjs";

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

// One "screen" is one wizard STEP, and every household member adds a whole 9-11
// step wizard on top of mom's 10 (plus a retry on each step that needs a
// selection). A flat 40 was a solo number: fam-4 and fam-6 ran out of budget with
// members still unasked and the loop simply ENDED — no log, no journal entry — so
// the missing members surfaced 30 minutes later as a member-count mismatch that
// read like a product bug. Budget from the household that was actually composed.
const screenBudget = (queue) => 40 + 14 * queue.length;
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
//
// This is what the persona REQUESTED. The app builds its real queue from the
// PICKER's state, so the moment the household is composed this is replaced by
// what the picker was verified to actually hold. Deriving member identity from
// the request instead of the composition is how a husband's body data ended up in
// a 7-year-old's form: the picker had silently dropped the husband.
const MEMBER_QUEUE = expandHousehold(HOUSEHOLD);
let composedQueue = MEMBER_QUEUE;
let maxScreens = screenBudget(MEMBER_QUEUE);
// Member identity is read off the wizard's own header (memberFromScreen). These
// two are the FALLBACK for when that header can't be read, and the pointer that
// cross-checks the header against the composed queue.
let memberPointer = -1;
let lastMemberProgress = null;
let lastMemberSig = null;
// How many times the picker was composed + verified. applyHousehold DRIVES each
// control to its target instead of clicking blind, so it is idempotent now and a
// re-visit re-composes rather than doubling the household.
let householdPasses = 0;

const journal = [];

async function screenState(page) {
  return page.evaluate(
    ({ badgeSrc }) => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // The step's own question is the h2. h1 is the sticky wizard chrome
      // ("ملفك الشخصي") and is identical on every screen, so keying progress off
      // it makes an advancing wizard look stuck.
      const h2 = [...document.querySelectorAll("h2")].filter(vis).map((h) => h.textContent.trim())[0];
      // EVERY visible h1, not the first. The onboarding family builder renders
      // each member wizard as a `fixed inset-0` overlay ON TOP of the members
      // page, whose own h1 («عائلتك») stays in the DOM and stays "visible" — so
      // first-in-document-order always returns the PAGE's h1 and never the
      // wizard's «إضافة الزوج» / «إضافة طفل». Same order-based trap that broke the
      // household picker; the member-identity code needs the full list.
      const h1s = [...document.querySelectorAll("h1")]
        .filter(vis)
        .map((h) => h.textContent.trim().replace(/\s+/g, " "));
      // Innermost overlay wins when there is no h2 (the حامل/مرضعة chooser has
      // only an h1, and taking the page's would make two different screens share
      // a key and look stuck).
      const heading = h2 ?? h1s[h1s.length - 1] ?? "";
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
      // "الطفل 2 من 3" — the only on-screen marker of WHICH member of a batch.
      const badgeRe = new RegExp(badgeSrc);
      const memberBadge =
        [...document.querySelectorAll("span")]
          .filter(vis)
          .map((s) => s.textContent.trim().replace(/\s+/g, " "))
          .find((t) => badgeRe.test(t)) ?? null;
      return {
        heading,
        h1s,
        memberBadge,
        alerts,
        buttons,
        inputs,
        progress: document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow") ?? null,
      };
    },
    { badgeSrc: MEMBER_BATCH_BADGE.source },
  );
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
  // TERMINAL CTAs FIRST. The last member of a household submits under
  // «أنشئي الخطة» (OnboardingFamilyBuilder's terminalLabel, MemberWizard's
  // finalLabel), and the housekeeper — always the last task when one is selected
  // — submits under «إضافة الخدامة». Neither was listed, so the final member of
  // EVERY household was simply never saved: the run reported
  // "NO ADVANCE BUTTON" three times and died on the last member's last step,
  // which read as a stuck product screen rather than a missing pattern.
  // Note «الخطة» ≠ «خطتي»: the mom wizard's own «أنشئي خطتي» is the next entry.
  /أنشئي الخطة|أنشئ الخطة/,
  /إضافة الخدامة/,
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

// ── The household picker ────────────────────────────────────────────────────
//
// Every control here is addressed by its ACCESSIBLE NAME, never by walking up to
// "the row". The old ancestor walk could not work by construction: CheckRow's
// root element IS the <button> (FamilyComposerControls.tsx), so a
// `querySelectorAll("div,li,label,section")` search for an ancestor containing
// the label can only ever land on the wrapper that holds all five rows — and
// then `buttons.find(aria-pressed !== "true")` matched the FIRST button in that
// wrapper, because CheckRow uses role="checkbox"/aria-checked and has no
// aria-pressed at all. So every toggle clicked «زوج»: one-toggle personas looked
// fine, two-toggle personas turned the husband back OFF, and nothing said a word.
//
// The names below are real a11y affordances the app already ships, not test
// hooks: CheckRow's role/aria-checked, StepperRow's «زيادة عدد <label>» /
// «إنقاص عدد <label>» buttons and its «<label>: <n>» live-region span. If the
// copy changes, verifyHousehold fails LOUDLY instead of composing the wrong house.
const STEPPER_PLUS = "زيادة عدد ";
const STEPPER_MINUS = "إنقاص عدد ";

/** The picker's own state: every toggle's aria-checked, every stepper's number. */
async function readHousehold(page) {
  return page.evaluate(
    ({ plus }) => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const labelled = [...document.querySelectorAll("[aria-label]")].filter(vis);
      const toggles = [...document.querySelectorAll('button[role="checkbox"]')]
        .filter(vis)
        .map((b) => ({
          label: b.textContent.trim().replace(/\s+/g, " "),
          checked: b.getAttribute("aria-checked") === "true",
        }));
      const steppers = labelled
        .filter((el) => (el.getAttribute("aria-label") ?? "").startsWith(plus))
        .map((inc) => {
          const label = inc.getAttribute("aria-label").slice(plus.length).trim();
          const valueEl = labelled.find((e) =>
            (e.getAttribute("aria-label") ?? "").startsWith(`${label}: `),
          );
          const n = valueEl
            ? Number(valueEl.getAttribute("aria-label").slice(label.length + 2).trim())
            : NaN;
          return { label, value: Number.isFinite(n) ? n : null, atMax: !!inc.disabled };
        });
      return { toggles, steppers };
    },
    { plus: STEPPER_PLUS },
  );
}

/** Resolve a persona's short label ("طفل") to the picker's own full stepper label. */
async function stepperLabel(page, wanted) {
  return page.evaluate(
    ({ label, plus }) => {
      const hit = [...document.querySelectorAll("[aria-label]")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .find((el) => {
          const al = el.getAttribute("aria-label") ?? "";
          return al.startsWith(plus) && al.slice(plus.length).trim().includes(label);
        });
      return hit ? hit.getAttribute("aria-label").slice(plus.length).trim() : null;
    },
    { label: wanted, plus: STEPPER_PLUS },
  );
}

/** A stepper's current number, read from the live-region span's aria-label. */
async function stepperValue(page, full) {
  return page.evaluate((label) => {
    const el = [...document.querySelectorAll("[aria-label]")].find((e) =>
      (e.getAttribute("aria-label") ?? "").startsWith(`${label}: `),
    );
    if (!el) return null;
    const n = Number(el.getAttribute("aria-label").slice(label.length + 2).trim());
    return Number.isFinite(n) ? n : null;
  }, full);
}

/**
 * Members screen: compose the persona's household.
 *
 * IDEMPOTENT, unlike the version this replaces. A stepper is DRIVEN to its target
 * — read the number, click «+» or «−» once, wait for the number to actually
 * change, read again — instead of being clicked `count` times blind. So a second
 * pass over the picker (a stuck retry, a re-mount) settles on the same household
 * rather than doubling it, and a stepper that starts non-zero still lands right.
 */
async function applyHousehold(page, household) {
  const acted = [];
  for (const row of household) {
    if (row.type === "toggle") {
      const result = await page.evaluate(({ label, want }) => {
        const btn = [...document.querySelectorAll('button[role="checkbox"]')]
          .filter((b) => {
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })
          .find((b) => b.textContent.includes(label));
        if (!btn) return "MISSING";
        // aria-CHECKED, not aria-pressed. Reading the wrong attribute is what
        // disabled the "already on" guard and let the second toggle undo the first.
        const on = btn.getAttribute("aria-checked") === "true";
        // Drive TO the target in both directions, like the stepper below. The
        // first version only ever turned a toggle ON, so a toggle that was on
        // and should not be could never be re-settled — verifyHousehold then
        // turned a state the harness itself created into a fatal abort.
        if (on === want) return on ? "already-on" : "already-off";
        btn.click();
        return want ? "on" : "off";
      }, { label: row.label, want: row.want !== false });
      acted.push(`${row.label}=${result}`);
      // A persona toggle row only ever means "this person is in the house", so
      // the settled state to wait for is always checked. Skip the wait when the
      // control wasn't found — verifyHousehold reports that in a moment anyway,
      // and burning the timeout just delays the message.
      if (result === "on") {
        await page
          .waitForFunction(
            (label) =>
              [...document.querySelectorAll('button[role="checkbox"]')].some(
                (b) => b.textContent.includes(label) && b.getAttribute("aria-checked") === "true",
              ),
            row.label,
            { timeout: 4000 },
          )
          .catch(() => null);
      }
      continue;
    }

    const full = await stepperLabel(page, row.label);
    if (!full) {
      acted.push(`${row.label}=MISSING`);
      continue;
    }
    const want = row.count ?? 0;
    // +12 headroom over `want`: enough to walk a stepper DOWN from the picker's
    // MAX (8) as well as up from 0, and still terminate if a click never lands.
    for (let guard = 0; guard < want + 12; guard++) {
      const cur = await stepperValue(page, full);
      if (cur === null || cur === want) break;
      const aria = (cur < want ? STEPPER_PLUS : STEPPER_MINUS) + full;
      const clicked = await page.evaluate((name) => {
        const btn = [...document.querySelectorAll("[aria-label]")].find(
          (e) => e.getAttribute("aria-label") === name,
        );
        if (!btn || btn.disabled) return false;
        btn.click();
        return true;
      }, aria);
      if (!clicked) break; // at the stepper's own ceiling/floor — verify reports it
      // Wait for the COUNT itself to move. A fixed sleep that returns before
      // React re-renders makes the next read stale, and a stale read clicks
      // again — which is precisely the over-counting this rewrite removes.
      await page
        .waitForFunction(
          ({ label, prev }) => {
            const el = [...document.querySelectorAll("[aria-label]")].find((e) =>
              (e.getAttribute("aria-label") ?? "").startsWith(`${label}: `),
            );
            if (!el) return false;
            return Number(el.getAttribute("aria-label").slice(label.length + 2).trim()) !== prev;
          },
          { label: full, prev: cur },
          { timeout: 4000 },
        )
        .catch(() => null);
    }
    acted.push(`${row.label}=${await stepperValue(page, full)}`);
  }
  return acted;
}

/**
 * Read the picker back and compare it against what the persona asked for.
 *
 * This is the whole point of the exercise: three full production rounds were
 * spent chasing a household that the harness had composed wrong and never
 * mentioned. The picker's state is checked BEFORE the CTA is pressed, both
 * directions (a control that should be on and isn't, AND a control that is on
 * and shouldn't be), and a persona row that matches no control at all is a
 * mismatch too — that is label drift, and silently doing nothing about it is how
 * this class of bug survives.
 */
async function verifyHousehold(page, household) {
  const observed = await readHousehold(page);
  // Persona labels are short prefixes of the UI's own ("خدامة" vs «خدامة تطبخ
  // للعائلة»), and "زوج" is deliberately also a prefix of «زوجة» so a male
  // owner's spouse row matches the same persona entry.
  const rowFor = (label, type) =>
    household.find((r) => r.type === type && label.includes(r.label)) ?? null;

  const wanted = [];
  const got = [];
  const mismatches = [];
  for (const t of observed.toggles) {
    const want = !!rowFor(t.label, "toggle");
    wanted.push(`${t.label}=${want ? "on" : "off"}`);
    got.push(`${t.label}=${t.checked ? "on" : "off"}`);
    if (want !== t.checked) {
      mismatches.push(`${t.label}: wanted ${want ? "on" : "off"}, got ${t.checked ? "on" : "off"}`);
    }
  }
  for (const s of observed.steppers) {
    const want = rowFor(s.label, "stepper")?.count ?? 0;
    wanted.push(`${s.label}=${want}`);
    got.push(`${s.label}=${s.value}`);
    if (want !== s.value) mismatches.push(`${s.label}: wanted ${want}, got ${s.value}`);
  }
  for (const r of household) {
    const seen =
      r.type === "toggle"
        ? observed.toggles.some((t) => t.label.includes(r.label))
        : observed.steppers.some((s) => s.label.includes(r.label));
    if (!seen) mismatches.push(`«${r.label}» (${r.type}): no such control on the picker — label drift?`);
  }

  return {
    ok: mismatches.length === 0,
    wanted: wanted.join(" "),
    got: got.join(" "),
    mismatches,
    observed,
    // The household in persona shape, as the picker ACTUALLY holds it — this,
    // not the persona's request, is what the app builds its member queue from.
    rows: [
      ...observed.toggles.filter((t) => t.checked).map((t) => ({ label: t.label, type: "toggle" })),
      ...observed.steppers
        .filter((s) => (s.value ?? 0) > 0)
        .map((s) => ({ label: s.label, type: "stepper", count: s.value })),
    ],
  };
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
// Answer the analytics consent ask BEFORE the first paint, so it never mounts.
//
// "declined" rather than "accepted": bot traffic must not land in PostHog. That
// is the ONLY reason left — the ask is now a block in normal document flow and
// no longer covers «التالي» (it was `fixed bottom-0`, and the body-padding
// mitigation only cleared it at max scroll, so on the ~28-chip health screen
// Playwright reported the button as visible and stable but pointer-intercepted,
// which killed whole runs).
//
// NOTE: seeding here makes this driver blind to that overlap by construction.
// consent-overlap.mjs owns that invariant — it seeds nothing on purpose.
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
  // Declared OUTSIDE the loop so the budget check below can tell "ran out of
  // screens" (silent, and how three households lost their last members) apart
  // from "broke out deliberately".
  let screen = 1;
  for (; screen <= maxScreens; screen++) {
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

    // WHICH member is the wizard asking about? Ask the SCREEN, not the clock.
    //
    // The old rule was "a progress reset to 1 on the members path means the next
    // entry in the persona's queue". Both halves were wrong: the app's queue is
    // built from the PICKER's state, so it only matched the persona's request
    // while the composition happened to be right — and when it wasn't, the
    // husband's 175cm/82kg was typed into a 7-year-old's form without one word of
    // complaint. The wizard says who it is asking about in its own <h1>
    // («إضافة الزوج» / «إضافة طفل» / «إضافة خدامة») and prints "الطفل 2 من 3" for
    // the position within a batch. Read that; use the queue only to cross-check.
    let currentMember = null;
    if (path.startsWith("/onboarding/members")) {
      const seen = memberFromScreen(before.h1s, before.memberBadge);
      if (seen) {
        const sig = `${seen.kind}#${seen.index}`;
        if (sig !== lastMemberSig) {
          lastMemberSig = sig;
          memberPointer += 1;
        }
        const queued = composedQueue[memberPointer];
        if (queued && queued.kind !== seen.kind) {
          log(`    ⚠ MEMBER POINTER: screen says ${sig}, composed queue says ${queued.kind}#${queued.index} — trusting the screen`);
          journal.push({
            screen,
            path,
            memberPointerDrift: { screen: sig, queue: `${queued.kind}#${queued.index}`, pointer: memberPointer },
          });
        }
        currentMember = seen;
      } else if (before.inputs.some((i) => /^m-|^hk-/.test(i.id ?? ""))) {
        // A member form is plainly on screen but its header matched nothing we
        // know. Fall back to the old position heuristic — and SAY SO. Letting the
        // generic filler loose on a member form is how "2" got written into a
        // birth year and every household run died on «أكملي الاسم وسنة الميلاد».
        if (before.progress === "1" && lastMemberProgress !== "1") memberPointer += 1;
        currentMember = composedQueue[Math.max(memberPointer, 0)] ?? { kind: "adult", index: 0 };
        log(`    ⚠ MEMBER SCREEN UNRECOGNISED (h1: ${(before.h1s ?? []).join(" | ") || "none"}) — falling back to queue position ${memberPointer} (${currentMember.kind})`);
        journal.push({ screen, path, memberScreenUnrecognised: { h1s: before.h1s, fallback: currentMember } });
      }
      lastMemberProgress = before.progress;
    }

    const filled = await fillInputs(
      page,
      currentMember ? memberFieldRules(currentMember) : null,
    );
    const forced = await forceOptions(page);
    // The path is NOT enough to identify the picker: /onboarding/members serves
    // both «من معكِ في المنزل؟» (the toggles/steppers) and every per-member
    // detail step («الطول والوزن», «الاسم وسنة الميلاد», …), so match the picker's
    // own heading (the app genders it, معكِ / معكَ).
    //
    // Composed on EVERY visit rather than once: applyHousehold drives each control
    // to its target now, so a re-render (a stuck retry, a re-mount) re-settles on
    // the same household instead of doubling it — and re-verifies, which is what
    // we actually want out of a second look at the picker.
    let householdCheck = null;
    if (HOUSEHOLD && /من مع.*في المنزل/.test(before.heading)) {
      householdPasses += 1;
      forced.push(...(await applyHousehold(page, HOUSEHOLD)));
      householdCheck = await verifyHousehold(page, HOUSEHOLD);
      const composedShot = `${SHOTS}/household-composed.png`;
      await page.screenshot({ path: composedShot });
      householdCheck.shot = composedShot;
      householdCheck.pass = householdPasses;
      // The app queues members from the PICKER, so everything downstream — which
      // member each form belongs to, how many screens the run needs — is derived
      // from what was verified here, never from what the persona asked for.
      composedQueue = expandHousehold(householdCheck.rows);
      maxScreens = screenBudget(composedQueue);
      if (householdCheck.ok) {
        log(`    household composed (pass ${householdPasses}): ${householdCheck.got} → queue ${composedQueue.map((m) => m.kind).join(",") || "empty"} (budget ${maxScreens} screens)`);
      } else {
        // LOUD, and at the moment it happens. A silently wrong household cost
        // three full production rounds: the picker dropped a member, the wizard
        // asked about somebody else, the fields went into the wrong person, and
        // the only symptom was a member count half an hour later. Do not press
        // the CTA — everything after this point would be fiction.
        log(`!! HOUSEHOLD MISMATCH: wanted ${householdCheck.wanted}, got ${householdCheck.got}`);
        for (const m of householdCheck.mismatches) log(`!!   ${m}`);
        log(`!! ABORTING before the CTA — a wrong household corrupts every member after it. See ${composedShot}`);
        journal.push({
          screen,
          path,
          heading: before.heading,
          householdMismatch: householdCheck,
          fatal: true,
        });
        process.exitCode = 3;
        break;
      }
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
      // Recorded on EVERY member screen, so a journal read tells you whose form
      // each value went into without replaying the run.
      ...(currentMember ? { member: `${currentMember.kind}#${currentMember.index}` } : {}),
      ...(householdCheck ? { household: householdCheck } : {}),
    };
    journal.push(entry);
    log(
      `${String(screen).padStart(2)}. ${path} «${before.heading.slice(0, 46)}»` +
        `${before.progress ? ` [${before.progress}]` : ""}` +
        `${stuck ? ` (retry ${stuck})` : ""}` +
        ` → ${clicked ? `«${clicked}»` : "NO ADVANCE BUTTON"} ${advanced ? "✓" : "✗ did not move"}` +
        `${currentMember ? ` | member: ${currentMember.kind}#${currentMember.index}` : ""}` +
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
  // Falling off the end of the loop used to be completely silent: the run just
  // stopped mid-wizard and the unasked members turned up later as a member-count
  // mismatch that read like a product bug.
  if (screen > maxScreens) {
    log(`!! SCREEN BUDGET EXHAUSTED after ${maxScreens} screens — the run stopped mid-flow, it did NOT finish.`);
    log(`!! composed queue was ${composedQueue.map((m) => `${m.kind}#${m.index}`).join(", ") || "empty"}; raise screenBudget() if this household is legitimately longer.`);
    journal.push({ budgetExhausted: { maxScreens, queue: composedQueue }, fatal: true });
    process.exitCode = 4;
  }
} catch (err) {
  log(`ERROR: ${err.message.split("\n")[0]}`);
  journal.push({ error: err.message });
} finally {
  writeFileSync(
    `${SHOTS}/journal.json`,
    JSON.stringify({ email, password: PASSWORD, journal, consoleErrors, failedRequests }, null, 2),
  );
  // Restate the fatal verdicts LAST. A mismatch logged 40 screens ago scrolls
  // out of a matrix run's captured output, and run-matrix.mjs only prints the
  // exit code — the one line that has to survive is this one.
  const mismatch = journal.find((e) => e.householdMismatch)?.householdMismatch;
  if (mismatch) {
    log(`!! RUN ABORTED — HOUSEHOLD MISMATCH: wanted ${mismatch.wanted}, got ${mismatch.got}`);
    mismatch.mismatches.forEach((m) => log(`!!   ${m}`));
  }
  if (journal.some((e) => e.budgetExhausted)) log(`!! RUN INCOMPLETE — screen budget exhausted`);
  const drift = journal.filter((e) => e.memberPointerDrift || e.memberScreenUnrecognised).length;
  if (drift) log(`!! ${drift} member-pointer warning(s) — see journal.json`);
  log(`console errors: ${consoleErrors.length}, failed requests: ${failedRequests.length}`);
  consoleErrors.slice(0, 8).forEach((e) => log(`  ! ${e}`));
  failedRequests.slice(0, 8).forEach((r) =>
    log(`  ✗ ${r.status} ${r.method} ${r.url}\n      ${r.body.replace(/\n/g, " ").slice(0, 300)}`),
  );
  log(`journal + screenshots in ${SHOTS}`);
  await ctx.close();
  await browser.close();
}
