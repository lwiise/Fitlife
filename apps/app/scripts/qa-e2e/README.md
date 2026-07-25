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
