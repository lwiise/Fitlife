-- ============================================================================
-- 00024 — Audit fixes: missing DELETE policies, plan_generations tamper-proofing,
--         one subscription row per user
-- ============================================================================
-- Migration: 00024
-- Created: 2026-07-31
--
-- Apply AFTER 00023. All three sections are additive/idempotent and safe to re-run.
--
-- Section 1 is the one with a user-visible bug behind it — apply it first if you
-- are staging these.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Missing DELETE policies (meal_verdicts, body_logs)
-- ----------------------------------------------------------------------------
--
-- 00017 created meal_verdicts and body_logs with RLS enabled and SELECT/INSERT/
-- UPDATE policies only. 00019 spotted the identical omission on meal_checkins
-- ("every 'clear my mark' tap was a silent RLS no-op") and fixed it there — but
-- the two sibling tables in the same migration were never given one.
--
-- The live consequence is on meal_verdicts. Tapping the already-selected
-- «كيف كانت؟» chip calls setMealVerdict({ verdict: null }), which DELETEs. With
-- no DELETE policy Postgres filters the statement to zero rows and returns NO
-- error, so the action reports success and then revalidatePath("/plan") re-renders
-- the surviving row: the verdict the user just cleared lights straight back up,
-- with no error shown. A verdict also scores on «موسم بيتنا», so the retracted
-- opinion keeps counting.
--
-- body_logs has no delete path in the app today — this closes it before one is
-- written, since the failure mode is silent by construction.

drop policy if exists "Users can delete own meal verdicts" on public.meal_verdicts;
create policy "Users can delete own meal verdicts"
  on public.meal_verdicts for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own body logs" on public.body_logs;
create policy "Users can delete own body logs"
  on public.body_logs for delete
  using (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 2. plan_generations is an AUDIT table — users must not be able to rewrite it
-- ----------------------------------------------------------------------------
--
-- 00003 granted authenticated users UPDATE on their own plan_generations rows.
-- The browser holds the anon key and the user's JWT, so those rows are reachable
-- directly over PostgREST. That let a user:
--   * reset the weekly generation quota (canGeneratePlan counts these rows),
--   * clear a status='started' row to defeat the in-flight generation lock,
--   * rewrite cost_usd / tokens_in / tokens_out — the exact columns the admin
--     revenue and margin dashboards aggregate.
--
-- INSERT stays: createPlanRows runs with the user's client and must be able to
-- open the row. Every UPDATE has been moved to the service-role client in the
-- same change (dispatch.ts reclassifier + dispatch-failure writes, and the
-- dev-inline generation path, which now uses the admin client exactly as the
-- production background function already did).

drop policy if exists "Users can update own plan generations" on public.plan_generations;


-- ----------------------------------------------------------------------------
-- 3. One subscriptions row per user
-- ----------------------------------------------------------------------------
--
-- subscriptions has never had unique(user_id) — 00004's handle_new_user works
-- around it with WHERE NOT EXISTS, and getCurrentSubscription compensates by
-- ordering created_at desc and taking one. Meanwhile the LemonSqueezy webhook
-- writes with .eq("user_id", userId) and NO row limit, so it stamps every row a
-- user has, while its supersession guard inspects only the newest. Reads and
-- writes therefore disagree the moment a second row exists, and the resulting
-- state is not explainable from the UI.
--
-- De-duplicate to the newest row per user (the one the read path already
-- returns, so this cannot change any user's current entitlement), then enforce
-- the invariant the code has always assumed.

delete from public.subscriptions s
where exists (
  select 1
  from public.subscriptions keep
  where keep.user_id = s.user_id
    and (keep.created_at, keep.id) > (s.created_at, s.id)
);

create unique index if not exists subscriptions_one_per_user
  on public.subscriptions (user_id);


-- ----------------------------------------------------------------------------
-- 4. Webhook ordering guard
-- ----------------------------------------------------------------------------
--
-- The LemonSqueezy handler applies whatever arrives, in whatever order it
-- arrives. Webhook delivery is at-least-once and unordered, so a delayed or
-- retried subscription_updated carrying status='active' lands after
-- subscription_expired and quietly un-expires a dead subscription; a replayed
-- payment_failed re-marks a recovered one past_due.
--
-- LemonSqueezy payloads carry no event id, but subscription attributes carry
-- `updated_at` — the moment the change happened on their side. Recording the
-- latest one we have applied lets the handler ignore anything older, which
-- covers both replays (equal timestamp) and out-of-order delivery (older).

alter table public.subscriptions
  add column if not exists last_event_at timestamptz;

comment on column public.subscriptions.last_event_at is
  'attributes.updated_at of the most recent LemonSqueezy webhook applied to this row. Events at or before this are ignored as replays/out-of-order.';
