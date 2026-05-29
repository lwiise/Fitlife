# Fit Life 2.0 — Correctness Audit

Date: 2026-05-29 · Scope: correctness/security/reliability of the live app (`apps/app`), the AI engine (`packages/plan-engine`), and the Netlify background function. Read-only investigation across generation/reliability, billing/security, and onboarding/translation/locale, followed by a targeted, low-risk fix pass.

**Honesty note:** this is not a claim that the codebase is bug-free. It records what was verified, what is suspected, what needs a human/product decision, and what is blocked on external inputs. Several items are deliberately left for sign-off rather than "fixed."

Classification: **CONFIRMED** (traced/reproducible) · **SUSPECTED** (looks wrong, needs verification) · **SMELL** (works, but fragile). Severity: **S0** correctness/security/data · **S1** reliability · **S2** UX correctness · **S3** cleanup.

---

## Fixed this pass

### [S1 · CONFIRMED] Cost logging hardcoded to Opus rates
`packages/plan-engine/src/constants.ts:14` defined a single `PRICING_USD_PER_MTOK = {15,75}` (Opus), and `computeCostUsd(tokensIn, tokensOut)` (`anthropic.ts:147`) applied it regardless of the model actually used. `PLAN_MODEL` is env-overridable (`constants.ts:12`) to Sonnet/Haiku, so `plan_generations.cost_usd` was logged ~5× (Sonnet) / ~15× (Haiku) too high.
**Root cause:** pricing not keyed by model. **Does not affect charges** — SAR prices live in `packages/config` (untouched); this is the internal audit figure only.
**Fix:** `PRICING_USD_PER_MTOK_BY_MODEL` map + `pricingForModel(model)` with an Opus-rate fallback for unknown ids; `computeCostUsd(tokensIn, tokensOut, model)`; both call sites pass `PLAN_MODEL` (`generate.ts:614`, `:909`). Barrel export updated (`index.ts:50`).
**Verify:** set `PLAN_MODEL=claude-sonnet-4-6`, generate, assert `plan_generations.cost_usd` reflects $3/$15 rates.

### [S1 · CONFIRMED] Translation token spend never logged
`translateMealPlan` computed `usage.cost_usd` (`generate.ts:909`) but `runMealPlanTranslation` and the bg `translate` branch **discarded** it — housekeeper-translation spend was invisible in `plan_generations`.
**Fix:** after a successful in-place translation, insert a `plan_generations` audit row (`model`, `tokens_in/out`, `cost_usd`, `status='completed'`, `started_at`/`completed_at`) in both `runMealPlanTranslation` (`generate.ts`) and the bg `translate` branch (added a fetch-based `sbInsert` helper, keeping the function SDK-free). Audit-write failures are non-fatal.
**Coupled fix — rate-limit collision:** `canGeneratePlan` (`queries.ts:111`, gates `canGenerateNewPlan` `access.ts:100`) counted raw `completed` `plan_generations` rows, limit 3/week. A translation row written as `completed` would have consumed a generation slot. The `status` CHECK constraint only allows `started/completed/failed` (`migrations/00003`), so a custom status was not an option without a migration. Changed `canGeneratePlan` to count **DISTINCT `meal_plan_id`** — behavior-identical today (1 generation row per plan) and immune to the new translation rows.
**Verify:** add a housekeeper locale, translate, assert a new audit row exists AND the weekly generation count is unchanged.

### [S1 · CONFIRMED] Linear, narrow retry backoff
`isRetryable` (`generate.ts:112`) + linear `sleep(800 * attempt)`, max 2 attempts, across three loops (day generation, day translation, name translation).
**Fix:** shared `MAX_RETRIES=3` + `backoffMs()` exponential-with-jitter (800/1600/3200 + 0–400ms); `isRetryable` now matches 429, 529 explicitly (529 was already caught by the `5\d\d` branch) and `overloaded`. All three loops updated.

### [S0 · CONFIRMED] Stuck-`generating` dead-man's switch
The bg function only writes `status='failed'` inside its `catch` (`generate-plan-background.mts:376-399`). A Netlify hard-kill at the 15-min budget skips the catch, leaving the row at `status='generating'` (or a `ready` shell with `plan_data.generating===true`) **forever** — the viewer shows a perpetual loader. The only prior recovery was the 15-min staleness guard in `dispatch.ts`, which merely lets the *next manual* generation proceed; it never failed the stuck row or told the user.
**Fix (user-approved: lazy read-time flip):** `getLatestPlan` now reclassifies an in-flight row (`generating`, or `ready`+`generating` flag) whose `updated_at` is ≥ `STALE_GENERATION_MIN` (15) as `failed` with a message, so the UI's existing failed/retry branch fires. Read-time only — the DB row is left as-is; a write-back sweep was explicitly de-scoped. `STALE_GENERATION_MIN` is now exported from `getLatestPlan.ts` and reused by `dispatch.ts` (no duplication, no circular import).
**Verify:** craft a `generating` row with `updated_at` >15 min old; confirm `getLatestPlan` returns `failed` and the retry UI appears.

---

## Verified correct (no change)

- **Timezone (Riyadh UTC+3):** `riyadhTodayISO()` (`dates.ts:37`) applies +3h before slicing the date; `week_start_date` and day index (`dayMapping.ts:70`) and default tab (`PlanViewer.tsx:75`) all derive from it. No UTC midnight off-by-one.
- **Admin-client ownership:** all 6 service-role writes (webhook, restore, delete, cancel, tier-change, account-delete) double-filter on `user_id` before writing.
- **Webhook:** HMAC via `crypto.timingSafeEqual` (`lemonsqueezy/route.ts:38-43`), verified before parse, keyed on `custom_data.user_id`; all six events update the correct row.
- **Checkout/tier/cancel:** existing subscribers swap variant via `updateSubscription` (no second subscription); trial/new users go through checkout; cancel sets `cancel_at_period_end` optimistically + reconciles via webhook.
- **Auth allow-list (`proxy.ts:18-25`):** public set is exactly `/`, `/privacy`, `/terms`, `/auth/*`, `/api/*`, Next assets; session refreshed on every protected request.
- **Sentry PII:** only `user.id` (+ non-sensitive tags like area/tier) in tags; no email/keys/card data.
- **Translate-in-place:** fills `*_translated` only, same row, deep-clones before mutating, never regenerates (`generate.ts:753-832`, `runMealPlanTranslation`).
- **No-Arabic-fallback maid gating:** a day stays "preparing…" until every meal has `prep_steps_translated_locale === locale` (`PlanViewer.tsx:65-68,343-350`).
- **RTL:** logical Tailwind classes only (`ms/me/ps/pe`); no physical `ml/mr/pl/pr/left/right` found.
- **Restore / soft-delete:** delete sets `status='archived'`; `getLatestPlan` excludes archived; restore inserts a new re-anchored row without orphaning audit rows.
- **Onboarding goal mapping:** `mapUserGoalToSara` (`goalMapping.ts:28`) maps 5 UI goals → 8 canonical goals correctly, pregnancy short-circuits first; upgrade gate counts beneficiaries (Mom + non-housekeeper) correctly; solo plans hide member tabs.
- **Background function SDK-free:** imports only the pure fetch-based engine + types; `@supabase/supabase-js` appears only as a type-only import (erased). Confirmed still true after this pass.
- **Schema validation before persist:** the assembled plan is `safeParse`d before return (`generate.ts:537`) and each day slice is validated (`:478`); `getLatestPlan` re-validates and surfaces invalid `plan_data` as `failed`.

---

## Flagged — needs human/product decision (NOT coded)

1. **[S2 · SUSPECTED] `status='ready'` empty shell.** Status flips to `ready` on the first `onProgress` emit (`generate.ts:436,645`), a shell with days-but-fewer-meals. Largely contained now (Fix 4 fails stale shells; `getLatestPlan` re-validates against `MealPlanSchema` whose `days.min(1)` rejects emptied members). **Open question for sign-off:** confirm a fresh *solo* first-emit shell can't pass schema with a meal-less day and read as "usable" in `getTodaysPlanView`/dashboard. Recommend a `meals.length > 0` assertion on the "usable plan" check rather than changing the progressive-loading UX.
2. **[S3 · SMELL] Silent day omission.** A day that fails validation after retries is logged and dropped (`generate.ts:514-520`), yielding a <7-day plan with no user-facing signal. Recommend surfacing a partial-plan indicator or failing the generation if N days are missing.
3. **[FLAGGED — kept as-is per decision] Deferred-member drain.** Members added during an in-flight generation are deferred to a manual dashboard banner with no auto-trigger on completion (`onboarding/actions.ts:513`, `GenerateFamilyPlanBanner.tsx`). User chose to keep the manual banner. Documented only.
4. **[S0 · SUSPECTED — HIGH STAKES, needs sign-off] Allergy/medical translation.** Allergens flow as **structured prompt constraints** per member ("حساسية (تجنّب تام)") at generation time (`systemPrompt.ts:624-646`); translation is procedural (translates `prep_steps_ar`, doesn't re-derive constraints). So today's flow is safe **iff** the allergy data is recorded in the DB. The residual risk is that "omit X for [member]" lives only in generated prose, not as a machine-checked field on the recipe/portion. **Recommend (do not ship without product/clinical sign-off):** add a structured `excluded_allergens`/`member_safety_notes` field on the meal/`per_member_portion` so per-locale rewrites can never soften or drop it, plus a render-time assertion in the maid view. Flagged given real-world harm potential.
5. **[S2 · SUSPECTED] Webhook idempotency.** HMAC + event handling are correct, but there is no explicit event-id dedup; replays are tolerated only because the updates are value-idempotent. Consider a processed-event-id guard if LS can deliver non-idempotent duplicates.
6. **[BLOCKED on external inputs] Lemonsqueezy variant IDs are test-mode** (`packages/config/src/pricing.ts:12`). Real charges blocked until live IDs + env-based switching are set. Do not invent IDs.
7. **[FLAGGED — ops] Deploy-on-every-commit + `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.** Frequent auto-deploys risk (a) landing on in-flight 15-min generations and (b) invalidating open tabs (`UnrecognizedActionError`) if the key isn't a stable env var. Recommend scheduled/manual deploys and verifying the key is sourced from a stable env var (per CLAUDE.md it must be set + stable).

---

## Deliberately not changed (with reason)

- **`STATIC_SYSTEM` / methodology / `SARA_COOKBOOK` text** — editing invalidates the prompt cache and affects plan correctness; out of scope for a bug-fix pass.
- **SAR pricing in `packages/config`** — only the internal `cost_usd` *calculation* was fixed.
- **Independent-regen stale `per_member_portions`** — an accepted product decision; verified contained (no crash on the stale entry), not "fixed."
- **Deferred-member manual banner** — user elected to keep current behavior.
- **`next lint` script** — `pnpm lint` fails because `next lint` was removed in Next.js 16 (the CLI treats `lint` as a directory positional). Pre-existing tooling issue, unrelated to these fixes; flagged for a separate cleanup (migrate to direct ESLint). Changed files were linted directly and are clean.
- **`apps/web`** — dead code; left untouched (any removal should be a separate, isolated commit).

---

## Verification performed

- `pnpm type-check`: **clean** across all 6 packages.
- Changed app files (`getLatestPlan.ts`, `dispatch.ts`, `queries.ts`) linted directly with ESLint: **clean**.
- `pnpm build`: **succeeds** (all routes compile).
- Background function (`.mts`, not covered by the app's `**/*.ts` tsc include) type-checked directly: **clean**; confirmed no SDK import added.
- Not done locally: the Netlify esbuild *bundle* of the bg function (produced at deploy by `@netlify/plugin-nextjs`) — but the only additions are a fetch-based `sbInsert` and a string field, so the SDK-free guarantee holds. Behavioral repros (Sonnet cost, translation audit row, stale-plan flip) are described above and should be run against a real Supabase/Anthropic environment before relying on them.

## Closing summary

- **Confirmed fixed & build/type-verified:** model-aware cost pricing, translation-cost logging (+ rate-limit distinct-plan fix), retry/backoff hardening, stuck-`generating` lazy reconciliation.
- **Suspected, not yet runtime-verified:** the three behavioral repros above need a live environment.
- **Needs human/product decision:** structured-allergen safety field (high stakes), empty-shell "usable plan" assertion, silent day omission, webhook event-id dedup, deploy strategy.
- **Blocked on external/live inputs:** Lemonsqueezy live variant IDs; real `/privacy` + `/terms` legal text.
- This audit does **not** assert the codebase is now bug-free.
