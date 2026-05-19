-- ============================================================================
-- Fit Life 2.0 — Plan generation audit columns + write RLS policies
-- ============================================================================
-- Migration: 00003
-- Created: 2026-05-19
--
-- Two things happen here:
--
-- 1. plan_generations table gains audit columns aligned with the new generation
--    pipeline (model, tokens_in/out, cost_usd, duration_ms, started_at,
--    completed_at, error_message). The old columns (ai_input_tokens,
--    ai_output_tokens, estimated_cost_usd, failure_reason, created_at) stay
--    in place as legacy — to be removed once we're confident on the new write
--    paths. The status CHECK is swapped from
--    ('success','rate_limited','failed','cancelled') to
--    ('started','completed','failed') and the DEFAULT becomes 'started'.
--
-- 2. Write RLS policies (INSERT + UPDATE) are added to meal_plans and
--    plan_generations so the cookie-bound generation flow can write its own
--    rows. The previous design called for service-role writes; the new
--    pipeline uses the user's authenticated server client, so we need user-
--    scoped INSERT/UPDATE policies bounded by auth.uid() = user_id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. plan_generations audit columns
-- ----------------------------------------------------------------------------

alter table public.plan_generations
  add column if not exists model text;

alter table public.plan_generations
  add column if not exists tokens_in integer;

alter table public.plan_generations
  add column if not exists tokens_out integer;

alter table public.plan_generations
  add column if not exists cost_usd numeric(10, 6);

alter table public.plan_generations
  add column if not exists duration_ms integer;

alter table public.plan_generations
  add column if not exists error_message text;

alter table public.plan_generations
  add column if not exists started_at timestamptz not null default now();

alter table public.plan_generations
  add column if not exists completed_at timestamptz;

-- Swap the status CHECK constraint to the new value set
alter table public.plan_generations
  drop constraint if exists plan_generations_status_check;

alter table public.plan_generations
  alter column status set default 'started';

alter table public.plan_generations
  add constraint plan_generations_status_check
  check (status in ('started', 'completed', 'failed'));

-- ----------------------------------------------------------------------------
-- 2. meal_plans — user write policies (INSERT + UPDATE on own rows)
-- ----------------------------------------------------------------------------

create policy "Users can insert own meal plans"
  on public.meal_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own meal plans"
  on public.meal_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. plan_generations — user write policies
-- ----------------------------------------------------------------------------

create policy "Users can insert own plan generations"
  on public.plan_generations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plan generations"
  on public.plan_generations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
