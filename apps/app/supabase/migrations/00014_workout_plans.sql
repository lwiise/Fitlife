-- ============================================================================
-- Fit Life 2.0 — Workout plans (meals-first fork, separate exercise plan)
-- ============================================================================
-- Migration: 00014
-- Created: 2026-07-07
--
-- Product decision: meals and exercise are SEPARATE plans. Onboarding runs
-- the meals questionnaire first; at its end the user can opt in to ~7
-- exercise questions and one action generates both plans. The workout plan
-- generates into its own table (own status lifecycle, own background job)
-- so a failing/slow workout run never touches the meal plan and vice versa.
--
-- Also reworks the in-flight generation lock: 00012's index allowed ONE
-- 'started' plan_generations row per user, which would make a meal run and
-- a workout run mutually exclusive. The lock is now per (user, plan_kind):
-- one live MEAL generation AND one live WORKOUT generation may coexist.
--
-- House rules: idempotent, additive, enum-like text validated in Zod,
-- applied MANUALLY to prod (no runner) — apply BEFORE deploying the code
-- that dispatches workout generations.
-- ============================================================================

-- ── workout_plans — mirrors meal_plans (00001) ─────────────────────────────
create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- 'archived' is required: the dispatch race-loser path archives (never
  -- fails) its placeholder so it can't surface as the latest plan.
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed', 'archived')),
  generated_at timestamptz,
  error_message text,

  -- { members: [{ member_id, split_name_ar, weekly_sessions: [...] }] }
  plan_data jsonb,

  ai_model text,
  ai_input_tokens integer,
  ai_output_tokens integer,
  ai_generation_seconds numeric(6,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workout_plans is 'AI-generated weekly resistance-training programs (separate from meal_plans; generated on opt-in).';

create index if not exists workout_plans_user_id_idx on public.workout_plans(user_id);
create index if not exists workout_plans_user_id_status_idx on public.workout_plans(user_id, status);
create index if not exists workout_plans_generated_at_idx on public.workout_plans(generated_at desc);

drop trigger if exists workout_plans_updated_at on public.workout_plans;
create trigger workout_plans_updated_at
  before update on public.workout_plans
  for each row execute function public.handle_updated_at();

-- RLS: user SELECT + user INSERT/UPDATE (dispatch runs on the cookie-bound
-- client — same reasoning as meal_plans' 00003 write policies).
alter table public.workout_plans enable row level security;

drop policy if exists "Users can view own workout plans" on public.workout_plans;
create policy "Users can view own workout plans"
  on public.workout_plans for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout plans" on public.workout_plans;
create policy "Users can insert own workout plans"
  on public.workout_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout plans" on public.workout_plans;
create policy "Users can update own workout plans"
  on public.workout_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Opt-in questionnaire answers (null = not opted in; shape owned by Zod) ─
alter table public.profiles
  add column if not exists workout_profile jsonb;

alter table public.family_members
  add column if not exists workout_profile jsonb;

-- ── plan_generations: kind-aware audit + per-kind in-flight lock ───────────
alter table public.plan_generations
  add column if not exists plan_kind text not null default 'meal',
  add column if not exists workout_plan_id uuid references public.workout_plans(id) on delete set null;

alter table public.plan_generations drop constraint if exists plan_generations_plan_kind_check;
alter table public.plan_generations add constraint plan_generations_plan_kind_check
  check (plan_kind in ('meal', 'workout'));

-- Replace the 00012 user-only lock with a per-kind lock: one live meal run
-- AND one live workout run may coexist; two of the SAME kind may not.
drop index if exists public.plan_generations_one_started_per_user;

create unique index if not exists plan_generations_one_started_per_user_kind
  on public.plan_generations (user_id, plan_kind)
  where status = 'started';
