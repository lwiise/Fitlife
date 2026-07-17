# Fit Life 2.0 — Build Guidelines for Claude Code

## Product
SaaS nutrition platform for Gulf families. Primary audience: Saudi/Gulf housewives 25-45. Unique angle: ONE subscription serves the whole household including the domestic worker, each in their own language. 7 languages supported. AI-powered personalized meal plans.

## Design Philosophy — READ EVERY TIME
We are NOT building a generic AI landing page. Before writing ANY component, the frontend-design skill must be active and you must apply its 4-dimension framework.

FORBIDDEN patterns (these are AI slop):
- Generic purple gradient on white backgrounds
- Floating glass-morphism cards
- Stock photos of women holding salads
- Center-aligned hero with two stacked buttons
- "Trusted by 10,000+ users" lines
- Inter or Geist font fallbacks (use ONLY Tajawal for Arabic, system-ui as last resort)
- 50/50 symmetric layouts
- Bouncy entrance animations on everything
- Gradient blobs as background decoration

REQUIRED patterns:
- Editorial layout (asymmetric where appropriate)
- Confident, warm, Gulf-native experience
- Arabic-first design (RTL is default, not afterthought)
- Mobile-first (70% of users on phones)
- Real product screenshots, not generic mockups
- Restrained motion (premium feel, not playful)

## Brand
- Primary: #4E2490 (deep purple)
- Accent Yellow: #F2BB16
- Accent Pink: #C5458F
- Lavender: #D9B0FC
- Surface: #EBEFF2 (NEVER pure white)
- Ink: #1A1023 (body text)

## Typography
- Font: Tajawal ONLY
- H1: 48-72px, weight 800, line-height 1.1
- H2: 36-48px, weight 700, line-height 1.2
- H3: 24-32px, weight 700
- Body: 16-18px, weight 400, line-height 1.7 (Arabic needs more line-height)
- NO letter-spacing on Arabic text

## Tone (Arabic Copy)
- Address the woman of the house: "أنتِ"
- Warm but confident, NEVER saccharine
- NO exclamation marks in body copy
- Specific over generic
- Short sentences
- Questionnaire/onboarding copy: clear, warm فصحى (Coach Sara directive, 07/2026) — NOT عامية; feminine أنتِ address retained
- Marketing copy: Gulf norms acceptable (NOT Levantine or Egyptian phrasing)
- Numbers are powerful — lead with figures when possible
- NEVER translate from English; write Arabic-first

## Component Rules
- Sections in src/components/sections/
- Shadcn primitives in src/components/ui/
- React Server Components by default; "use client" only when needed
- Logical Tailwind classes only (start-*, end-*, ms-*, me-*) — NEVER physical (left-*, right-*, ml-*, mr-*)
- No boolean prop proliferation — use composition
- No inline styles

## Accessibility
- Yellow (#F2BB16) NEVER for body text on light bg
- Pink (#C5458F) only for headings 24px+ or large CTAs
- All interactive elements: min 44x44px tap target
- Meaningful Arabic alt text on all images
- Semantic HTML (section, header, nav, article)
- Focus rings visible and on-brand
- All animations respect prefers-reduced-motion

## Performance
- LCP target: under 1.5s
- All images via next/image with explicit width/height
- Above-the-fold: zero client-side JS where possible
- Lighthouse target: 95+ mobile

## Workflow Rule
Before building ANY section, you must:
1. Confirm frontend-design skill is loaded
2. Walk through the 4-dimension framework for that section
3. Wait for my approval of the design direction
4. Then write code

## Architecture Changes Since Original Handoff (May 24-26, 2026)

**Auth method**: Switched from magic-link (passwordless) to email + password. Supabase auth via signInWithPassword and signUp. Forms include both email and password inputs.

**Site architecture**: Merged from two Netlify sites to one unified site.
- Single production site: fitlife-app-mvp.netlify.app
- Landing page lives at apps/app/src/marketing (the live one)
- apps/web (the old standalone landing app) has been REMOVED — it was dead code; the landing is served from apps/app/src/marketing
- Old fitlife-landing.netlify.app site is decommissioned

**Database migration baseline**: Production Supabase has migrations 00001 through 00007 applied (verified 06/09/2026 — 00007 `meal_mode` column confirmed present via a read-only REST probe of `family_members`). Migration 00005 added per-member fields (member_type, sex, allergies, dislikes, trimester, school_meal_handling, picky_eater) and family-wide preferences (cuisine, dietary_restrictions, cooking_methods, meal_out_frequency). Migration 00006 added `chat_messages`; 00007 added `family_members.meal_mode` ('shared' default / 'independent'). Migrations are applied MANUALLY (no CI/Netlify runner) — when adding a migration, apply it to prod yourself. Migrations 00008–00011 (admin_users, profiles.meal_mode, admin audit log), 00012 (superseded by 00014's composite index; see below), 00013 (Coach Sara questionnaire columns: target_weight_kg, day_nature/exercise_days/exercise_type, water_cups, sleep_hours, medications/supplements/nausea_foods jsonb, notes, family_members.feeding_mode, plus the optional deep-dive columns + profiles.deep_dive_completed_at — all nullable/additive, code works before it's applied but new answers won't persist) and 00014 (workout_plans table + workout_profile jsonb + plan_generations.plan_kind/workout_plan_id; REPLACES 00012's lock with UNIQUE (user_id, plan_kind) WHERE status='started' so one meal run and one workout run may coexist — apply BEFORE relying on workout generation) are NOT yet verified against prod — verify/apply before relying on the admin panel, the mom health-save (`profiles.meal_mode`), the generation race fix, or the new questionnaire fields.

**Engagement layer spine (07/2026, Sprint 1)**: Migration 00017 adds the product's first event tables — `meal_checkins` (`local_date` stamped at write time as the universal calendar key, `slot` is extensible TEXT with no CHECK so Ramadan slots later are config not migration), `member_exceptions` (sparse, dish-directed kinds only — child consumption tracking is unrepresentable), `meal_verdicts` (keyed by server-minted `canonical_key` from `canonicalRecipeKey()` in plan-engine — meals have no UUIDs and regen re-words names), `body_logs` (dated weight/waist series; ADULTS ONLY enforced in app code by birth_year, never children). House RLS pattern + updated_at triggers. NOT YET APPLIED to prod — apply manually after 00016, re-run scripts/verify-migrations.sql (now covers 00016–00019), then `pnpm --filter @fitlife/app db:types` to regenerate types (until then, engagement code types rows via `apps/app/src/lib/engagement/types.ts` and untyped client casts — see the export route). /api/account/export includes the four tables (tolerant of pre-apply prod); delete is covered by CASCADE. Design contract in product/engagement-layer-brainstorm.md: unanswered = unknown (never fabricate adherence), rewards attach to rituals/verdicts never adherence counts, no shame states.

**Per-person check-in status (07/2026, owner directive)**: Migration 00019 (apply after 00018) adds `meal_checkins.member_id` ("mom" | family_members.id, same convention as meal_verdicts) and swaps the unique key to (meal_plan_id, day_index, slot, member_id) — 00017's household-level keying is SUPERSEDED: on a shared meal each participant has a separate status (the MealCard tracking section renders one chip row PER PARTICIPANT; the header badge shows the viewed member's own status). Legacy rows keep the `'household'` sentinel and act as a read-time FALLBACK for every member of that meal until a per-member mark supersedes them (the write deletes the household row for that meal); the ختام اليوم `closeDay` action still writes 'household' rows on purpose (whole-kitchen attestation — it has no UI yet). Pre-00019 prod: reads degrade via `select("*")`, writes fall back to the legacy household shape (Sentry warning fires — apply the migration). `computeEngagementDigest` now collapses per-person rows by (local_date, slot) so counts stay MEAL-true (a family of five skipping one dinner is one skip, never five — both digest fetchers select local_date); recap day-cells were already per-date. Statuses are about the dish serving, never amounts — the no-consumption-surveillance stance is unchanged.

**Private journey per adult + body photos (07/2026)**: «رحلتك الخاصة» (/journey) is now PER ELIGIBLE ADULT — `?member=<family_members.id>` (default mom), member switcher chips, per-member weekly cadence and scalar weight mirror (profiles.weight_kg for mom, family_members.weight_kg for members). ONE eligibility rule in `apps/app/src/lib/engagement/eligibility.ts` (plan page + journey page + logBodyWeight action all share it): children NEVER, housekeeper NEVER (same dignity rule as workout plans), under-18 by birth_year never; pregnant/lactating eligible but no loss-framing. The dashboard quick-link was REMOVED — the entry now lives on /plan as a per-member-tab card (PlanViewer `journeyMembers` prop; interactive page only, never history/housekeeper/PDF). Migration 00018 (NOT YET APPLIED, after 00017): `body_logs.photo_path` + PRIVATE `body-photos` storage bucket (5MB, jpeg/png/webp, owner-scoped storage.objects policies by first path segment `<user_id>/`). Photos upload browser→bucket directly, render ONLY via short-lived signed URLs on /journey behind a masked-by-default reveal (plain `<img>` on purpose — the next/image optimizer would cache private photos), and never appear in messages/recap/share cards/admin. PDPL: storage does NOT cascade — `eraseUserAccount()` removes the `<user_id>/` folder explicitly (best-effort, before auth delete); /api/account/export attaches 24h signed `photo_url` per log (best-effort, pre-apply tolerant). Weight-only saves still work pre-00018 (photo_path key is omitted when absent).

**Onboarding restructure (Prompt 1.8c)**: 5 family-wide questions → Mom's personal questions → sequential per-member additions with branched wizards (adult/child/pregnant/lactating). Solo plans hide member tabs.

**Coach Sara questionnaire (07/2026)**: Mom's flow is now 10-11 adaptive steps (step-key array). `activity_level` is DERIVED in `apps/app/src/lib/plans/activityLevel.ts` from the concrete day-nature × exercise-days answers (12-row table matching the Saudi MOH calculator buckets/multipliers already in SARA_METHODOLOGY); raw answers stored alongside. UI goals are the coach's six (`lose_weight/build_muscle/recomposition/maintain_weight/athletic/improve_health` → canonical incl. promoted `maintain`/`general_health`). New per-person fields (target weight, exercise, water, sleep, meds/supplements, mom notes, pregnancy nausea_foods, lactation feeding_mode) thread DB → buildContext (+ the bg function's SDK-free mirror) → skeleton roster clauses; ONLY meds+nausea repeat in day prompts. Optional deep-dive screen at /profile/deep-dive (dashboard banner + profile card) fills the full-questionnaire extras into a skeleton-only lifestyle block. Onboarding server actions are zod-validated via `onboarding/serverSchemas.ts`; the level is always re-derived server-side.

**Workout plans (07/2026, meals-first fork)**: meals and exercise are SEPARATE plans. Onboarding ends at `/onboarding/plan-scope` — "وجبات فقط" (previous path) or "وجبات وتمارين معاً" (7 workout questions per opted-in adult at `/onboarding/workout`, stored as `workout_profile` jsonb; children/housekeeper never eligible). Combined generation: `maybeTriggerWorkoutGeneration` fires from `generateSoloAndContinue`/`syncFamilyPlanAfterSubscribe` (regardless of the meal result; idempotent under 00014's per-kind lock). Engine: `packages/plan-engine/src/workout/` — WORKOUT_METHODOLOGY is an ACSM/NSCA-grade resistance-training block authored in-house (فصحى, cached-static, ACOG-aligned pregnancy + injury safety rules; PENDING Coach Sara review — swap text, not code). Two-phase: skeleton (split+sessions, SKELETON_MODEL) → one full-week expansion per member (DAY_MODEL). Same background function via `mode:"workout"` (own idempotency probe by workout_plan_id); status at `/api/plans/workout/status` (the meal status route is untouched — 3 pollers depend on its shape); viewer via `/plan?view=workout` toggle + `WorkoutViewer`. Post-onboarding opt-in: dashboard banner + profile entry → immediate dispatch. v1: no manual workout regenerate (edit answers → next combined trigger); /plan/history stays meal-only; workout available on all paid tiers; admin per-plan cost map excludes workout rows (spend still lands in totals).

**Exercise form animations (07/2026)**: every exercise row in `WorkoutViewer` taps open a brand-colored Lottie form guide. Fixed catalog `packages/plan-engine/src/workout/exerciseCatalog.ts` (57 ids + `FALLBACK_BY_PATTERN`): the roster is embedded in the cached `WORKOUT_STATIC`, the model MUST emit `exercise_id` (+ `home_variant_id` for location="both") from it; unknown ids are nulled log-only (`normalizeExerciseIds`) so runs never fail — id-less exercises just don't expand (old plans keep rendering). Assets are generated IN-REPO (no licensing): `apps/app/scripts/lottie-exercises/` (parametric figure rig → Lottie JSON; QA via headless-Chromium screenshot sheets) → `apps/app/public/lottie/exercises/<id>.json` (~13 KB each, lazy-fetched per expanded row by `ExerciseLottie.tsx` via `lottie-web` light build; reduced-motion → still frame + play). `exerciseAnimations.test.ts` keeps catalog↔files in lockstep — run `node scripts/lottie-exercises/generate.mjs` after editing the catalog or poses. **Meals-first sequencing**: the workout background run holds while a meal generation is live (`mealGenBlocksWorkout` polled every 10 s, 8-min cap, stale >15 min ignored) so meals always get the full API budget; `/api/plans/workout/status` exposes `waiting_for_meals` and the generating card shows «نجهّز وجباتك أولاً».

**AI generation**: Day-by-day streaming, incremental per-member updates that don't wipe existing family plans when adding/editing one member.

**Plan engine package**: Lives at packages/plan-engine (was originally inline in apps/app).

**Settings page**: PDPL compliance shipped — /settings has account info + data export + immediate hard-delete via typed-confirmation modal. Public routes /privacy and /terms exist with placeholder Markdown content (needs real legal text before scaling).

**Sara's Cookbook Inspiration (Prompt 3.3a)**: The AI system prompt now includes a structured profile of Sara's "كنز الوصفات الصحية" cookbook (101 recipes, high-protein/no-sugar/no-refined-flour). Recipes are NOT extracted verbatim from the PDF — instead, the AI generates fresh recipes that align with the cookbook's style, ingredient palette, and constraints. The block lives in `packages/plan-engine/src/systemPrompt.ts` as `SARA_COOKBOOK`, appended to the cached `STATIC_SYSTEM` after Sara's methodology (methodology takes precedence for medical/pregnancy needs). A non-fatal log-only guard in `generate.ts` warns on refined-flour/sugar deviations. PDF source (if added) lives in `product/sara-cookbook.pdf` for reference but is not parsed at runtime.

**Server Actions encryption key (ops — must stay set)**: Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (stable, base64 32-byte) in Netlify env for the fitlife-app-mvp site AND in local `.env.local`. Without it, Next.js generates a random server-actions key per build, so every deploy invalidates already-open tabs → saves fail with `UnrecognizedActionError: Server Action was not found on the server` (full-page error). Keep the value STABLE across deploys; rotating it breaks server actions for any open tab. Generate once with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. (Note: the repo's background `auto:` commit hook deploys frequently, which amplifies skew — a stable key is what keeps server actions working across those deploys.)

## Current Database Schema (verified 05/26/2026)

Point-in-time snapshot of the **production** `public` schema (from `information_schema.columns`).
This prose table is a human-readable reference for column names. `ARRAY` = Postgres array
(`text[]`). `nullable` maps `is_nullable` (YES→yes / NO→no).

**`database.types.ts` is now GENERATED, not hand-maintained.** Regenerate it from the schema
with `pnpm --filter @fitlife/app db:types` (runs `supabase gen types typescript --local`) — do
NOT edit `apps/app/src/lib/supabase/database.types.ts` by hand. The generated file is the typed
source of truth used by the code; the snapshot below is just documentation.

### family_members

| column_name | data_type | nullable |
| --- | --- | --- |
| id | uuid | no |
| user_id | uuid | no |
| name | text | no |
| role | text | no |
| birth_year | integer | yes |
| weight_kg | numeric | yes |
| height_cm | numeric | yes |
| activity_level | text | yes |
| primary_goal | text | yes |
| preferred_language | text | no |
| dietary_restrictions | ARRAY | yes |
| medical_conditions | ARRAY | yes |
| display_order | integer | no |
| created_at | timestamp with time zone | no |
| updated_at | timestamp with time zone | no |
| member_type | text | no |
| sex | text | yes |
| consulted_doctor | boolean | yes |
| allergies | jsonb | yes |
| dislikes | jsonb | yes |
| trimester | integer | yes |
| months_postpartum | integer | yes |
| high_risk_pregnancy | boolean | yes |
| school_meal_handling | text | yes |
| picky_eater | boolean | yes |

### meal_plans

| column_name | data_type | nullable |
| --- | --- | --- |
| id | uuid | no |
| user_id | uuid | no |
| status | text | no |
| generated_at | timestamp with time zone | yes |
| error_message | text | yes |
| plan_data | jsonb | yes |
| ai_model | text | yes |
| ai_input_tokens | integer | yes |
| ai_output_tokens | integer | yes |
| ai_generation_seconds | numeric | yes |
| created_at | timestamp with time zone | no |
| updated_at | timestamp with time zone | no |

### plan_generations

| column_name | data_type | nullable |
| --- | --- | --- |
| id | uuid | no |
| user_id | uuid | no |
| meal_plan_id | uuid | yes |
| ai_input_tokens | integer | no |
| ai_output_tokens | integer | no |
| estimated_cost_usd | numeric | no |
| status | text | no |
| failure_reason | text | yes |
| created_at | timestamp with time zone | no |
| model | text | yes |
| tokens_in | integer | yes |
| tokens_out | integer | yes |
| cost_usd | numeric | yes |
| duration_ms | integer | yes |
| error_message | text | yes |
| started_at | timestamp with time zone | no |
| completed_at | timestamp with time zone | yes |

### profiles

| column_name | data_type | nullable |
| --- | --- | --- |
| id | uuid | no |
| display_name | text | yes |
| preferred_language | text | no |
| birth_year | integer | yes |
| weight_kg | numeric | yes |
| height_cm | numeric | yes |
| activity_level | text | yes |
| primary_goal | text | yes |
| cuisine_preference | text | no |
| dietary_restrictions | ARRAY | yes |
| has_medical_conditions | boolean | no |
| medical_conditions | ARRAY | yes |
| is_pregnant | boolean | no |
| pregnancy_trimester | integer | yes |
| consulted_doctor | boolean | no |
| onboarding_completed_at | timestamp with time zone | yes |
| created_at | timestamp with time zone | no |
| updated_at | timestamp with time zone | no |
| sex | text | yes |
| member_type | text | no |
| allergies | jsonb | yes |
| dislikes | jsonb | yes |
| months_postpartum | integer | yes |
| high_risk_pregnancy | boolean | yes |
| family_dietary_restrictions | jsonb | yes |
| family_dislikes | jsonb | yes |
| cooking_methods | jsonb | yes |
| meal_out_frequency | text | yes |
| family_wide_completed_at | timestamp with time zone | yes |
| mom_profile_completed_at | timestamp with time zone | yes |
| member_addition_order | jsonb | yes |

### subscriptions

Both the legacy `ls_*` columns (+ `billing_interval`) and the 00004 `lemonsqueezy_*` (+ `cadence`,
`trial_started_at`, `cancel_at_period_end`) columns coexist. Current code reads/writes the
`lemonsqueezy_*` + `cadence` set; the `ls_*` + `billing_interval` columns are legacy.

| column_name | data_type | nullable |
| --- | --- | --- |
| id | uuid | no |
| user_id | uuid | no |
| ls_subscription_id | text | yes |
| ls_customer_id | text | yes |
| ls_variant_id | text | yes |
| ls_order_id | text | yes |
| tier | text | no |
| status | text | no |
| billing_interval | text | yes |
| current_period_start | timestamp with time zone | yes |
| current_period_end | timestamp with time zone | yes |
| trial_ends_at | timestamp with time zone | yes |
| cancelled_at | timestamp with time zone | yes |
| ends_at | timestamp with time zone | yes |
| created_at | timestamp with time zone | no |
| updated_at | timestamp with time zone | no |
| cadence | text | yes |
| trial_started_at | timestamp with time zone | yes |
| cancel_at_period_end | boolean | no |
| lemonsqueezy_subscription_id | text | yes |
| lemonsqueezy_customer_id | text | yes |
| lemonsqueezy_variant_id | text | yes |
