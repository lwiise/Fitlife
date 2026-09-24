-- ============================================================================
-- 00026 — meal_plans / workout_plans / plan_generations / chat_messages:
--         the browser may READ its own rows, never write them
-- ============================================================================
-- 00024 dropped the user UPDATE policy on plan_generations because a customer
-- holding the public anon key and their own JWT could PATCH the cost columns
-- the admin dashboards aggregate and reset their own weekly quota. The same
-- class stayed open on six sibling policies (pre-launch audit, 09/2026):
--
--   * "Users can update own meal plans" (00003) — rewrite plan_data
--     (regenerated_for → weekly-quota bypass the day free-access mode is off;
--     gen_attempts → the ONLY cap on the page-mounted drain, the chain and the
--     sweeper; blank a member's days → paid refills), status, and the ai_*
--     token/cost columns the admin detail page reads.
--   * "Users can update own workout plans" (00014) — the same on workout_plans.
--   * "Users can insert own plan generations" (00003) — post rows with any
--     cost_usd (summed unfiltered by /admin), or a fake status='started'
--     plan_kind='meal' row that self-locks the account for STALE_GENERATION_MIN.
--   * "Users can insert own chat usage" (00006) — unlimited rows with any
--     cost_usd.
--   * "Users can insert own meal plans" (00003) and "Users can insert own
--     workout plans" (00014) existed only so createPlanRows /
--     createWorkoutPlanRows could open the placeholder rows with the user's
--     client. They now run with the service-role client.
--
-- Every legitimate write to these four tables is server-side bookkeeping: the
-- Netlify worker and sweeper (service role over PostgREST), the dev-inline
-- generation and translation paths, plan/history/actions.ts, and — moved in
-- the same change — createPlanRows / createWorkoutPlanRows, the two
-- dispatch-failure writes in dispatch.ts, and the chat usage row. 00002's
-- original comment («Users cannot directly insert/update/delete meal plans.
-- Only the service-role-authenticated AI generation endpoint creates these»)
-- is true again.
--
-- SELECT policies are untouched: the app reads all four tables with the
-- user's client. No DELETE policy ever existed on any of them (account erasure
-- uses the service role, and every one of them cascades off profiles).
--
-- ORDER MATTERS: deploy the app build that carries this migration FIRST, then
-- run this file. Applied before that deploy, the old createPlanRows (user
-- client) would fail its INSERT and every «إنشاء خطة» would report a dispatch
-- error until the deploy lands. Applied after, nothing changes for customers.
--
-- Apply after 00025. Idempotent. Verify with
-- apps/app/scripts/verify-migrations.sql (row «00026 …»).
-- ============================================================================

drop policy if exists "Users can insert own meal plans" on public.meal_plans;
drop policy if exists "Users can update own meal plans" on public.meal_plans;

drop policy if exists "Users can insert own workout plans" on public.workout_plans;
drop policy if exists "Users can update own workout plans" on public.workout_plans;

drop policy if exists "Users can insert own plan generations" on public.plan_generations;

drop policy if exists "Users can insert own chat usage" on public.chat_messages;
