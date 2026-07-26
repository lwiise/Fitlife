# QA harness — signup → meal plan, end to end

Signs up a real account on the deployed app, fills the questionnaire, triggers a
genuine plan generation, and polls it to completion. Written for smoke-testing
the live funnel after a deploy.

**This hits production.** It creates a real `auth.users` row and spends real
Anthropic budget on each generation. Clean up afterwards via `/settings`
(hard delete) or the admin danger zone.

## Install

Standalone on purpose — `pnpm-workspace.yaml` globs only `apps/*` and
`packages/*`, so this folder is not a workspace package and its install cannot
touch the app lockfile.

```bash
cd apps/app/scripts/qa-e2e
npm install
```

## Run

```bash
node run.mjs --only=solo-loss --email=you+qa1@gmail.com
```

| Flag | Meaning |
| --- | --- |
| `--only=<key>` | run a single account: `solo-loss`, `family-workout`, `pregnant` |
| `--email=<addr>` | use a fixed address (requires `--only`); omit for a random one |

Environment overrides: `FITLIFE_BASE_URL`, `FITLIFE_TEST_PASSWORD`,
`CHROMIUM_PATH`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

Results are written to `results.json`.

## Diagnostic companions

`run.mjs` answers "did it work". These answer "what actually happened" — they
read the account's own rows under its JWT (`plan_generations` has a
*"Users can view own plan generations"* select policy), which is the only
generation telemetry reachable without Netlify/Sentry credentials.

```bash
node probe.mjs    <email> [--full]   # plan_generations + meal_plans state, true timing
node timeline.mjs <email> [minutes]  # poll a LIVE run; logs when each day lands
node analyze.mjs  <email> [كبدة,...] # targets vs actual day totals, dishes, dislike scan
node cleanup.mjs  <email>            # hard-delete via the real /settings flow, then verify
```

## Walking the app as a real user

`run.mjs` writes the questionnaire straight to PostgREST, so the 10-step adaptive
Arabic wizard it bypasses is never exercised. These three cover that gap.

```bash
node journey.mjs    [--email=<addr>] [--shots=dir]  # signup → wizard → members → pricing → /plan
node tour.mjs       <email> [--paths=/plan,/dashboard]  # visit pages, screenshot, audit
node engagement.mjs <email>                          # tap a check-in chip, verify it persisted
```

`journey.mjs` is **adaptive rather than a hardcoded step list** — it reads each
screen, fills what it finds, and presses the advance button. Two reasons: prod
drifts from the checked-out code, and it fails where a user fails (a button that
doesn't advance) instead of on a stale selector. It escalates the way a person
does — first just press التالي, and only start selecting options once the step
refuses to move. That matters because most option groups here are OPTIONAL
multi-selects with no "none" choice (health conditions, allergies), so
auto-picking the first chip would silently invent a medical condition.

`tour.mjs` flags what a user would hit: HTTP errors, console/page errors, images
without alt text, tap targets under 44px, and horizontal body overflow.

`engagement.mjs` taps a chip and then checks the DATABASE. The engagement write
paths fail soft, so a tap that persists nothing looks exactly like one that
worked — only the row tells you.

Run `timeline.mjs` in parallel with `run.mjs` — it is the substitute for the
background function's logs. The engine persists a full snapshot on every
completed day, so a moving `meal_plans.updated_at` means a day landed and a
static one means the run is stuck inside one day's retry budget.

**`plan_generations`, not the plan row, is the finish line.** `plan_data`
flips `generating: false` *before* the engine's second-chance retry wave and
before the final token/cost write, so the harness can report `ready` while the
background function is still running. Trust `status = completed|failed`,
and read its `error_message` for the partial-day cause.

## Observability that does NOT exist

- `generate-plan-background.mts` has **no Sentry instrumentation** — it only
  writes `console.*`. Sentry has traces for the *dispatch* server actions, never
  for the generation itself. Its logs live only in Netlify's function log.
- The deployed Sentry DSN is write-only; reading issues needs `SENTRY_AUTH_TOKEN`,
  and Netlify's API needs `NETLIFY_AUTH_TOKEN`. Neither is in the repo or the
  sandbox env, so a session without them must diagnose from the DB rows above.

## Network egress

The sandbox must allow both hosts, added as bare domains (not URLs) in the
environment's network settings:

```
fitlife-app-mvp.netlify.app
*.supabase.co
```

Egress policy is fixed when the session's container starts, so a change to
these settings only takes effect in a **new session** — saving them mid-session
does nothing. Verify with a host that actually resolves; a policy rejection
looks like `403 Host not in allowlist`, and the check happens before DNS.

## How it works

1. **Signup through the real UI** (`/auth/login?mode=signup`) so the app writes
   its own Supabase session cookies — no `@supabase/ssr` cookie-format
   reverse-engineering.
2. **Questionnaire via PostgREST** under the user's own JWT (RLS policy
   *"Users can update own profile"*), rather than automating the 11-step
   adaptive wizard. Column values stay inside the migration baseline verified
   against prod (00001–00007), so an unapplied later migration can't break the
   write. `workout_profile` (00014) is the exception and fails soft.
3. **Generation via the real free-path button** «أكملي بخطتك أنتِ فقط الآن —
   مجاناً» on `/pricing?from=onboarding`, which calls `generateSoloAndContinue()`
   → `runFamilyGeneration` + `maybeTriggerWorkoutGeneration`.
4. **Poll** `/api/plans/status` (and `/api/plans/workout/status` when the
   account opted in) until `ready` or `failed`.

## Things that will bite

- **Email confirmation.** If Supabase Auth has *Confirm email* ON, a random or
  third-party address can never complete signup; the run stops with
  `BLOCKED — Supabase email confirmation is ON`. Use an address you control, or
  mint a pre-confirmed user with the service-role key.
- **Trial caps generation to one person.** Signup auto-creates a 7-day trial
  (`handle_new_user`, migration 00004) on the starter tier. Family members are
  stored but their plans defer until a paid subscription covers them, so
  `family-workout` still only generates the mom's plan on the free path.
- **Workout needs migration 00014.** If `profiles.workout_profile` is absent the
  opt-in write is reported as `FAILED (...)` rather than throwing.
- **`status: "ready"` does not mean the plan has meals.** plan-engine flips the
  row to `ready` on the first *empty* shell so the viewer can render the
  skeleton, then fills days in progressively. A generation that dies after the
  flip leaves a `ready` plan with zero meals and `plan_data.generating` still
  `true`. Completion is `status === "ready" && in_progress === false` — the same
  test `GeneratingPlanWatcher.tsx` uses. The poller enforces this; don't relax it.
- **The trigger click needs a hydrated page.** The free-path button is
  server-rendered, so it is visible and "clickable" before React attaches its
  handler — a click at `domcontentloaded` is silently swallowed and no
  generation starts. Navigation waits for `networkidle` plus a React fiber, and
  a click that does not reach `/plan` now throws instead of being ignored.
- **Chromium may need a TLS cap behind an egress proxy.** If a sandbox MITMs
  TLS, Chromium's 1.3 handshakes can be reset (`ERR_CONNECTION_RESET`) while
  Node's succeed. Point `CHROMIUM_PATH` at a wrapper that execs the real binary
  with `--ssl-version-max=tls1.2`; certificate verification stays on. Observed
  again on 2026-07-25 even with the sandbox on "full network access".
- **`in_progress: false` still is not "done".** The harness's completion test is
  the app's own, and it is right about the *viewer* — but the background function
  keeps running through the second-chance retry wave afterwards. A run observed
  on 2026-07-25 reported `ready` at 633s while the function settled at 891s. Both
  runs that day also finished with a **permanently empty day** that the poller
  reported as success, because a failed day counts as "attempted" and flips
  `generating` off. Check `analyze.mjs` for `— EMPTY —` before believing a pass.
- **A hard-killed worker leaves `plan_generations` at `started` forever.** The
  terminal write lives in the function's own `try`/`catch`; Netlify's 15-min kill
  runs neither. Nothing sweeps the row — it is only reclassified by the *next*
  dispatch attempt, after `STALE_GENERATION_MIN`. An account observed on
  2026-07-25 still held a `started` row 40 minutes later.
