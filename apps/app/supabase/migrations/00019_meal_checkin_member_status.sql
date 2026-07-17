-- ============================================================================
-- 00019 — Per-person meal check-in status (meal_checkins.member_id)
--
-- Product pivot (07/2026, owner directive): on a SHARED meal, each person's
-- status is separate — Louis can skip the omelet while anas eats it. 00017
-- keyed check-ins household-level (one row per plan/day/slot); this migration
-- adds the member dimension using the exact convention meal_verdicts already
-- uses: member_id TEXT carrying the plan-JSON identity ("mom" |
-- family_members.id). RLS stays on user_id only (house rule) — no policy
-- changes needed.
--
--   * member_id — who this status belongs to. Existing rows keep the
--     'household' sentinel: they were written when one row spoke for the
--     whole house, and the app treats them as a read-time FALLBACK for every
--     member of that meal until a per-member mark supersedes them. New writes
--     always carry a concrete member ("mom" | family_members.id); the
--     ختام اليوم ritual keeps writing 'household' rows on purpose (the
--     kitchen's attestation).
--   * unique key grows from (meal_plan_id, day_index, slot) to include
--     member_id — the upsert conflict target in engagement/actions.ts moves
--     with it (both writers updated in the same commit as this file).
--
-- Unanswered is still UNKNOWN (absence of a row is never "skipped"), and the
-- no-amounts / no-consumption-surveillance stance is unchanged — a status is
-- about the dish serving, never about how much anyone ate.
--
-- Style per 00005/00013/00017/00018: idempotent (IF NOT EXISTS + guarded
-- drops), additive, enum-like text validated in Zod (no DB CHECK). Applied
-- MANUALLY to prod (no runner) — run after 00018, then re-run
-- scripts/verify-migrations.sql (now covers 00019) and
-- `pnpm --filter @fitlife/app db:types`.
-- ============================================================================

alter table public.meal_checkins
  add column if not exists member_id text not null default 'household';

comment on column public.meal_checkins.member_id is
  'Whose status this is: "mom" | family_members.id (plan-JSON convention). ''household'' = legacy pre-00019 row or a ختام اليوم whole-kitchen answer; the app reads it as a fallback for every member of that meal.';

-- Swap the uniqueness: one row per (plan, day, slot, member). Guarded so a
-- re-run is a no-op; the drop must precede the add (the old 3-column key
-- would reject per-member rows).
alter table public.meal_checkins
  drop constraint if exists meal_checkins_one_per_meal;

do $$
begin
  alter table public.meal_checkins
    add constraint meal_checkins_one_per_member_meal
    unique (meal_plan_id, day_index, slot, member_id);
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;
