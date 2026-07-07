# Fit Life 2.0 — Correctness Audit

Date: 2026-05-29 · Scope: correctness/security/reliability of the live app (`apps/app`), the AI engine (`packages/plan-engine`), and the Netlify background function. Read-only investigation across generation/reliability, billing/security, and onboarding/translation/locale, followed by a targeted, low-risk fix pass.

**Honesty note:** this is not a claim that the codebase is bug-free. It records what was verified, what is suspected, what needs a human/product decision, and what is blocked on external inputs. Several items are deliberately left for sign-off rather than "fixed."

Classification: **CONFIRMED** (traced/reproducible) · **SUSPECTED** (looks wrong, needs verification) · **SMELL** (works, but fragile). Severity: **S0** correctness/security/data · **S1** reliability · **S2** UX correctness · **S3** cleanup.

---

## 2026-07-03 pass — deep engineering scan (post-admin-panel)

Scope: everything landed since the 05-29 pass (~116 commits, dominated by the /admin panel, migrations 00008–00011, chat, meal_mode). Three parallel deep scans (backend/admin/billing · engine/background-function/dispatch · frontend/config/migrations), findings re-verified first-hand before fixing. **No S0 found** — RLS (admin tables deny-all by design), HMAC, secret handling, admin gating, and service-role double-filtering all check out. Baseline was fully green before the pass (type-check, lint, 262 tests, build).

### Fixed this pass

- **[S1 · CONFIRMED] Generation-dispatch TOCTOU race.** The busy-guard (`dispatch.ts`) read `plan_generations status='started'` then acted; nothing at the DB backed it, and `DeferredMemberDrain` polls every 2.5 s on BOTH /plan and /dashboard — two tabs or poll-vs-refresh lag ran TWO full generations (2× Anthropic spend, competing plans). **Fix:** migration `00012` partial unique index (one `started` row per user, with defensive dedup); `createPlanRows` maps 23505 → archives its placeholder (not `failed` — that would flash the failure UI over the healthy run) and throws `GenerationInFlightError`; dispatch maps it to the existing `busy`; the drain client latches after `fired||busy` and resets when server `generating` flips. Code degrades byte-identically until 00012 is applied to prod (manual!).
- **[S1 · CONFIRMED] Background function not idempotent.** A replayed/duplicate invocation re-ran a full generation. **Fix:** pure `generationAlreadySettled` predicate + SDK-free probe at the top of generate mode → `200 "Already settled"` no-op; probe failure is non-fatal (never drops a legit run).
- **[S1 · CONFIRMED] `/api/checkout` had no already-subscribed guard** — an active subscriber completing a second checkout got a SECOND live LS subscription (webhook tracks only the newest; the first keeps billing, uncancellable from the UI; masked today by test-mode variant IDs). **Fix:** `hasLiveLemonsqueezySubscription` (active/trialing unexpired, or past_due, AND carrying an LS id) → 409 with Arabic message; trials (no LS id) and lapsed/cancelled/expired still check out.
- **[S1 · CONFIRMED] Destructive admin actions proceeded when the audit write failed** (`logAdminAccess` swallows errors; delete ran an irreversible PDPL erasure regardless). **Fix:** `logAdminAccessRequired` returns `{ok}` + Sentry; deactivate/reactivate/delete audit FIRST and abort with a `?error=audit_failed` banner (ar/en) when the trail can't be written. View logging stays best-effort.
- **[S1 · CONFIRMED] `generate-plan-background.mts` was never type-checked** (tsconfig `**/*.ts` doesn't match `.mts`; esbuild strips types unchecked). **Fix:** added to the app tsconfig include — a type error there now fails CI. Also fixed the anonymous-default-export lint warning (lint is 0-warning now).
- **[S2 · CONFIRMED] `/admin/login` unreachable when logged out** — the proxy bounced it to the consumer `/auth/login`, contradicting the page's own public contract. **Fix:** exempted from the unauthenticated redirect only (still gets session refresh so signed-in admins bounce to /admin).
- **[S2 · CONFIRMED] RTL violation in the vendored marketing button** — physical `pl-/pr-` keyed to *logical* `inline-start/end` icon slots (wrong side under RTL; variants currently dormant). **Fix:** `ps-/pe-`.
- **[S2] No route-level loading states** on dashboard/plan/plan-history/profile/settings/subscription/chat. **Fix:** static RSC `loading.tsx` skeletons mirroring each page's chrome (logical utilities; reduced-motion already handled globally).
- **[S2] Chat stream timeout (240 s engine default) outlived the route's `maxDuration=60`** — platform-killed turns lost their usage-audit row. **Fix:** `timeoutMs: 55_000`.
- **[S3] Cleanup batch:** deleted dead `getCurrentUserMealPlan`/`getCurrentUserSubscription` (the latter filtered on the obsolete `on_trial` status — a trap if rewired); translation retry loops now use `retryWaitMs` (honor `Retry-After`) like the day loop, `backoffMs` deleted; admin date formatters pinned `timeZone:"UTC"` to match the UTC bucketing (+ edge-timestamp regression tests); `@fitlife/config` exports map gained `./pricing`; dead `@fitlife/ui` package removed entirely (dep + transpilePackages too); `shadcn` CLI → devDependencies; vitest got the CI's placeholder `NEXT_PUBLIC_*` env so server-module tests run.

### Addendum (2026-07-07) — data-integrity fixes shipped with the Coach Sara questionnaire pass

- **[S1 · CONFIRMED] Lactating supplements corrupted medical_conditions.** The wizard's supplements answer flowed through `other_condition` into `medical_conditions`, so the AI read "حديد، فيتامين د" as a medical condition. Now a structured `supplements` jsonb column (00013) + chips UI.
- **[S2 · CONFIRMED] Feeding mode collected but never persisted** — `buildMemberRow` had no field. Now `family_members.feeding_mode` (00013), threaded to the prompt (scales the lactation calorie addition).
- **[S2 · CONFIRMED] Pregnancy nausea foods stored as allergies.** Now a separate `nausea_foods` column rendered as TEMPORARY avoidance, distinct from the hard-avoid allergy clause. Existing rows keep old chips in `allergies` (over-strict, safe direction; no backfill).
- **[S3] Activity-label mismatch closed deterministically**: `activity_level` is now derived in code (`lib/plans/activityLevel.ts`) from concrete answers, and `ACTIVITY_LABELS_AR` uses the exact MOH bucket wording the methodology's multiplier table uses.
- Onboarding server actions were previously un-validated server-side (typed trust only); now zod-validated (`onboarding/serverSchemas.ts`), including a strict whitelist on the progressive `saveProfileStep` update object.

### Addendum (2026-07-07) — workout feature notes
- Workout generation audit rows live in `plan_generations` with `plan_kind='workout'`/`workout_plan_id` (meal_plan_id stays null, so the meal weekly quota is untouched). Admin cost TOTALS include workout spend automatically; the per-plan cost map in `lib/admin/detail.ts` keys on meal_plan_id and silently excludes workout rows — accepted v1 gap.
- v1 ships no manual workout regenerate button, so no workout quota exists yet; add `canGenerateWorkoutPlan` before exposing one.
- 00014 REPLACES 00012's in-flight lock (composite user_id+plan_kind). Apply 00014 before deploying workout dispatch.

### Flagged — needs ops/product action (NOT coded)

1. **Apply migrations 00012 AND 00013 to prod** (manual, no runner). 00012: until applied, the race fix is dormant and behavior is unchanged. 00013: additive/nullable — the app runs before it's applied, but new questionnaire answers won't persist until it is.
2. **Verify 00008–00011 are applied to prod.** CLAUDE.md's verified baseline stops at 00007. The admin panel fails closed without 00008/00010/00011, but **`saveMomHealthInfo` writes `profiles.meal_mode` (00009) — if missing, every mom health-profile save fails.** Probe read-only (same method as the 00007 check), e.g. `GET /rest/v1/admin_users?select=user_id&limit=1` with the service key.
3. **Admin roles unenforced** (`support` can delete accounts) — documented v1 choice in 00008; restrict destructive actions to `super_admin` when product decides.
4. **Concurrent same-locale translations** can duplicate-write `plan_data` (converges correct, wastes Haiku spend) — best-effort 25 s dedup accepted.
5. **Chat accepts client-supplied `assistant` history** and free-text household fields are interpolated into prompts — self-scoped (RLS-bounded context, schema-validated output); optional hardening later.
6. Pre-existing: LS variant IDs still test-mode; deploy-strategy ops recommendation stands.

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

## Fixed — batch 2

Three of the previously-flagged items, cleared for implementation. Surgical diffs only; no refactors, no dep/version bumps, no pricing-number or `STATIC_SYSTEM`/methodology/`SARA_COOKBOOK` edits; security/privacy invariants preserved. Items #1 and #2 below (in "Flagged") are now addressed; the original flag text is kept for traceability with a resolution note.

### [S0 · CONFIRMED] Fix A — Cook-facing allergy backstop (maid view) — addresses flag #4, Layer 1
The maid view rendered recipes with no DB-sourced allergy reminder; "omit X for [member]" lived only in generated prose. Per product/clinical caution, added a display-only safety panel sourced **directly from the DB** — never from recipe prose or `plan_data`.
**Fix:** new `AllergyBackstop.tsx` (display-only, read-only, no schema change, no AI call) rendered in `HousekeeperPlanView` **unconditionally** (even while the plan is still translating, since it's safety-critical), before the loader/`PlanViewer`. The housekeeper page (`plan/housekeeper/page.tsx`) now also fetches the mom's profile and builds `allergyEntries` from `profiles.allergies` (mom) + each `family_members.allergies`, coerced via the existing `asStringArray`, filtered to members with ≥1 allergen. Allergen strings + names are **rendered verbatim** (`dir="rtl" lang="ar"`) — they are free-text Arabic, NOT an enum, so auto-translation could distort a safety-critical term; only the warning chrome is localized (`allergy_title`, `allergy_for` across all 7 locales). High-contrast on-brand alert (pink/ink, never yellow body text); `role="note"`, semantic heading.
**Scope note / follow-ups:** the optional inline per-`MealCard` allergen annotation is NOT built (needs threading allergy data + member-id matching through `PlanViewer`→`MealCard` — beyond a surgical diff). An allergen **enum migration** (which would enable safe per-locale allergen translation) is also flagged as a follow-up. This pass ships the Layer-1 panel only.
**Verify:** maid view with a member that has allergies → panel lists them verbatim, chrome in the maid's locale, visible even while translating; member with no allergies → omitted; no allergies anywhere → no panel.

### [S2 · CONFIRMED] Fix B — "Usable plan" now requires non-empty meals — resolves flag #1
A plan can be `status='ready'` with empty `meals` arrays (the shell flips `ready` on the first progress emit). Every "show plan vs loading" decision now gates on actual content.
**Fix:** added a pure predicate `planHasContent(plan): boolean` to `packages/plan-engine` (true iff some member has some day with `meals.length > 0`), exported via the barrel. Applied in three read sites: `getTodaysPlanView` (a `ready` plan with no content returns `generating`), `dashboard/page.tsx` (the "نشطة/active" card shows only when `ready && hasContent`; `ready && !hasContent` is treated as generating), and `plan/housekeeper/page.tsx` (redirect to `/plan` when there's nothing to cook yet). The progressive shell-flip (`generate.ts`) and the `/plan` `PlanViewer` per-day loading are deliberately **untouched**.
**Verify:** a `ready` plan whose today/day has empty meals → dashboard shows generating (not "نشطة"); `getTodaysPlanView` returns generating; housekeeper page redirects.

### [S3 · CONFIRMED] Fix C — Sub-7-day plans no longer ship silently — resolves flag #2
A day that fails after retries was dropped silently, yielding a <7-day plan with no signal. Good days are still kept (the run isn't failed), but partials are now both auditable and visible.
**Fix (engine):** `generateMealPlan` tracks `failedDays` and returns `missingDays: number[]`. Both completion paths — `runMealPlanGeneration` (`generate.ts`) and the production Netlify background function (`generate-plan-background.mts`) — write a **PII-safe** note (`"partial: days [2, 5] failed"`, day indices only) onto the **completed** `plan_generations.error_message` (status stays `completed`; the CHECK allows only started/completed/failed, so no migration) plus a `console.warn` with indices only.
**Fix (UI):** `PlanViewer` now renders a DISTINCT `day_failed` state (localized × 7) when the plan is **not** generating and the active day has no meals — visually separate from "preparing"/"queued" — surfacing the **existing** regenerate control when `!readOnly`. Day-scoped regeneration is NOT built (flagged as a follow-up; reuses the whole-member regenerate).
**Verify:** simulate a dropped day (final plan, `generating=false`, one day empty) → PlanViewer shows the distinct `day_failed` state (regenerate CTA when not read-only); `plan_generations.error_message` carries `partial: days [...]`.

### Report-only after investigation (flags #5 and #7 — encryption key)
Two flagged items were investigated for a scoped code fix and deliberately **left uncoded** (evidence below). The user reviewed and chose report-only for both.

- **Flag #5 — Webhook idempotency → no code.** All 6 handlers in `webhooks/lemonsqueezy/route.ts` are value-idempotent pure field overwrites (no counters, inserts, emails, or credit grants). The LS payload exposes **no unique event/delivery id** — `payload.data.id` is the *resource* id (the subscription id), which legitimately repeats across `subscription_updated`/`_cancelled`/`_expired`. A `(event_name, resource_id)` dedup key would therefore wrongly drop legitimate recurring events — strictly worse than today's harmless replays. No migration, no table, no code change.
- **Flag #7 (encryption-key half) — `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` → no code.** Nothing in the codebase generates or defaults the key (no `randomBytes`/`||` fallback); Next.js consumes it internally at build time (`env.ts` never references it). The scoped "convert fallback → fail-fast" has nothing to convert. The mitigation is the ops one already documented in `CLAUDE.md` (set a stable base64-32-byte value in Netlify env; never rotate it across deploys).

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

1. **[RESOLVED — batch 2, Fix B] `status='ready'` empty shell.** Status flips to `ready` on the first `onProgress` emit (`generate.ts:436,645`), a shell with days-but-fewer-meals. ~~Recommend a `meals.length > 0` assertion on the "usable plan" check rather than changing the progressive-loading UX.~~ → Done: `planHasContent` now gates `getTodaysPlanView`, the dashboard active card, and the housekeeper page. See "Fixed — batch 2 · Fix B".
2. **[RESOLVED — batch 2, Fix C] Silent day omission.** A day that fails validation after retries was logged and dropped (`generate.ts:514-520`), yielding a <7-day plan with no user-facing signal. ~~Recommend surfacing a partial-plan indicator.~~ → Done: `missingDays` recorded PII-safely on the completed `plan_generations` row; `PlanViewer` shows a distinct `day_failed` state with regenerate. See "Fixed — batch 2 · Fix C".
3. **[RESOLVED — auto-generation] Deferred-member drain.** Members added during an in-flight generation were previously deferred to a *manual* dashboard banner (`GenerateFamilyPlanBanner`) that the user had to click. → Done: the manual CTA + its `generateFamilyPlan` action were removed; added members now auto-generate (immediately when idle, or auto-start via `DeferredMemberDrain` once the in-flight run completes). The dashboard shows a passive "being created" notice, or — only when the household exceeds the tier's people limit (`canGenerateForFamilyChange`) — an upgrade prompt.
4. **[PARTIALLY ADDRESSED — batch 2, Fix A (Layer 1); deeper layers still need sign-off] Allergy/medical translation.** Allergens flow as **structured prompt constraints** per member ("حساسية (تجنّب تام)") at generation time (`systemPrompt.ts:624-646`); translation is procedural (translates `prep_steps_ar`, doesn't re-derive constraints). So today's flow is safe **iff** the allergy data is recorded in the DB. The residual risk is that "omit X for [member]" lives only in generated prose, not as a machine-checked field on the recipe/portion. → **Layer 1 shipped (Fix A):** a DB-sourced, display-only allergy backstop in the maid view (verbatim allergens, localized chrome) so the cook always sees every beneficiary's recorded allergies regardless of recipe prose. **Still recommended (do not ship without product/clinical sign-off):** the deeper layer — a structured `excluded_allergens`/`member_safety_notes` field on the meal/`per_member_portion` so per-locale rewrites can never soften or drop it, plus a render-time assertion — and the allergen-enum migration that would enable safe per-locale allergen translation. Flagged given real-world harm potential.
5. **[REPORT-ONLY — batch 2; investigated, no code per user decision] Webhook idempotency.** HMAC + event handling are correct. All 6 handlers are value-idempotent pure field overwrites; the LS payload exposes no unique event/delivery id (`payload.data.id` is the resource/subscription id, which legitimately repeats across events), so a `(event_name, resource_id)` dedup key would wrongly drop legitimate recurring events — worse than today's harmless replays. No migration/table/code. See "Fixed — batch 2 · Report-only".
6. **[BLOCKED on external inputs] Lemonsqueezy variant IDs are test-mode** (`packages/config/src/pricing.ts:12`). Real charges blocked until live IDs + env-based switching are set. Do not invent IDs.
7. **[FLAGGED — ops] Deploy-on-every-commit + `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.** Frequent auto-deploys risk (a) landing on in-flight 15-min generations and (b) invalidating open tabs (`UnrecognizedActionError`) if the key isn't a stable env var. Recommend scheduled/manual deploys and verifying the key is sourced from a stable env var (per CLAUDE.md it must be set + stable). → **Encryption-key half is REPORT-ONLY (batch 2, per user decision):** there is no code fallback/`randomBytes` default to convert to fail-fast — Next.js consumes the key internally at build time and `env.ts` never references it. The only mitigation is the existing ops one (stable Netlify env var). No code. See "Fixed — batch 2 · Report-only". The deploy-strategy half remains an open ops recommendation.

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

**Batch 1:**
- `pnpm type-check`: **clean** across all 6 packages.
- Changed app files (`getLatestPlan.ts`, `dispatch.ts`, `queries.ts`) linted directly with ESLint: **clean**.
- `pnpm build`: **succeeds** (all routes compile).
- Background function (`.mts`, not covered by the app's `**/*.ts` tsc include) type-checked directly: **clean**; confirmed no SDK import added.
- Not done locally: the Netlify esbuild *bundle* of the bg function (produced at deploy by `@netlify/plugin-nextjs`) — but the only additions are a fetch-based `sbInsert` and a string field, so the SDK-free guarantee holds. Behavioral repros (Sonnet cost, translation audit row, stale-plan flip) are described above and should be run against a real Supabase/Anthropic environment before relying on them.

**Batch 2 (Fixes A/B/C):**
- `pnpm type-check`: **clean** across all 6 packages (caught and fixed one missing `missingDays` on `generateMealPlan`'s fast-path return).
- Changed app files linted directly with ESLint: **clean** (`PlanViewer.tsx`, `AllergyBackstop.tsx`, `HousekeeperPlanView.tsx`, `plan/housekeeper/page.tsx`, `getTodaysPlanView.ts`, `dashboard/page.tsx`, `locales.ts`). `packages/plan-engine` has no standalone ESLint config (covered by tsc).
- Background function (`generate-plan-background.mts`) re-type-checked directly after the `missingDays` wiring: **clean**; confirmed still no SDK import. The bg function is the production generation path, so Fix C's partial-note write was applied there as well as in `runMealPlanGeneration`.
- Not run locally: `pnpm build` and the Netlify esbuild bundle; manual A/B/C repros (described per-fix above) need a live Supabase/Anthropic environment.

## Closing summary

- **Batch 1 — confirmed fixed & build/type-verified:** model-aware cost pricing, translation-cost logging (+ rate-limit distinct-plan fix), retry/backoff hardening, stuck-`generating` lazy reconciliation.
- **Batch 2 — confirmed fixed & type-verified:** Fix A cook-facing allergy backstop (Layer 1, DB-sourced, verbatim), Fix B `planHasContent` gating, Fix C partial-day surfacing (PII-safe audit note + distinct `day_failed` UI). Manual repros pending a live environment.
- **Investigated, deliberately report-only (batch 2, user decision):** webhook event-id dedup (no unique LS id; idempotent handlers) and the `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` half (no code fallback to convert; ops mitigation only).
- **Still needs human/product decision:** the deeper structured-allergen safety field + render-time assertion + allergen-enum migration (high stakes); inline per-`MealCard` annotation and day-scoped regenerate (follow-ups).
- **Blocked on external/live inputs:** Lemonsqueezy live variant IDs; real `/privacy` + `/terms` legal text.
- This audit does **not** assert the codebase is now bug-free.
