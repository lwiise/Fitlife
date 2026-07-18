-- ============================================================================
-- 00020 — Workout session check-ins (workout_checkins)
--
-- The exercise pillar of the engagement layer. Until now WorkoutViewer was
-- read-only: the household could follow the program but never mark a session,
-- so "following the exercises" had no signal and could not feed «موسم بيتنا».
-- This adds the first workout event table, mirroring meal_checkins (00017) —
-- per-person, local_date-stamped, no-shame, honest.
--
--   * member_id — TEXT carrying the plan-JSON convention ("mom" |
--     family_members.id), same as meal_checkins/meal_verdicts. RLS on user_id
--     only (house rule). Workout eligibility (opted-in adults; children and the
--     housekeeper never) is enforced in app code, as elsewhere.
--   * day_index — WEEKDAY-anchored 0..6 (0 = Sunday = JS Date#getDay), matching
--     WorkoutViewer and the workout plan JSON. NOTE this differs from
--     meal_checkins.day_index, which is week_start-offset-anchored — which is
--     exactly why local_date exists.
--   * local_date — Riyadh-local calendar date stamped at WRITE time (the
--     universal calendar key for streaks/seasons across meals and workouts).
--     A session may be marked only on its weekday within a 48h grace window;
--     the date is derived + enforced server-side (never supplied by the client,
--     never a future day).
--   * status — done | moved | skipped, enum-like TEXT validated in Zod (no DB
--     CHECK, house convention). "moved" is the honest middle (trained, but not
--     this exact session); absence of a row is UNKNOWN, never "skipped".
--
-- DELETE policy ships DAY ONE — the meal tables learned this the hard way
-- (00017 omitted it, so every clear-a-mistap was a silent RLS no-op until
-- 00019). Clearing a mark is first-class here from the start.
--
-- PDPL: cascades from profiles(id) → auth.users deletion wipes it;
-- /api/account/export includes workout_checkins in the same release.
--
-- Style per 00017/00019: idempotent (IF NOT EXISTS + guarded drops), additive,
-- enum-like text validated in Zod. Applied MANUALLY to prod (no runner) — run
-- after 00019, then re-run scripts/verify-migrations.sql (now covers 00020)
-- and `pnpm --filter @fitlife/app db:types`.
-- ============================================================================

create table if not exists public.workout_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_plan_id uuid not null references public.workout_plans(id) on delete cascade,
  member_id text not null,
  day_index integer not null,
  local_date date not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_checkins_day_index_check check (day_index between 0 and 6),
  constraint workout_checkins_one_per_member_session
    unique (workout_plan_id, member_id, day_index)
);

comment on column public.workout_checkins.member_id is
  'Whose session this is: "mom" | family_members.id (plan-JSON convention).';
comment on column public.workout_checkins.day_index is
  'Weekday-anchored 0..6 (0=Sunday, JS getDay) — matches the workout plan JSON, unlike meal_checkins.day_index. Join on local_date across surfaces.';

-- Season/streak aggregation reads "this user's days" by date.
create index if not exists workout_checkins_user_local_date_idx
  on public.workout_checkins (user_id, local_date desc);
create index if not exists workout_checkins_user_created_idx
  on public.workout_checkins (user_id, created_at desc);

alter table public.workout_checkins enable row level security;

drop policy if exists "Users can read own workout checkins" on public.workout_checkins;
create policy "Users can read own workout checkins"
  on public.workout_checkins for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout checkins" on public.workout_checkins;
create policy "Users can insert own workout checkins"
  on public.workout_checkins for insert
  with check (auth.uid() = user_id);

-- Grace-window edits: a status may be changed (48h window enforced in app).
drop policy if exists "Users can update own workout checkins" on public.workout_checkins;
create policy "Users can update own workout checkins"
  on public.workout_checkins for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Clearing a mark is first-class (a mis-tap must be reversible). Shipped from
-- day one, unlike 00017.
drop policy if exists "Users can delete own workout checkins" on public.workout_checkins;
create policy "Users can delete own workout checkins"
  on public.workout_checkins for delete
  using (auth.uid() = user_id);

drop trigger if exists workout_checkins_updated_at on public.workout_checkins;
create trigger workout_checkins_updated_at
  before update on public.workout_checkins
  for each row execute function public.handle_updated_at();
