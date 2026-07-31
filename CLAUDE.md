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
- Address the woman of the house: "أنتِ" — this is the DEFAULT voice, not the only one. Owner-directed copy on authenticated surfaces inflects for the answered الجنس via `genderPick(ownerSex)` (`apps/app/src/lib/copy/gender.ts`): pass `profiles.sex` for "you" copy, a member's sex for text about that member. Feminine is the fallback for null (question unanswered, legacy profile, logged-out visitor), so marketing/pre-signup copy stays feminine. NEVER dual-write ("اختاري/اختر") — pick one form per string pair.
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

**PAYMENT IS CURRENTLY OFF IN PRODUCTION (07/2026, owner directive — temporary, pre-launch testing)**: `NEXT_PUBLIC_FREE_ACCESS_MODE = "1"` is set in `apps/app/netlify.toml` `[build.environment]`, so every paid capability is open to everyone: no subscription needed (expired trials included), unlimited household members, unlimited plan generations, advisor chat open, no post-onboarding bounce to /pricing, and no trial countdown banner. Every gate reads the ONE predicate `isFreeAccessMode()` (`apps/app/src/lib/subscription/freeAccess.ts`) — grep it for the complete list. **To take payments again: delete that one line from netlify.toml and redeploy.** Nothing else was loosened, so there is no second thing to remember. The LemonSqueezy checkout + webhooks are deliberately untouched and stay testable while the mode is on, as is the advisor's 30-messages/day cap (cost protection, not a paywall). Cost note: the weekly generation limits are a spend guard, and every generation is a paid Anthropic call — unlimited generations means unlimited AI spend while this is on. A «وضع الاختبار» badge renders on every page so the mode cannot be silently forgotten. Guarded by `freeAccess.test.ts`, whose most important assertion is that the mode is OFF for any value other than exactly `"1"`.

**Auth method**: Switched from magic-link (passwordless) to email + password. Supabase auth via signInWithPassword and signUp. Forms include both email and password inputs. **Password recovery exists as of the 07/2026 audit** — «نسيت كلمة المرور» on the login form → `resetPasswordForEmail` → `/auth/callback?type=recovery` → `/auth/update-password`. Before that there was NO reset path at all, so a forgotten password was permanent lockout of a paid account and the only operator tools were deactivate or delete. `/auth/update-password` is reached WITH a live recovery session, so proxy.ts exempts it from the "signed-in users get bounced off /auth/*" redirect, alongside `/auth/callback` and `/auth/logout`. Requires the Supabase recovery email template to be configured.

**Site architecture**: Merged from two Netlify sites to one unified site.
- Single production site: fitlife-app-mvp.netlify.app
- Landing page lives at apps/app/src/marketing (the live one)
- apps/web (the old standalone landing app) has been REMOVED — it was dead code; the landing is served from apps/app/src/marketing
- Old fitlife-landing.netlify.app site is decommissioned
- **apps/landing (07/2026, owner directive)**: a SEPARATE standalone one-page sales site for the «باقة التحوّل الشاملة» bundle offer (Salla checkout + WhatsApp invoice flow, 888 ر.س). Deliberately NOT connected to the app/website — no shared runtime code, no auth/analytics/Supabase; brand tokens are copied, not imported. Deploys on its own (Vercel, root dir apps/landing); CI builds it via `pnpm build:landing`. Pre-launch placeholders (Salla URL, logo, socials, OG image) are listed in apps/landing/README.md. Does not change the "single production site" status of the SaaS app above.
- **/landing route on the production site (07/2026, owner directive)**: the SAME bundle-offer page is ALSO served at fitlife-app-mvp.netlify.app/landing so it lives on the existing domain. Implementation: `apps/app/src/marketing/bundle/` (sections + config + page-local ui: badge/card/shimmer-button/number-ticker) composed by `apps/app/src/app/landing/{layout,page}.tsx` — its own thin layout (DirProvider only; NOT the (marketing) group, whose ScrollToTop FAB would collide with the page's mobile sticky purchase bar). `/landing` is in proxy.ts `isPublicRoute`. Offer gold tokens (`gold-500`/`gold-700`), the whatsapp color, shimmer keyframes and `bg-hero-spotlight` were added to apps/app globals.css. The page shares the app's Tajawal/RTL/brand tokens + the marketing accordion, but links nowhere into the SaaS funnel (WhatsApp only in Steps + Footer). **Checkout (07/2026)**: Salla's fast-checkout widget (store 1502078372 / product 1893963313, `SALLA` in `marketing/bundle/config.ts`), script loaded `lazyOnload` from the /landing layout. Two purchase points mount the widget (hero + `#checkout` finale); header/ledger-strip/sticky-bar CTAs are anchors to `#checkout` rather than extra widget instances. A custom element whose script fails to load renders NOTHING, so every slot ships a fallback button that CSS reveals via `.salla-slot:has(salla-mini-checkout-widget:not(:defined))` — set `SALLA.productUrl` to turn that fallback from a WhatsApp hand-off into a direct checkout link. NOTE: apps/landing and marketing/bundle are two copies of the same page — edits must be mirrored (or one of them retired) until the owner picks a single home.

**Bundle-page motion system (07/2026, owner directive «premium/animated»)**: one motion vocabulary for the whole offer page — `--ease-settle` as the ONLY curve, `--dur-fast/base/slow` (220/520/700ms) and `--reveal-stagger` (90ms) in globals.css; nothing hard-codes a timing. Scroll reveals are CSS-first, NOT Framer Motion: `Reveal` (bundle/`Reveal.tsx`, mirrored at landing `components/motion/Reveal.tsx`) is a SERVER component that only stamps `data-reveal` + a static `[--reveal-delay:*]` class, and one inline `RevealBootstrap` script in each page's layout runs a single shared IntersectionObserver. **The markup ships VISIBLE**: the rules that hide a section live ONLY in the stylesheet that script injects, and it injects nothing without an observer, under reduced motion, or if anything throws (plus a 1.5s post-load failsafe that pulls the sheet if the observer never fires) — the previous `RevealOnScroll` shipped `opacity:0` in the HTML, so a slow or broken hydration left the whole page blank below the hero. That is also why the flag is an injected stylesheet and not a class on `<html>`/`<body>`: mutating React-rendered attributes before hydration is a mismatch React reports and refuses to patch. `marketing/components/motion/RevealOnScroll.tsx` is now UNUSED (kept, not deleted — it lives in the shared marketing dir). Accents (`rule-grow`, `pop-in`) ride their ancestor's reveal instead of observing separately. Microinteractions are utilities (`lift`, `card-lift`, `link-underline`, `ledger-row`) and animate transform/opacity only. Sections 2→6 got a design pass on the receipt motif (dotted `leader-dots` ledger rows, `panel-elevated`/`edge-gold` paper, a threaded Steps rail, two-column FAQ, `section-shell` rhythm); the hero is unchanged apart from `hero-rise` → page-scoped `offer-rise` (the shared `hero-rise` still belongs to the SaaS marketing pages). FinalCTA is two-column with a photograph on the end side. **The finale is a PHOTOGRAPH of a real woman post-workout, supplied by the owner (07/2026)** — it replaced a generated «جاهزة» figure Lottie, which in turn replaced a «ختم الصفقة» receipt-seal Lottie; both animations and their generators are deleted (recoverable from git history at commits 5edb32d / 221ad65 if the direction ever reverses). The image is FRAMED in a rounded card with a hairline ring and the page's `edge-gold` top edge, plus a bottom gradient into `brand-purple-950`: the photo's own backdrop is #3E2B2C, a step warmer and lighter than `bg-hero-night`, so a bare rectangle reads as a mismatched patch — inside a card it reads as a deliberate object. Served via next/image with explicit width/height from a static import (so `placeholder="blur"` works), lazy by default since the section is far below the fold. `public/final-cta-woman.webp` (1122×1402, 57 KB — the source PNG was 1.77 MB) is mirrored in BOTH apps and guarded by `finalCtaPortrait.test.ts` (copies identical, 4:5 ratio preserved, size budget). `lottie-web` was dropped from apps/landing entirely with the animation; apps/app keeps it for the exercise form guides.

**Database migration baseline**: Production Supabase has migrations 00001 through 00007 applied (verified 06/09/2026 — 00007 `meal_mode` column confirmed present via a read-only REST probe of `family_members`). Migration 00005 added per-member fields (member_type, sex, allergies, dislikes, trimester, school_meal_handling, picky_eater) and family-wide preferences (cuisine, dietary_restrictions, cooking_methods, meal_out_frequency). Migration 00006 added `chat_messages`; 00007 added `family_members.meal_mode` ('shared' default / 'independent'). Migrations are applied MANUALLY (no CI/Netlify runner) — when adding a migration, apply it to prod yourself. Migrations 00008–00011 (admin_users, profiles.meal_mode, admin audit log), 00012 (superseded by 00014's composite index; see below), 00013 (Coach Sara questionnaire columns: target_weight_kg, day_nature/exercise_days/exercise_type, water_cups, sleep_hours, medications/supplements/nausea_foods jsonb, notes, family_members.feeding_mode, plus the optional deep-dive columns + profiles.deep_dive_completed_at — all nullable/additive, code works before it's applied but new answers won't persist) and 00014 (workout_plans table + workout_profile jsonb + plan_generations.plan_kind/workout_plan_id; REPLACES 00012's lock with UNIQUE (user_id, plan_kind) WHERE status='started' so one meal run and one workout run may coexist — apply BEFORE relying on workout generation) are NOT yet verified against prod — verify/apply before relying on the admin panel, the mom health-save (`profiles.meal_mode`), the generation race fix, or the new questionnaire fields.

**Migration state: everything through 00024 is applied to prod (00023 + 00024 applied by the owner 07/31/2026; 00001–00022 verified 07/26/2026).** 00023 widens the `subscriptions.status` CHECK to accept `'paused'` (00004 had dropped it, so every «استراحة» pause wrote a value the DB rejected). 00024 is the engineering-audit migration — see the audit section at the end of this file. Re-run `apps/app/scripts/verify-migrations.sql` after any new migration; it now also asserts a CLASS GUARD that every RLS table the app deletes from has a DELETE policy, because that omission has shipped twice (meal_checkins, fixed in 00019; meal_verdicts, fixed in 00024).

**Historical note (superseded):** the paragraph below was the 07/26 verification and is kept for its per-column evidence. Its closing claim that "the engagement code's pre-apply fallbacks are dormant" is now literally true for the ones that remain — the three `onConflict: "meal_plan_id,day_index,slot"` write fallbacks were DELETED in the audit, since 00019 drops that constraint and they could therefore only ever fail.

**Migration state VERIFIED AGAINST PROD 07/26/2026 — everything through 00022 is applied.** This supersedes the per-feature "NOT YET APPLIED"/"not yet verified" warnings still written into the sections below (00013, 00014, 00017, 00018, 00019, 00020, 00021, 00022); they are historical notes from when each was authored, not current state. Confirmed by a read-only column probe under a real user's JWT — `meal_checkins.member_id` (00019), `body_logs.photo_path` (00018), `workout_checkins.member_id` (00020) and `.intensity` (00022), `meal_absences.member_id` (00021), `meal_verdicts.canonical_key` (00017), `workout_plans.status` + `profiles.workout_profile` (00014), `profiles.deep_dive_completed_at` (00013), `profiles.meal_mode` (00009–00011) all present — plus an end-to-end UI check on prod: tapping «طبختها كما هي» wrote a `meal_checkins` row (`member_id: "mom"`, `local_date` stamped), the «كيف كانت؟» verdict control appeared only after it, `meal_verdicts` persisted, and un-tapping deleted the check-in while the verdict survived (the documented contract). The engagement code's pre-apply fallbacks are therefore dormant, not load-bearing. Re-verify with `node apps/app/scripts/qa-e2e/probe.mjs` + `engagement.mjs` after any new migration.

**Engagement layer spine (07/2026, Sprint 1)**: Migration 00017 adds the product's first event tables — `meal_checkins` (`local_date` stamped at write time as the universal calendar key, `slot` is extensible TEXT with no CHECK so Ramadan slots later are config not migration), `member_exceptions` (sparse, dish-directed kinds only — child consumption tracking is unrepresentable), `meal_verdicts` (keyed by server-minted `canonical_key` from `canonicalRecipeKey()` in plan-engine — meals have no UUIDs and regen re-words names), `body_logs` (dated weight/waist series; ADULTS ONLY enforced in app code by birth_year, never children). House RLS pattern + updated_at triggers. NOT YET APPLIED to prod — apply manually after 00016, re-run scripts/verify-migrations.sql (now covers 00016–00019), then `pnpm --filter @fitlife/app db:types` to regenerate types (until then, engagement code types rows via `apps/app/src/lib/engagement/types.ts` and untyped client casts — see the export route). /api/account/export includes the four tables (tolerant of pre-apply prod); delete is covered by CASCADE. Design contract in product/engagement-layer-brainstorm.md: unanswered = unknown (never fabricate adherence), rewards attach to rituals/verdicts never adherence counts, no shame states.

**Per-person check-in status (07/2026, owner directive)**: Migration 00019 (apply after 00018) adds `meal_checkins.member_id` ("mom" | family_members.id, same convention as meal_verdicts), swaps the unique key to (meal_plan_id, day_index, slot, member_id), and adds the previously-MISSING DELETE policy (00017 shipped without one, so every "clear my mark" tap was a silent RLS no-op) — on a shared meal each participant has a separate status (the MealCard tracking section renders one chip row PER PARTICIPANT; the header badge shows the viewed member's own status). Whole-house rows (`'household'` sentinel: legacy pre-00019 data, stale-tab writes via the zod default, and ختام اليوم `closeDay` — whole-kitchen attestation, no UI yet) are a read-time FALLBACK for members without their own row and are NEVER deleted by a per-member set (member_exceptions cascade off them; the digest needs the attestation) — but CLEARING sweeps the fallback too (fix 07/2026): un-tapping a chip means the meal carries no mark, and a surviving household row simply re-lit it with whatever the kitchen last attested (usually a legacy «تجاوزتها», which read as "un-clicking marked it skipped"). Both clear paths go through `clearMealMarks` in `engagement/actions.ts`, keyed by (user, `local_date`, slot, member) — the SAME key /plan reads by, so an older same-week plan version's row can't hand the chip back either (the page reads check-ins calendar-wide across plan versions while the old delete was scoped to meal_plan_id + day_index). `engagement/checkinMap.ts` is the one client-side definition of that read/clear pair (`resolveCheckin` / `checkinClearKeys`), used by PlanViewer's optimistic map so the tap and the server agree. Pre-00019 prod: reads degrade via `select("*")`. The WRITE fallback that once degraded to the legacy household shape is GONE (audit 07/2026) — it targeted the 3-column unique key that 00019 itself drops, so with 00019 applied it could only ever fail; a transient upsert error took the slow path to a second, misleading error. `computeEngagementDigest` collapses per-person rows by (local_date, slot) BEFORE the signal floor and all counts, so everything stays MEAL-true (a family of five skipping one dinner is one skip, never five, and household size can't buy the digest into existence — both digest fetchers select local_date); admin `checkins7d` counts distinct meals for the same reason; recap day-cells were already per-date. Statuses are about the dish serving, never amounts — the no-consumption-surveillance stance is unchanged.

**Engagement UI surfaces + workout check-ins (07/2026)**: The first customer-facing engagement surfaces shipped on /plan (all interactive-Arabic-view only — never history/housekeeper/PDF): (1) `«سارة عدّلت خطتك»` card (`SaraChangesCard`) renders `plan_data.week_changes` (data already emitted by the engine; no query change); (2) inline dish verdicts «كيف كانت؟» (نحبّها/عادية/لا تكرّريها) via `setMealVerdict` — the first customer write surface for `meal_verdicts` (closeDay still has no UI), shown under a meal only once the viewed member marked it cooked, per-person keyed (plan, member, day, slot); (3) `«موسم بيتنا»` family season (`FamilySeasonCard`). **Design history:** first shipped cooperative (no ranking) per the engagement research; then the **owner reviewed and DIRECTED a competitive ranked leaderboard (07/2026)** — the original brief in `product/family-engagement-research-and-plan.md` §0. Now renders a per-member LEADERBOARD: a shared top card (meal-true family total ring + pride line + most-consistent member + a 7-day meal strip with per-day star ratings) above ranked adult cards — a celebrated gold **#1 «فائز هذا الأسبوع»** with a crown, and purple rank cards (#2…) each with a weekly participation %. Ranking metric = meal marks + verdicts + workout marks; % = acts/`WEEKLY_TARGET`(10). **Counted meal statuses (owner directive 07/2026): ONLY «طبختها كما هي» (`status: "cooked"`).** «بدّلتها» (swapped) and «تجاوزتها» (skipped) score NOTHING on any number of the card — family ring, 7-day strip/stars, `activeDays`/«أتممتم موسمكم», the «اليوم» panel's `alreadyLit`, and every member's score/% all read the same single filter (`isCookedAsIs` in `seasonMath.ts`, one place so the surfaces can't fork). This supersedes the earlier "a meal that happened = cooked OR swapped" rule. Scoped to the leaderboard only — the weekly recap, `computeEngagementDigest` (Sara's adaptation), and the /plan chips still read every status, so honest logging is unchanged. Workout marks keep counting done + moved (a moved session was still trained). The cooperative guardrails (no last place, no per-person numbers) are intentionally superseded here by owner direction; the research recommendation remains on file. **Roster (owner directive 07/2026): the WHOLE household — mom + adults + CHILDREN — via the server's `seasonMembers` (mom + every non-housekeeper family member), NOT `journeyMembers`. Children rank exactly like adults and may take the #1 «فائز» spot; the earlier no-sibling-comparison stance is superseded alongside the cooperative guardrails. The housekeeper is never in the roster; weight/goal celebration (`goalReached`) + the private `«رحلتك الخاصة»` journey stay adults-only via `engagement/eligibility.ts` (a separate feature).** Hidden for solo/housekeeper/history. Migration **00020** (apply after 00019) adds `workout_checkins` (per-member; `day_index` WEEKDAY-anchored 0=Sunday unlike meal_checkins; `local_date` stamped server-side; DELETE policy day-one; done/moved/skipped validated in Zod). `WorkoutViewer` gained inline session marking (`setWorkoutCheckin`, whole-current-week window derived from the session's weekday with a 48h floor — see the marking-window directive below) and now takes `planId`+`checkins`; the season reads meal check-ins/verdicts + workout check-ins. 00020 NOT YET APPLIED to prod — apply after 00019, re-run scripts/verify-migrations.sql (now covers 00020), then `pnpm --filter @fitlife/app db:types`; until regenerated, page.tsx/export read `workout_checkins` via an untyped cast (pre-apply tolerant = []). /api/account/export includes `workout_checkins`; delete is CASCADE.

**Shared meals: single status + absent-member adjustment (07/2026, owner directive)**: A SHARED meal now carries ONE status for the whole dish — the per-participant chip rows from the 00019 pivot are SUPERSEDED for shared meals (individual meals still track the tab's member; 00019's schema/DELETE policy stay load-bearing). One tap on the shared card answers for everyone who shared it: `setSharedMealCheckin` fans the same status out as one row per PRESENT participant (atomic upsert; NOT a `'household'` row — that would gut the leaderboard's per-member credit and bleed onto non-sharers' individual meals in the same slot via the read-time fallback). Read side: `PlanViewer.sharedCheckinFor` = any sharer's row (fan-out keeps them agreeing) → household fallback (legacy/ختام اليوم), both via `engagement/checkinMap.ts`. Un-tapping is the mirror image of the tap: ONE tap un-answers the dish for every sharer AND retracts the household fallback (`clearMealMarks`), calendar-keyed across plan versions — without that, the cleared chip re-lit itself from the leftover row. Digest/season math is untouched — rows still collapse by (local_date, slot) so a fan-out is still ONE meal. Second half of the directive: a sharer can be excluded from one meal occurrence («إزالة من الوجبة» on the portion row) and the card ADJUSTS the batch for the remaining sharers — dish never changed/regenerated, purely deterministic scaling in `apps/app/src/lib/plans/sharedMealAbsence.ts` (portion_percentage → portion_grams → headcount; unit-aware rounding; batch weight = sum of present grams). Absence is a PLANNING fact, not adherence: it works on FUTURE days (no future-gate in `setMealAbsence`, unlike marks), lives in migration **00021** `meal_absences` (sparse, keyed plan/day/slot/member, cascade with the plan, DELETE policy day-one), and marking absent also clears that member's own status row (no serving to attest, no leaderboard credit) while their dish VERDICTS survive (an opinion is theirs) and the «كيف كانت؟» control hides on their tab for that meal. The last present sharer can't be removed (a meal for nobody is a «تجاوزتها», not an adjustment). Restoring a member re-attaches them to the dish's current status (client mirrors the donor mark via a one-member fan-out AFTER the absence delete — the fan-out is server-filtered against meal_absences, so order matters). Toggle lives on interactive-Arabic /plan only; the dashboard «وجبات اليوم» shows the same adjusted batch READ-ONLY (history/housekeeper/PDF render the stored plan unscaled; housekeeper-view scaling is a known follow-up). Slot-keyed like all engagement rows — a day with two snack-slot meals shares one absence/status key (inherited engagement-layer limit). 00021 NOT YET APPLIED to prod — apply after 00020, re-run scripts/verify-migrations.sql (now covers 00021), then `pnpm --filter @fitlife/app db:types`; until then reads degrade to [] and absence writes fail with a Sentry warning. /api/account/export includes `meal_absences` (pre-apply tolerant); delete is CASCADE.

**Out of a meal ⇒ «بدّلتها» or «تجاوزتها» only (07/2026, owner directive)**: A member excluded from a shared occurrence gets a REDUCED status row on their own tab — «طبختها كما هي» is gone, because the planned dish never reached them; the two honest answers left are بديل or تجاوز. The vocabulary lives in `OUT_OF_MEAL_CHECKIN_STATUSES` (`engagement/types.ts`, filtered from `CHECKIN_STATUSES` so it can't fork); `MealCard` renders it via the `CheckinChips` `chips` prop plus the line «{الاسم} خارج هذه الوجبة — التسجيل هنا: بديل أو تجاوز» in place of «تسجيل واحد للوجبة المشتركة». This splits the two meanings a `meal_checkins` row can carry, and the split is enforced on both sides: a PRESENT sharer's row IS the dish's single status (fan-out via `setSharedMealCheckin`), an ABSENT member's row is PERSONAL. So (a) an absentee's row no longer lights the shared chip and is no longer swept by a shared clear — `PlanViewer` passes present sharers only (`dishIds`, one roster for set AND clear; the earlier "present-first, absentees last" fallback list is superseded); (b) their tab reads their OWN row with NO household fallback (`ownCheckin` in `checkinMap.ts`; a leftover `cooked` row from before the exclusion is ignored, never shown as theirs) and routes writes through `setMealCheckin`, not the shared fan-out; (c) clearing it does NOT retract the whole-house attestation (`clearMealMarks`/`checkinClearKeys` gained `sweepHousehold`, and the SERVER decides the scope from `meal_absences` via `isOutOfMeal` — a stale tab never gets to choose); (d) `setMealAbsence` now resets the member's own status row in BOTH directions (was: only on exclude), since on restore that personal record would otherwise become the whole dish's status. Leaderboard/digest/recap math is untouched — only «cooked» scores, so an out-of-meal mark still earns nothing, and rows still collapse by (local_date, slot). No new migration (00021 covers it). Same scope as the rest: interactive-Arabic /plan only, never history/housekeeper/PDF/dashboard.

**A family meal is a DISH, not a slot (07/2026, owner directive «present the real numbers»)**: «موسم بيتنا» told a house it had cooked 3 meals in a day when it had cooked 5, and marking the 4th and 5th moved no number — the family total counted distinct `(day_index, slot)` pairs. Correct for a shared dish (three people marking one lunch is ONE meal; household size must never inflate the ring) but wrong whenever a day holds more than one dish in the same slot, which Sara's family methodology produces routinely (a member gets their own recipe when the shared pot doesn't suit them). Family-level identity is now `(day, slot, DISH)`: `seasonProps` builds `dishKeys` (`${day_index}|${slot}|${member_id}` → `canonicalRecipeKey(recipe_name_ar)`, key format in `seasonMath.dishKeyFor`) from the plan and `computeSeasonStats` counts distinct dishes — sharers of one pot resolve to the same key and still collapse to one meal. Unresolvable marks (the `'household'` sentinel, a member dropped from the roster, a re-minted plan) fall back to slot identity AND only when no identified dish already covers that slot, so a degraded read can never inflate; with no `dishKeys` at all the figure is exactly the legacy count. The strip's star denominators moved to the same key space (`plannedMealsPerDay`, renamed from `plannedMealSlotsPerDay`; `SeasonDayCell.cookedSlots/plannedSlots` → `cookedMeals/plannedMeals`), and BOTH sides are derived identically — for one member a day's duplicate slot (two snacks) yields one markable unit on each side, so 100% stays reachable. The ring fills toward `weeklyCapacity` (planned dishes + planned sessions for that household) instead of the fixed `CAP` of 14, which a large family would now fill by midweek. Copy follows the number: «هذا الأسبوع طبخ بيتكم N وجبات كما هي من الخطة» with the ring labelled «وجبات مطبوخة» — it no longer claims «معاً», since the figure now includes a member's own dish. PER-MEMBER counts keep `(day, slot)` identity (`plannedMealSlots`) — one person marks at most one row per slot. Statuses are unchanged (only «طبختها كما هي» scores), as are the digest, weekly recap, and /plan chips.

**Marking window — whole plan week (07/2026, owner directive)**: Every meal stays changeable for the WHOLE plan week, not just a 48h retroactive window — the earlier «retroactive-first, 48h grace» stance (still described in `product/engagement-layer-brainstorm.md`) is superseded so a mom can complete or correct any earlier day before the week rolls over into history. The rule is «any elapsed day of the plan week is markable, never a future day» (adherence is never pre-marked), enforced in BOTH the client gate (`PlanViewer.canCheckinActiveDay` = `activeDayIndex <= dayIndexFromWeekStart`) and the server actions (`setMealCheckin`/`setMealVerdict`/`closeDay` reject only `localDate > today`; `day_index ∈ [0,6]` keeps it inside the plan week). Once a new week's plan supersedes the current one, the old plan moves to read-only /plan/history, so the week «locks» by plan supersession, not a date bound. Workout sessions (weekday-anchored, 0=Sunday) mirror this: `setWorkoutCheckin` derives the date by scanning back `max(todayWeekday, GRACE_DAYS)` days so the whole current week is markable, keeping the 48h floor for the previous week's tail (`WorkoutViewer.canMarkActive` uses the same bound). Because verdicts + workout marks both feed the «موسم بيتنا» leaderboard (which lives on the dashboard), `setMealVerdict` and `setWorkoutCheckin` now `revalidatePath("/dashboard")` in addition to `/plan` (they previously revalidated only `/plan`, so the board went stale after an exercise/verdict change) — `setMealCheckin` already did both.

**Private journey — now WHOLE HOUSEHOLD incl. children (07/2026, owner directive)**: «رحلتك الخاصة» (/journey, «الوزن والمتابعة») is a private weight-over-time record — `?member=<family_members.id>` (default mom), member switcher chips, per-member weekly cadence and scalar weight mirror (profiles.weight_kg for mom, family_members.weight_kg for members). **Design history:** first shipped ADULTS-ONLY (children never weight-tracked — the 00017 stance + engagement §6 guardrail 1). The **owner then DIRECTED including children** (07/2026), with the child-safety trade-offs surfaced. To keep the reversal narrow, `apps/app/src/lib/engagement/eligibility.ts` now splits into THREE gates: `isWeighInEligibleMember` = may keep a PRIVATE record, PHOTOS included (adults **and children**; housekeeper NEVER — dignity rule) → journey page + /plan per-tab entry + logBodyWeight write gate; `isChildWeighInMember` = the member is a minor (now used ONLY to keep minors off the shared goal celebration); `isGoalCelebrationEligibleMember` = ADULTS ONLY → the shared «تحقّق الهدف» on «موسم بيتنا» (`seasonProps.ts` goalReached uses THIS, so a child's weight goal is never on a shared surface). **The ONE thing that stays adults-only is the shared goal celebration.** BODY PHOTOS were adults-only at first — the minor-photo block lived in three layers (`WeighInForm`'s `allowPhotos` prop, the journey page's photo-signing guard, and a `photo_path`-nulling branch in `logBodyWeight`) — but a **LATER owner directive (07/2026) extended progress photos to children too, with the child-safety trade-offs surfaced.** All three blocks were REMOVED (the `allowPhotos` prop is gone entirely); every eligible member (adults + children; housekeeper never) may now attach a private photo. Nothing about the photo's privacy changed: it stays a per-account, private, journey-page-only record — masked by default, signed URLs only, never on «موسم بيتنا» or any shared surface, never in admin. A child journey is a neutral weight record by construction (the target/loss line is mom-only; recap `weight_delta` is mom-only). pregnant/lactating eligible but no loss-framing. The dashboard quick-link was REMOVED — the entry now lives on /plan as a per-member-tab card (PlanViewer `journeyMembers` prop; interactive page only, never history/housekeeper/PDF). Migration 00018 (NOT YET APPLIED, after 00017): `body_logs.photo_path` + PRIVATE `body-photos` storage bucket (5MB, jpeg/png/webp, owner-scoped storage.objects policies by first path segment `<user_id>/`; the bucket is per-account, so a child's photo lives in the parent's own folder — WHO may attach one is app policy, not SQL). Photos upload browser→bucket directly, render ONLY via short-lived signed URLs on /journey behind a masked-by-default reveal (plain `<img>` on purpose — the next/image optimizer would cache private photos), and never appear in messages/recap/share cards/admin. PDPL: storage does NOT cascade — `eraseUserAccount()` removes the `<user_id>/` folder explicitly (best-effort, before auth delete); /api/account/export attaches 24h signed `photo_url` per log (best-effort, pre-apply tolerant). Weight-only saves still work pre-00018 (photo_path key is omitted when absent).

**Doctor sign-off — ONE rule (07/2026)**: `packages/plan-engine/src/medicalGate.ts` is the single definition of who needs `consulted_doctor` before a plan. `ownerRequiresDoctorSignOff` = ANY medical condition (chips + the free-text «حالة أخرى», which the save actions append to `medical_conditions`) OR pregnancy at ANY risk level; `memberRequiresDoctorSignOff` = HIGH-risk conditions or a high-risk pregnancy only (deliberately narrower — one member's unanswered checkbox must never block the household). It was previously re-derived in five places with five different rules, and the engine's was the broadest: a PREGNANT LOW-RISK owner was permanently blocked from generating while neither the wizard nor `/profile/health` ever showed her the checkbox (both keyed off `highRisk === true`), and a stable condition saved from `/profile/health` with the box unticked did the same. `buildContext`, the SDK-free background function, `MomWizard`, `HealthEditForm`, `saveMomProfile`, and `saveMomHealthInfo` all call it now — save is REFUSED when the rule applies and the box is unticked, so a profile the UI accepts is always one the engine will plan for. Recovery for rows saved before the fix lives on **/plan**: `EmptyState` renders the confirmation inline (`confirmDoctorConsult` in `app/plan/actions.ts`) instead of a create button that could only ever come back refused; `/api/plans/generate` marks that denial `gate: "medical"` and the dashboard CTAs route there on it. Exhaustively guarded in `apps/app/src/qa/deadEnds.test.ts` (UI-asks ⇔ engine-blocks over the whole owner input space).

**Goal mapping — a stable condition no longer erases the goal (07/2026)**: `mapUserGoalToSara` used to route ANY condition away from the stated goal, so PCOS or anemia + «خسارة الدهون» silently became `metabolic_health` with no deficit at all — and PCOS is very common in this audience. Now only a HIGH-RISK condition leads the plan (`hasHighRiskCondition` from `plan-engine/medicalGate` — the same list as the doctor gate, so there's one definition); a stable condition is respected through the roster/day-prompt condition clauses and the methodology's per-condition rules instead. Two deliberate consequences: `build_muscle`/`athletic` are no longer immune to the override (they were, for no stated reason — a high-risk condition now leads them too), and «تحسين الحالة الصحية» stays condition-led for ANY condition because that IS the ask. `hasGateCondition` in `medicalConditions.ts` now delegates to the engine list too (the two had drifted by `unexplained_symptoms`).

**Prompt precedence: methodology over cookbook (07/2026)**: `SARA_COOKBOOK` read as absolute bans («لا تستخدمي أرز أبيض كمكون رئيسي»، no regular pasta, no white bread) that contradicted `SARA_METHODOLOGY`'s own Gulf staples list (كبسة، الجريش، المرقوق، السمك مع الأرز) and its «لا حرمان» principle — and being the LATER block in `STATIC_SYSTEM`, it won, so plans systematically avoided the dishes the product promises. It also stated a per-recipe band of 120-430 kcal/serving which cannot add up to an adult day target, which the per-day band enforcement then fought with re-rolls (visible in the test logs as «out of band after 2 corrective re-rolls»). Fixed by: an explicit «ترتيب المراجع عند التعارض» section at the end of `STATIC_SYSTEM` (safety → day targets → allergies → Gulf staples/لا حرمان → cookbook style), a matching «الأولوية عند التعارض» paragraph inside the cookbook block, reframing the bans as «تفضيلات الأسلوب (افتراضات، لا محرّمات)» with rice-based Gulf dishes served «بمقدار موزون» rather than replaced, and restating the serving size as derived from the day target (snacks 120-320, main meals up to 600-800). The block was also rewritten in فصحى with Western digits (it was عامية, and «أنتي» was a misspelling of «أنتِ»). Guarded by `promptQuality.test.ts`. NOTE: this invalidates the cached static prompt block once on deploy.

**Postpartum without lactation (07/2026)**: `months_postpartum` is «months since giving birth» for the account owner, NOT a lactation flag — `member_type === "lactating"` is what adds the lactation calories. It was only stored for lactating owners, so a woman who formula-feeds selected «لست حاملاً ولا مرضعة» and got no recovery rules at all (and no pelvic-floor/core caution in the workout program, whose `describeTrainee` already keyed off the column). Both the mom wizard's pregnancy step and `/profile/health` now ask «هل ولدتِ خلال آخر 12 شهراً؟» when she is neither pregnant nor lactating; `describeMom` renders a recovery clause («لا تضيفي سعرات الرضاعة» + protein/iron/fibre/gradual-change) instead of the lactation clause. Never set while pregnant, never for a male owner. Family members are unchanged (no non-lactating postpartum member type exists).

**Child rule — ONE definition (07/2026)**: `packages/plan-engine/src/childRule.ts` (`isChildByAge` / `isChildByBirthYear`) decides who is planned by food-pyramid PORTIONS instead of BMR/TDEE — `member_type === "child"` OR under 18. It was applied to family members in three places and to the ACCOUNT OWNER in only one: `generate.ts`'s assembly stamped `is_child` for an under-18 owner (and `reconcileChildTargets` rewrote her header) while `describeMom` emitted no child clause and `buildDayPrompt` handed her an adult calorie target — so a 15-year-old signup got an adult deficit plan displayed as a portions plan, against the methodology's own «لا تستخدمي معادلات BMR/TDEE للأطفال إطلاقاً». `buildContext`, `describeMom`, `buildDayPrompt`, `dayCalorieDeviations`, `dayProteinDeviations`, `isChildById` and the app's read-time `applyChildDisplayTargets` all call it now. A minor owner also skips the weight-target clause. Signup accepts 13+ (both `step1Schema` AND, since this fix, `momProfileInputSchema`/`profileStepSchema` — the server used to allow any birth year up to the current one).

**Member edit → regeneration (07/2026)**: `apps/app/src/lib/plans/memberEdit.ts` diffs the whole built row against the stored one instead of the hand-maintained field list `updateFamilyMember` used to carry. That list silently omitted **allergies**, `height_cm`, `dislikes`, `trimester` and `months_postpartum` — adding a nut allergy to a child saved the row and left the nut-containing plan on screen. Only `name`, `user_id` and `preferred_language` are cosmetic (the first shows through `applyMemberDisplayNames`; the housekeeper's language triggers a translation pass, not a regeneration). Numeric columns that Postgres returns as strings compare numerically. Guarded by `memberEdit.test.ts`.

**Activity for pregnant/lactating members (07/2026)**: their calories are maintenance (TDEE) plus a stage addition, so they need an activity factor exactly like an adult. The `exercise` step (طبيعة اليوم × أيام الرياضة) is now in the pregnant and lactating `MemberWizard` flows, and `buildMemberRow` stores `day_nature`/`exercise_days`/`exercise_type` + the derived `activity_level` for all three adult-like types — previously adult-only, which left `activity_level` null for both and made `describeMember` omit the clause entirely, so the model guessed the multiplier. `target_weight_kg` stays adult-only (pregnancy and lactation are not weight-change goals).

**Family-member validation bounds (07/2026)**: `familyMemberInputSchema` now matches the `family_members` DB CHECKs and the wizard's own `physicalRangeError` (40-250 cm / 5-300 kg). It required 80 cm / 20 kg, so every child under about six was rejected AFTER the wizard accepted them, with the opaque «بيانات غير صالحة» and no field named. Rejections now surface the field-level Arabic message via `firstFieldErrorAr` (which only forwards OUR Arabic messages, never zod's English defaults).

**Onboarding restructure (Prompt 1.8c)**: 5 family-wide questions → Mom's personal questions → sequential per-member additions with branched wizards (adult/child/pregnant/lactating). Solo plans hide member tabs.

**Coach Sara questionnaire (07/2026)**: Mom's flow is now 10-11 adaptive steps (step-key array). `activity_level` is DERIVED in `apps/app/src/lib/plans/activityLevel.ts` from the concrete day-nature × exercise-days answers (12-row table matching the Saudi MOH calculator buckets/multipliers already in SARA_METHODOLOGY); raw answers stored alongside. UI goals are the coach's six (`lose_weight/build_muscle/recomposition/maintain_weight/athletic/improve_health` → canonical incl. promoted `maintain`/`general_health`). New per-person fields (target weight, exercise, water, sleep, meds/supplements, mom notes, pregnancy nausea_foods, lactation feeding_mode) thread DB → buildContext (+ the bg function's SDK-free mirror) → skeleton roster clauses; ONLY meds+nausea repeat in day prompts. Optional deep-dive screen at /profile/deep-dive (dashboard banner + profile card) fills the full-questionnaire extras into a skeleton-only lifestyle block. Onboarding server actions are zod-validated via `onboarding/serverSchemas.ts`; the level is always re-derived server-side.

**Workout plans (07/2026, meals-first fork)**: meals and exercise are SEPARATE plans. Onboarding ends at `/onboarding/plan-scope` — "وجبات فقط" (previous path) or "وجبات وتمارين معاً" (7 workout questions per opted-in adult at `/onboarding/workout`, stored as `workout_profile` jsonb; children/housekeeper never eligible). Combined generation: `maybeTriggerWorkoutGeneration` fires from `generateSoloAndContinue`/`syncFamilyPlanAfterSubscribe` (regardless of the meal result; idempotent under 00014's per-kind lock). Engine: `packages/plan-engine/src/workout/` — WORKOUT_METHODOLOGY is an ACSM/NSCA-grade resistance-training block authored in-house (فصحى, cached-static, ACOG-aligned pregnancy + injury safety rules; PENDING Coach Sara review — swap text, not code). Two-phase: skeleton (split+sessions, SKELETON_MODEL) → one full-week expansion per member (DAY_MODEL). Same background function via `mode:"workout"` (own idempotency probe by workout_plan_id); status at `/api/plans/workout/status` (the meal status route is untouched — 3 pollers depend on its shape); viewer via `/plan?view=workout` toggle + `WorkoutViewer`. Post-onboarding opt-in: dashboard banner + profile entry → immediate dispatch. v1: no manual workout regenerate (edit answers → next combined trigger); /plan/history stays meal-only; workout available on all paid tiers; admin per-plan cost map excludes workout rows (spend still lands in totals).

**Exercise form animations (07/2026)**: every exercise row in `WorkoutViewer` taps open a brand-colored Lottie form guide. Fixed catalog `packages/plan-engine/src/workout/exerciseCatalog.ts` (72 ids + `FALLBACK_BY_PATTERN`): the roster is embedded in the cached `WORKOUT_STATIC`, the model MUST emit `exercise_id` (+ `home_variant_id` for location="both") from it; unknown ids are nulled log-only (`normalizeExerciseIds`) so runs never fail — id-less exercises just don't expand (old plans keep rendering). Assets are generated IN-REPO (no licensing): `apps/app/scripts/lottie-exercises/` (parametric figure rig → Lottie JSON; QA via headless-Chromium screenshot sheets) → `apps/app/public/lottie/exercises/<id>.json` (~13 KB each, lazy-fetched per expanded row by `ExerciseLottie.tsx` via `lottie-web` light build; reduced-motion → still frame + play). `exerciseAnimations.test.ts` keeps catalog↔files in lockstep — run `node scripts/lottie-exercises/generate.mjs` after editing the catalog or poses. **Meals-first sequencing**: the workout background run holds while a meal generation is live (`mealGenBlocksWorkout` polled every 10 s, 8-min cap, stale >15 min ignored) so meals always get the full API budget; `/api/plans/workout/status` exposes `waiting_for_meals` and the generating card shows «نجهّز وجباتك أولاً».

**Workout training days + intensity adaptation (07/2026, owner directive)**: two intake/loop gaps closed. (1) **Chosen weekdays**: `workout_profile.preferred_days` (0=Sunday…6=Saturday, the workout day_index convention; optional — legacy profiles without it keep model-picked spacing). Onboarding's shape screen gained a weekday chip picker (count must equal desired_days, chips disable at the cap, shrinking desired_days trims the selection). The roster line renders the days as a mandatory clause and `normalizeWorkoutSkeleton`/`normalizeMemberSessions` REMAP sessions onto the chosen days deterministically (i-th session in week order → i-th chosen day; chosen days also become the session-count cap) — the user's calendar always wins over the model's spacing. (2) **Intensity feedback loop**: migration **00022** (apply after 00021, re-run scripts/verify-migrations.sql — covers 00022) adds `workout_checkins.intensity` (easy/right/hard, nullable, Zod-validated, no DB CHECK). WorkoutViewer shows «كيف كانت شدة الحصة؟» chips only on a «أنجزتها» mark; any non-done status write resets intensity (stale ratings must not steer). Pre-apply prod: the action retries the upsert without the column + Sentry warning, so marking keeps working. Before a workout generation the bg function reads 21 days of checkins, `summarizeWorkoutFeedback` (plan-engine `workout/feedback.ts`) collapses them per member (intensity counted on done rows only; <2 rated sessions = no signal, nothing fabricated), and `workoutFeedbackClause` renders a numbers-first فصحى directive on the trainee line (mostly-hard → deload, mostly-easy → add challenge within RIR 1-3, balanced/tie → hold) + a methodology «التكيّف» rule making the actual rating outrank assumptions. Export ships the column via select(*); board math ignores intensity (pass-through only).

**Workout location/equipment fit (07/2026, owner directive)**: a program must match the trainee's declared location + tools 100% — gym plans were coming out near-identical to home plans. Three layers, all in `packages/plan-engine/src/workout/`: (1) the catalog grew a real gym tier (72 ids: barbell squat/deadlift/hip thrust, machine chest/shoulder press, hip abduction, cable glute kickback/lateral raise/biceps curl, reverse pec deck, seated calf raise, rowing machine, elliptical — each with an in-repo Lottie pose) plus `towel_row`/`superman` so a no-equipment home user has a legal pull/back pattern; (2) prompts state the rules (methodology «المكان والأدوات» is now mandatory-worded: gym plans must put ≥half of strength work on gym gear; the phase-2 member prompt embeds the trainee's exact allowed `exercise_id` list for home, and the allowed `home_variant_id` list for both); (3) `equipment.ts` ENFORCES it post-parse via `enforceWorkoutProfileFit` called from generate.ts — home: only `home_ok` + declared tools (wall/box/bench count as furniture; home «أجهزة منزلية» = treadmill/bike cardio ONLY, label clarified in onboarding); gym/both: `GYM_GEAR_SHARE_FLOOR` (0.5 of strength patterns on machine/barbell, waived for pregnant/≤3-mo-postpartum); both: every gym-gear exercise must carry a home-legal `home_variant_id`; stray variants on non-both members are stripped (kills the phantom «نسخة المنزل» toggle for gym users). Violations re-roll the member call (within MAX_RETRIES); the FINAL attempt applies deterministic repairs from `HOME_SUBSTITUTE`/`PATTERN_STAPLES`/`GYM_UPGRADE` (pregnancy-safe filtered) and logs — a member is never dropped over equipment fit. Tables are integrity-tested (`equipment.test.ts`): every id resolves a no-equipment home substitute, pregnant or not.

**Generated plan text follows the reader's gender (07/2026)**: the React UI already inflected via `genderPick`, but the AI PROMPTS still hard-defaulted to feminine, so a male owner's *plan content* — recipe steps, notes, workout cues — came back addressed to a woman. Fixed at the prompt layer in `packages/plan-engine`: (1) MEALS — the phase-2 day prompt's «صيغة المؤنث» line is now derived from the owner's answered الجنس via `ownerG(context)` (`systemPrompt.ts`), which also genders the «العميلة/العميل» questionnaire headers and the name-less-owner fallback in `buildContext.getBeneficiaries`; the methodology's safe-calorie floors, which were stated for «المرأة البالغة» only, now say explicitly that they are FEMALE limits and point a man at the relative-deficit rule + his own BMR as the floor (**pending Coach Sara sign-off — the only clinical wording added**). (2) WORKOUTS — `WORKOUT_ROLE` no longer advertises a women-only specialty; the cached methodology's feminine-plural trainee nouns (المبتدئات/المتوسطات/المتقدمات) became inclusive masculine-plural per the house convention, and «اعتبارات خاصة بالنساء» is now «اعتبارات حسب الجنس والحالة» with postpartum scoped to women and an explicit bar on pregnancy/postpartum content in a man's program; the roster line follows each TRAINEE's own sex (`traineeIsMale`) instead of labelling everyone «العميلة (الأم)»/«متدرب»; and the phase-2 member prompt carries a mandatory «صيغة الخطاب» block keyed to that trainee. Voice for meals = the OWNER (the plan's reader); voice for workouts = the TRAINEE (each program is read by its own person). Feminine stays the fallback for an unanswered/legacy `sex`, matching `lib/copy/gender.ts` — it is no longer a blanket default. Changing `WORKOUT_ROLE`/methodology/`SARA_METHODOLOGY` invalidates the cached static prompt block once on deploy. Known remaining default: the HOUSEKEEPER is assumed female (no sex step in her wizard — `MemberWizard` falls back to `"female"`, and the translation prompts say «طبّاخة»); closing it needs a new intake question.

**AI generation**: Day-by-day streaming, incremental per-member updates that don't wipe existing family plans when adding/editing one member.

**Plan engine package**: Lives at packages/plan-engine (was originally inline in apps/app).

**Settings page**: PDPL compliance shipped — /settings has account info + data export + immediate hard-delete via typed-confirmation modal. Public routes /privacy and /terms exist with placeholder Markdown content (needs real legal text before scaling).

**Sara's Cookbook Inspiration (Prompt 3.3a)**: The AI system prompt now includes a structured profile of Sara's "كنز الوصفات الصحية" cookbook (101 recipes, high-protein/no-sugar/no-refined-flour). Recipes are NOT extracted verbatim from the PDF — instead, the AI generates fresh recipes that align with the cookbook's style, ingredient palette, and constraints. The block lives in `packages/plan-engine/src/systemPrompt.ts` as `SARA_COOKBOOK`, appended to the cached `STATIC_SYSTEM` after Sara's methodology (methodology takes precedence for medical/pregnancy needs). A non-fatal log-only guard in `generate.ts` warns on refined-flour/sugar deviations. PDF source (if added) lives in `product/sara-cookbook.pdf` for reference but is not parsed at runtime.

**A generating screen gives up on SILENCE, never on a wall clock (07/2026)**: both `PlanGeneratingState` and `WorkoutGeneratingState` used a fixed `TIMEOUT_MS = 780_000` (13 min) whose comment claimed it was «kept inside the background function's 15-min budget» — inside is exactly backwards. The bg function's day loop runs to `dayLoopDeadline` (budget − `FINALIZE_RESERVE_MS` ≈ 14.25 min) and writes its terminal row inside the reserve, so a healthy run lands at ~15 min and the client was calling it stuck at 13. Worse, refreshing from «العملية تاخذ وقت أطول من المتوقع» re-rendered the same card with a fresh clock (`resolveStaleness` won't reclassify while `updated_at` is fresh, and a live run keeps refreshing it), so the screen could cycle indefinitely without ever stating a fact. The wall clock is gone: `apps/app/src/lib/plans/generationTiming.ts` is now the ONE timing contract — it owns `STALE_GENERATION_MIN` (re-exported by `staleness.ts`, which keeps the server consumers reading it from the staleness contract) and derives `GENERATION_SILENCE_LIMIT_MS` = staleness + `SERVER_VERDICT_MARGIN_MS`, so the client always lands AFTER the server's reclassifier and the user gets a real screen (the plan, or the retry state) rather than the generic card. It is a leaf module on purpose: `staleness.ts` pulls `planHasContent` from the plan engine, and a client component importing that would drag the engine into the browser bundle. BOTH status routes now return **`age_ms`**, measured entirely server-side (a route handler may call `Date.now()`; a Server Component render may not — `react-hooks/purity`), which is also what removes device-clock skew from the question: the cards rebuild `lastWriteAt = now − age_ms` on every poll, so a run that is still writing is never called stuck however long it legitimately takes, a reloaded tab recovers the true age within one immediate poll instead of buying a fresh window, and a permanently-broken poll still resolves to an answer instead of an endless spinner. `PlanGeneratingState` also reloads on an id mismatch (the route reports only the LATEST plan, so a superseded tab could otherwise never see its own plan finish; page and route both resolve through `getLatestPlan`, so one reload always converges). The workout card keeps its deliberate meals-first exemption — the hold is the worker behaving correctly, not silence. Guarded by `generationTiming.test.ts`, which asserts the ordering against the ENGINE'S OWN budget constants, so raising the bg budget fails the suite instead of quietly recreating the bug. NOTE: none of this makes a dead run finish — it removes a FALSE stuck screen. A genuinely stuck run is diagnosed from the `plan_generations` row (still `started` with NULL cost = killed mid-flight; no row at all = never invoked), since Netlify answers a background function with 202 BEFORE the handler runs and the dispatcher therefore cannot observe a handler-side crash.

**The worker ACKs its invocation, so «never started» stops looking like «still working» (07/2026)**: a generation that the background function REFUSED — rejected `x-internal-secret`, missing env, a body it rejected — returns BEFORE the try block whose catch is the only code that terminalizes the row, and Netlify answers a `*-background` function with 202 BEFORE the handler runs, so the dispatcher cannot see any of it. The result was that «the worker never ran» and «the worker is still working» were the SAME observable state (status `generating`, `plan_data` `{}`) for a full fifteen minutes, after which the user got the mushy «تاخذ وقت أطول من المتوقع» rather than the truth. Worse, the 401 branch printed NOTHING — no log, no Sentry — making a secret/env mismatch the single most invisible way for generation to stop working. Fixes: (1) the handler now writes an **invocation ACK** (`plan_data: { worker_ack_at }`) after the idempotency probe and before any model call — filtered `status=eq.generating` so a duplicate invocation can never blank a finished plan, unwrapped so a worker that can't write it fails loudly, and in `plan_data` so it needs NO migration (inert while generating — `plan_data` is only Zod-parsed once status is `ready` — and the first `emit()` overwrites it wholesale); (2) `resolveStaleness` gained a rule ABOVE the 15-min branch: `generating` + no content + no ACK + older than `WORKER_ACK_LIMIT_MS` (90s, in `generationTiming.ts`) ⇒ `failed` with «لم تبدأ عملية إنشاء الخطة» and the existing retry card. `workerAcked` DEFAULTS TRUE and `getLatestPlan` derives it as "plan_data is not the empty object `createPlanRows` inserted", so a degraded read is only ever too patient and pre-ACK rows are never retroactively failed; (3) the env gate now runs BEFORE the auth gate and NAMES the missing variable — `!serviceKey` used to be folded into the 401, so the one variable whose absence stops the worker dead reported itself as «Unauthorized»; both gates now log + Sentry (`bg-env-gate` / `bg-auth-gate`, presence and lengths only, never values). Also: Phase 1's skeleton call is finally clamped to `remainingMs(deadlineMs)` like `generateDay` already was (it could burn the whole budget and be hard-killed before the first emit, and free-access mode makes households that large reachable), the terminal-write catch retries the plan row once + Sentries instead of a bare `console.error`, the dispatch enqueue-timeout path stamps `plan_generations.error_message = "enqueue unconfirmed (timeout)"` instead of recording nothing, and `INTERNAL_FUNCTION_SECRET` is documented in `env.example.txt` (it must be visible to BOTH the Next runtime and the Functions runtime — the two sides compare it directly, so a scope mismatch is a silent 401). Guarded by `generationTiming.test.ts` + `staleness.test.ts`. NOTE: the earlier theory that a stale `plan_generations` lock permanently wedges an account is FALSE — `dispatch.ts` sweeps a stale `started` row («stale generation reclassified») and proceeds.

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

**00024 added `unique (user_id)`** — there is now exactly ONE row per user. The read path had
always assumed it (`order created_at desc limit 1`) while the webhook wrote to every row a user
held, so the two disagreed the moment a second row existed. **`last_event_at`** (also 00024)
holds `attributes.updated_at` of the most recent LemonSqueezy webhook applied; events at or
before it are ignored as replays / out-of-order delivery.

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
| last_event_at | timestamp with time zone | yes |

---

## Engineering audit + fixes (07/31/2026)

A read-only audit of the whole codebase (auth, family, payments, generation, engagement,
DB contract, UX paths) produced 53 confirmed findings; the fixes shipped in six commits on
`claude/fitlife-engineering-audit-e4yq9j`. Full report with per-finding evidence lives in the
session's plan file. **Migration 00024 carries the DB half and is applied.** The recurring
patterns are worth knowing before touching any of this code again.

**The three root causes.** (1) RLS policy sets missing the verb the app actually uses — a
DELETE with no policy affects zero rows and returns NO error, so the action reports success
and the row survives; this shipped twice. (2) THE SAME RULE IMPLEMENTED TWICE with one copy
drifted — the per-kind generation lock, the two variant resolvers, `isAdult` vs `isAdultLike`,
the two family builders. (3) State written BEFORE it was validated, so the account could
reach a place the product had no exit from.

**Generation lock is PER KIND.** `plan_generations` queries MUST filter `plan_kind`. 00014
replaced the one-run-per-user lock with `(user_id, plan_kind)` so a meal run and a workout run
may coexist; the meal-side busy guard and `triggerPlanTranslation` did not honour it, so a
live workout run (which waits up to 8 min for meals BY DESIGN) made every meal dispatch report
`busy` — "new plan" did nothing, add-member silently deferred, translation skipped. Same for
the stale reclassifiers, which could otherwise flip a live workout's audit row to `failed`.

**`plan_generations` is an AUDIT table.** 00024 dropped the user UPDATE policy (the browser
could reset its own weekly quota, clear the in-flight lock, and rewrite the `cost_usd` columns
the admin dashboards aggregate). INSERT stays — `createPlanRows` opens the row with the user's
client. **Every UPDATE must use the service-role client**, including the dev-inline generation
path, which now passes `createAdminClient()` exactly as the prod background function always did.

**Tier limits are enforced AT THE BOUNDARY (owner directive 07/2026).** `addFamilyMember`
checks the person count BEFORE the insert and returns `upgrade_required` without writing;
`/api/subscription/change` refuses a downgrade that would strand members, before calling
LemonSqueezy. `countBeneficiaries` returns `null` on a query error and callers FAIL CLOSED
(`count_unavailable`) — it used to return 1, which for a limit check is the best case, not
the worst, so any DB blip silently removed the limit. **But the generation gate still CAPS
rather than denies**, now for single-member runs too: accounts that crossed the line before
the boundary check existed are still out there, and denying them left the whole family unable
to generate anything. A run targeting a capped-out member is refused; everything else degrades.

**Upgrade CTAs must resolve their destination.** An over-limit household by definition already
pays, and `/api/checkout` 409s an existing subscriber — so `/pricing` was a dead end for
exactly the people who saw the paywall. Both the wizard and the /plan blocked-members banner
now route to `/subscription` when `hasLiveLemonsqueezySubscription(sub)`, and drop the
«اشتركي» wording for someone who is already subscribed.

**Webhook: variant over custom_data, and ordering is not free.** `custom_data` is frozen at
the original checkout, but `/api/subscription/change` swaps the variant on the EXISTING
subscription and cannot rewrite it — so renewal invoices were stamping the OLD tier back and
silently downgrading a customer one billing cycle after they upgraded. Tier/cadence now come
from `variant_id` via `getTierCadenceByVariantId`, with `custom_data` only as fallback.
`deriveCadence` is DELETED (it resolved variants by different rules and would have returned
null once live ids were set). Delivery is at-least-once and unordered, so `last_event_at`
(00024) records `attributes.updated_at` of the last applied event and older ones are ignored.
`payment_success` may claim the row ONLY when it holds no subscription id — unlike
`subscription_created` it also fires for renewals.

**Reconciliation joins on IDENTITY, not email.** Checkout deliberately does not prefill the
email, so the address on the LemonSqueezy side is whatever the customer typed — matching on it
missed exactly the people the self-heal exists for, and let an account whose email matched
someone else's checkout inherit that subscription (including the id `/cancel`, `/pause` and
`/change` act on). Now: stored `lemonsqueezy_customer_id` first; the cold-start email path
requires the subscription's own `custom_data.user_id` to name this user.

**Family surfaces must ROSTER-FILTER.** `member_id` is TEXT with no FK (it carries the `"mom"`
and `"household"` sentinels), so removing a member orphans their rows. The per-member scoring
filtered the roster and the family counters did not, so the ring/strip counted meals for
someone no longer in the household while nobody's score moved — the family total could not
reconcile with the sum of its members. Both filter now (keeping `'household'`, which names no
member by design), and `removeFamilyMember` purges the member's `meal_checkins`,
`meal_verdicts`, `workout_checkins`, `meal_absences`, `body_logs` and their entry in
`member_addition_order`.

**Postgres `numeric` may arrive as a STRING.** Coerce with `Number()`, never type-guard with
`typeof v === "number"` — the weekly recap's weight line was permanently null because of it,
and its unit test passed numbers straight into the pure function so it could never catch it.
`seasonProps.ts` and `memberEdit.ts` already did this correctly.

**Redirect targets from the URL are attacker-supplied.** `safeRedirectPath`
(`apps/app/src/lib/safeRedirect.ts`) is the ONE definition — same-origin absolute paths only.
`redirect_to` went unvalidated into `window.location.assign()`, making the login page an open
redirect *after* a successful sign-in. Used by LoginForm and `/auth/callback`.

**`onboarding_completed_at` is a GATE, not a flag.** `syncFamilyPlanAfterSubscribe` and
`drainDeferredMembers` both return immediately when it is null. Its write errors are now read
and the redirect refused on failure — discarding them meant a customer could pay and never
get a plan generated, with nothing surfaced anywhere.

**Ops.** Set `INTERNAL_FUNCTION_SECRET` in Netlify — the app→background-function bearer secret
was the Supabase SERVICE-ROLE KEY, sent as a header to a URL built from a `NEXT_PUBLIC_` var.
It falls back to the service-role key while unset, so setting it is what stops the fallback.
`NEXT_PUBLIC_FREE_ACCESS_MODE` makes `getTierLimit` return null for everyone, so the whole
tier-limit cluster above is bypassed and untestable while it is on.

**Known remaining (audited, not fixed).** Housekeeper identity is keyed off `role` in ~40
places and `member_type` in 5 — `familyMemberInputSchema` now rejects `role: "housekeeper"`
(that was a tier-limit bypass), but the dual key itself stands; a DB CHECK enforcing
`(role = 'housekeeper') = (member_type = 'housekeeper')` would close it. Plus three
low-severity leads not independently verified: feminine-only copy for a male owner through the
member wizards, the claim that member edits auto-regenerate via `memberEdit.ts` being
UI-reachable, and housekeeper-language sold as `family`-tier-only while reachable on every tier.
