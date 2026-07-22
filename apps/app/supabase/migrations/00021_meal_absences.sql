-- ============================================================================
-- 00021 — Shared-meal absences (meal_absences)
--
-- Owner directive (07/2026): on a SHARED meal, sometimes one member simply
-- isn't part of the meal that day. One tap excludes them from that meal
-- occurrence and the app ADJUSTS the displayed batch quantities for the
-- remaining sharers — the dish itself is never changed or regenerated (the
-- scaling is deterministic client-side math over per_member_portions). The
-- same directive returns the shared meal to a SINGLE status for the whole
-- dish (no per-participant chip rows); status storage stays per-present-
-- participant rows in meal_checkins, written in one fan-out (00019's
-- per-person schema is reused; only the UI/semantics changed).
--
-- This table is the sparse record of those exclusions:
--   * one row = "this member is not part of this meal occurrence"
--     keyed (meal_plan_id, day_index, slot, member_id) — same identity
--     convention as meal_checkins.
--   * local_date is the MEAL'S calendar date (week_start + day_index), and it
--     MAY BE IN THE FUTURE: absence is a planning fact ("she travels
--     Thursday"), not adherence — the no-future rule guards adherence marks
--     only. Stamped server-side like every other engagement date.
--   * member_id is TEXT carrying the plan-JSON identity ("mom" |
--     family_members.id); RLS stays on user_id only (house rule).
--   * Absence never implies anything was or wasn't EATEN — it only redirects
--     the batch math. No consumption surveillance, no shame states.
--   * Rows die with their plan (CASCADE): a regenerated week starts clean.
--
-- Style per 00005/00017/00019/00020: idempotent (IF NOT EXISTS + guarded
-- drops), additive, enum-like text validated in Zod (no DB CHECK beyond the
-- structural day_index range). DELETE policy ships day one (00019's lesson).
-- Applied MANUALLY to prod (no runner) — run after 00020, then re-run
-- scripts/verify-migrations.sql (now covers 00021) and
-- `pnpm --filter @fitlife/app db:types`.
-- ============================================================================

create table if not exists public.meal_absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day_index integer not null,
  local_date date not null,
  slot text not null,
  member_id text not null,
  created_at timestamptz not null default now(),
  constraint meal_absences_day_index_check check (day_index between 0 and 6),
  constraint meal_absences_one_per_member_meal
    unique (meal_plan_id, day_index, slot, member_id)
);

comment on table public.meal_absences is
  'Shared-meal exclusions: this member is not part of this meal occurrence — the app scales the batch for the remaining sharers. Planning fact (may be future-dated), never adherence.';

-- Per-plan lookups ride the unique constraint's index (meal_plan_id leads it);
-- only the export/PDPL read pattern needs its own.
create index if not exists meal_absences_user_created_idx
  on public.meal_absences (user_id, created_at desc);

alter table public.meal_absences enable row level security;

drop policy if exists "Users can read own meal absences" on public.meal_absences;
create policy "Users can read own meal absences"
  on public.meal_absences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal absences" on public.meal_absences;
create policy "Users can insert own meal absences"
  on public.meal_absences for insert
  with check (auth.uid() = user_id);

-- The upsert path (re-tapping an already-absent member is a no-op correction)
-- goes through ON CONFLICT DO UPDATE, which needs UPDATE.
drop policy if exists "Users can update own meal absences" on public.meal_absences;
create policy "Users can update own meal absences"
  on public.meal_absences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Restoring a member to the meal deletes the row — first-class from day one.
drop policy if exists "Users can delete own meal absences" on public.meal_absences;
create policy "Users can delete own meal absences"
  on public.meal_absences for delete
  using (auth.uid() = user_id);
