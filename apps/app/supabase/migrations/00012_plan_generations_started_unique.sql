-- ============================================================================
-- Fit Life 2.0 — One in-flight generation per user (dispatch race fix)
-- ============================================================================
-- Migration: 00012
-- Created: 2026-07-03
--
-- The dispatch busy-guard (apps/app/src/lib/plans/dispatch.ts) reads for a
-- 'started' plan_generations row and then inserts — a read-then-act window
-- with nothing at the database level backing it. Two near-simultaneous
-- dispatches (two tabs, the deferred-member drain poll racing a refresh) both
-- pass the read and each start a FULL generation: double Anthropic spend and
-- two competing meal_plans rows.
--
-- This partial unique index makes the guard authoritative: at most ONE live
-- ('started') generation row per user. The loser of a race gets a 23505
-- unique violation, which createPlanRows (packages/plan-engine) maps to the
-- existing "busy" dispatch result. Terminal rows (completed/failed) and the
-- translation audit rows (inserted directly as 'completed') are outside the
-- predicate and unlimited.
--
-- The dedup pass below is defensive: if a past race already left multiple
-- live rows for one user, keep only the newest and fail the rest so the
-- index build cannot error. The dispatch stale-reclassifier already flips
-- >15-min 'started' rows to 'failed', so the index cannot deadlock a user
-- whose background worker was hard-killed.
-- ============================================================================

with ranked as (
  select id,
         row_number() over (partition by user_id order by started_at desc) as rn
  from public.plan_generations
  where status = 'started'
)
update public.plan_generations pg
set status = 'failed',
    error_message = 'superseded duplicate started row (00012 dedup)',
    completed_at = now()
from ranked r
where pg.id = r.id
  and r.rn > 1;

create unique index if not exists plan_generations_one_started_per_user
  on public.plan_generations (user_id)
  where status = 'started';
