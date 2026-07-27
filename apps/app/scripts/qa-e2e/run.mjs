// End-to-end: sign up random accounts on the deployed Fit Life app, fill the
// questionnaire data, trigger a real plan generation, and poll to completion.
//
// Design notes:
//  - Signup + the generation trigger go through the REAL UI (Playwright), so
//    Supabase session cookies are written by the app itself in @supabase/ssr's
//    own format — no cookie-shape reverse-engineering.
//  - The questionnaire payload is written via PostgREST under the user's own
//    JWT (RLS: "Users can update own profile"), which is deterministic and
//    avoids automating an 11-step adaptive Arabic wizard.
//  - Generation is triggered by clicking the free «أكملي بخطتك أنتِ فقط الآن»
//    button on /pricing?from=onboarding, which calls generateSoloAndContinue()
//    → runFamilyGeneration + maybeTriggerWorkoutGeneration.
//
// Usage: node run.mjs [--only=<key>] [--keep-open]

import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { ACCOUNTS } from "./accounts.mjs";

const BASE = process.env.FITLIFE_BASE_URL ?? "https://fitlife-app-mvp.netlify.app";
const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const PASSWORD = process.env.FITLIFE_TEST_PASSWORD ?? "FitLifeQA!2026";
const POLL_MS = 10_000;
// 16 min, deliberately past the app's STALE_GENERATION_MIN (15). A generation
// that dies mid-flight is reclassified "failed" by getLatestPlan's dead-man's
// switch at 15 min, so waiting that long turns an ambiguous timeout into a
// definitive failed verdict.
const PLAN_TIMEOUT_MS = 16 * 60_000;

const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
// Explicit address for a single-account run; otherwise a fresh random one.
const fixedEmail = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1];
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

function randomEmail(key) {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);
  return `fitlife.qa+${key}-${stamp}${rand}@gmail.com`;
}

// ---------------------------------------------------------------------------
// Discover the public Supabase URL + anon key from the deployed client bundle.
// Both are NEXT_PUBLIC_* and therefore inlined into the served JavaScript.
// ---------------------------------------------------------------------------
async function discoverSupabaseCreds() {
  const html = await (await fetch(`${BASE}/auth/login`)).text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) =>
    m[1].startsWith("http") ? m[1] : `${BASE}${m[1]}`,
  );
  const urlRe = /https:\/\/[a-z0-9-]+\.supabase\.co/;
  const jwtRe = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

  let url = html.match(urlRe)?.[0] ?? null;
  let anon = null;

  const pickAnon = (text) => {
    for (const tok of text.match(jwtRe) ?? []) {
      try {
        const payload = JSON.parse(
          Buffer.from(tok.split(".")[1], "base64url").toString("utf8"),
        );
        if (payload.role === "anon") return tok;
      } catch {
        /* not a JWT we care about */
      }
    }
    return null;
  };

  anon = pickAnon(html);
  for (const src of scripts) {
    if (url && anon) break;
    let body;
    try {
      body = await (await fetch(src)).text();
    } catch {
      continue;
    }
    url ??= body.match(urlRe)?.[0] ?? null;
    anon ??= pickAnon(body);
  }
  if (!url || !anon) {
    throw new Error(
      `Could not discover Supabase creds from the bundle (url=${!!url}, anon=${!!anon}). ` +
        `Set SUPABASE_URL / SUPABASE_ANON_KEY env vars to override.`,
    );
  }
  return { url: process.env.SUPABASE_URL ?? url, anon: process.env.SUPABASE_ANON_KEY ?? anon };
}

// ---------------------------------------------------------------------------
// Real UI signup. Returns "session" | "confirm-required" | "error:<msg>"
// ---------------------------------------------------------------------------
async function signUpViaUi(page, email, password) {
  await page.goto(`${BASE}/auth/login?mode=signup`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page
      .waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 })
      .catch(() => null),
  ]);

  if (!new URL(page.url()).pathname.startsWith("/auth/login")) return "session";

  const confirm = await page.getByText("رسالة التأكيد في إيميلك").count();
  if (confirm > 0) return "confirm-required";

  const err = await page.locator(".bg-red-50").first().textContent().catch(() => null);
  return `error:${(err ?? "unknown").trim()}`;
}

// ---------------------------------------------------------------------------
// Questionnaire data via PostgREST under the user's own JWT.
// ---------------------------------------------------------------------------
async function writeQuestionnaire(sb, userId, account) {
  const now = new Date().toISOString();
  const { error: pErr } = await sb
    .from("profiles")
    .update({
      ...account.profile,
      family_wide_completed_at: now,
      mom_profile_completed_at: now,
      onboarding_completed_at: now,
    })
    .eq("id", userId);
  if (pErr) throw new Error(`profile write failed: ${pErr.message}`);

  for (const m of account.members) {
    const { error: mErr } = await sb
      .from("family_members")
      .insert({ ...m, user_id: userId });
    if (mErr) throw new Error(`member "${m.name}" write failed: ${mErr.message}`);
  }

  let workoutOptIn = null;
  if (account.workout && account.workout_profile) {
    const { error: wErr } = await sb
      .from("profiles")
      .update({ workout_profile: account.workout_profile })
      .eq("id", userId);
    workoutOptIn = wErr ? `FAILED (${wErr.message})` : "ok";
  }
  return { workoutOptIn };
}

// ---------------------------------------------------------------------------
// Trigger generation through the real free-path button, then poll.
// ---------------------------------------------------------------------------
async function triggerGeneration(page) {
  // "domcontentloaded" is NOT enough: the button is server-rendered, so
  // Playwright's actionability checks pass while React has yet to attach the
  // click handler, and the click is silently swallowed. Wait for the network to
  // settle AND for the fiber to exist before clicking.
  await page.goto(`${BASE}/pricing?from=onboarding`, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: /أكمل(ي)? بخطتك/ });
  if ((await btn.count()) === 0) {
    throw new Error("free-path button «أكملي بخطتك» not rendered on /pricing?from=onboarding");
  }
  await btn
    .first()
    .evaluate((el) => {
      if (!Object.keys(el).some((k) => k.startsWith("__react"))) throw new Error("not hydrated");
    })
    .catch(async () => {
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("button")].some((el) =>
            Object.keys(el).some((k) => k.startsWith("__react")),
          ),
        { timeout: 30_000 },
      );
    });

  await btn.first().click();
  // A click that lands fires the server action and routes to /plan. If that
  // never happens the trigger did NOT work — fail loudly instead of letting the
  // poller spend its whole budget on a plan that was never requested.
  try {
    await page.waitForURL((u) => u.pathname.startsWith("/plan"), { timeout: 120_000 });
  } catch {
    throw new Error(
      `clicked «أكملي بخطتك» but never navigated to /plan (still ${page.url()}); ` +
        `the server action did not fire`,
    );
  }
}

async function pollStatus(page, path, timeoutMs, labelForLog) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const res = await page.request.get(`${BASE}${path}`);
    const body = await res.json().catch(() => ({}));
    if (res.status() === 404) {
      last = { status: "none" };
    } else if (res.ok()) {
      last = body;
      const st = body.status;
      // "ready" alone is NOT done. plan-engine flips the row to ready on the
      // first EMPTY shell (generate.ts: "flip 'ready' on the first emit"), so a
      // plan whose days never filled reports ready with zero meals. The app's
      // own watcher (GeneratingPlanWatcher.tsx) requires in_progress === false,
      // and so do we — otherwise a dead generation is reported as success.
      if (st === "failed" || (st === "ready" && body.in_progress === false)) {
        return { ...body, seconds: Math.round((Date.now() - started) / 1000) };
      }
      if (body.waiting_for_meals) {
        log(`    ${labelForLog}: waiting for meal generation to finish first…`);
      }
    } else {
      last = { status: `http_${res.status()}`, body };
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  // Report the timeout as such. Carrying `last.status` through would relabel a
  // stalled empty shell as "ready" and read as success downstream.
  return {
    ...(last ?? {}),
    status: "timeout",
    last_status: last?.status ?? null,
    timedOut: true,
  };
}

// ---------------------------------------------------------------------------

async function runAccount(browser, creds, account) {
  const email = fixedEmail ?? randomEmail(account.key);
  const result = { key: account.key, label: account.label, email, password: PASSWORD };
  const ctx = await browser.newContext({ locale: "ar-SA" });
  const page = await ctx.newPage();

  try {
    log(`▶ ${account.label}`);
    log(`  email: ${email}`);

    const signup = await signUpViaUi(page, email, PASSWORD);
    result.signup = signup;
    if (signup === "confirm-required") {
      result.outcome = "BLOCKED — Supabase email confirmation is ON; a random inbox cannot confirm.";
      return result;
    }
    if (signup.startsWith("error:")) {
      result.outcome = `FAILED at signup — ${signup.slice(6)}`;
      return result;
    }
    log("  ✓ signed up, session established");

    // Independent JWT for the data writes (RLS as this user).
    const sb = createClient(creds.url, creds.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: signInErr } = await sb.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInErr) throw new Error(`API sign-in failed: ${signInErr.message}`);
    result.userId = auth.user.id;

    const { workoutOptIn } = await writeQuestionnaire(sb, auth.user.id, account);
    result.workoutOptIn = workoutOptIn;
    log(`  ✓ questionnaire written${workoutOptIn ? ` (workout opt-in: ${workoutOptIn})` : ""}`);

    await triggerGeneration(page);
    log("  ✓ generation triggered — polling…");

    const meal = await pollStatus(page, "/api/plans/status", PLAN_TIMEOUT_MS, "meal");
    result.meal = meal;
    log(`  meal plan: ${meal.status}${meal.seconds ? ` in ${meal.seconds}s` : ""}`);

    if (account.workout) {
      const workout = await pollStatus(
        page,
        "/api/plans/workout/status",
        PLAN_TIMEOUT_MS,
        "workout",
      );
      result.workout = workout;
      log(`  workout plan: ${workout.status}${workout.seconds ? ` in ${workout.seconds}s` : ""}`);
    }

    result.outcome =
      meal.status === "ready" && !meal.timedOut
        ? "OK"
        : `meal plan ended as "${meal.status}"${
            meal.last_status ? ` (last seen "${meal.last_status}")` : ""
          }${meal.error_message ? ` — ${meal.error_message}` : ""}`;
    return result;
  } catch (err) {
    result.outcome = `ERROR — ${err.message}`;
    return result;
  } finally {
    await ctx.close();
  }
}

async function main() {
  const selected = ACCOUNTS.filter((a) => !only || a.key === only);
  if (!selected.length) throw new Error(`--only=${only} matched no account`);
  // One address cannot sign up more than once — refuse rather than fail midway.
  if (fixedEmail && selected.length > 1) {
    throw new Error(
      `--email is set but ${selected.length} accounts are selected; add --only=<key>.`,
    );
  }

  log(`Target: ${BASE}`);
  const creds = await discoverSupabaseCreds();
  log(`Supabase: ${creds.url} (anon key discovered)`);

  const browser = await chromium.launch({ executablePath: CHROME });
  const results = [];
  try {
    for (const account of selected) {
      results.push(await runAccount(browser, creds, account));
    }
  } finally {
    await browser.close();
  }

  console.log("\n================ SUMMARY ================");
  for (const r of results) {
    console.log(`\n${r.label}`);
    console.log(`  email    : ${r.email}`);
    console.log(`  password : ${r.password}`);
    console.log(`  user id  : ${r.userId ?? "—"}`);
    console.log(`  meal     : ${r.meal?.status ?? "—"}${r.meal?.seconds ? ` (${r.meal.seconds}s)` : ""}`);
    if (r.workout) console.log(`  workout  : ${r.workout.status}${r.workout.seconds ? ` (${r.workout.seconds}s)` : ""}`);
    if (r.workoutOptIn) console.log(`  optin    : ${r.workoutOptIn}`);
    console.log(`  outcome  : ${r.outcome}`);
  }
  writeFileSync(
    new URL("./results.json", import.meta.url),
    JSON.stringify(results, null, 2),
  );
  console.log("\nSaved results.json");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
