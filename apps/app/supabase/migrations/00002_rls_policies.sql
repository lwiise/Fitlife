-- ============================================================================
-- Fit Life 2.0 — Row Level Security Policies
-- ============================================================================
-- Migration: 00002
-- Created: 2026-05-18
--
-- Rule: users can only see and modify their own data.
-- Service role (used in server-side Anthropic-calling code) bypasses RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Note: no DELETE policy — deletes cascade from auth.users only.

-- ----------------------------------------------------------------------------
-- family_members
-- ----------------------------------------------------------------------------

alter table public.family_members enable row level security;

create policy "Users can view own family members"
  on public.family_members for select
  using (auth.uid() = user_id);

create policy "Users can insert own family members"
  on public.family_members for insert
  with check (auth.uid() = user_id);

create policy "Users can update own family members"
  on public.family_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own family members"
  on public.family_members for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- meal_plans
-- ----------------------------------------------------------------------------

alter table public.meal_plans enable row level security;

create policy "Users can view own meal plans"
  on public.meal_plans for select
  using (auth.uid() = user_id);

-- Users cannot directly insert/update/delete meal plans.
-- Only the service-role-authenticated AI generation endpoint creates these.
-- This prevents users from injecting arbitrary plan data.

-- ----------------------------------------------------------------------------
-- subscriptions
-- ----------------------------------------------------------------------------

alter table public.subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Users cannot directly insert/update/delete subscriptions.
-- Only the Lemonsqueezy webhook (service role) writes to this table.

-- ----------------------------------------------------------------------------
-- plan_generations
-- ----------------------------------------------------------------------------

alter table public.plan_generations enable row level security;

create policy "Users can view own plan generations"
  on public.plan_generations for select
  using (auth.uid() = user_id);

-- Users cannot directly insert/update/delete.
-- Only the AI generation endpoint (service role) writes audit log entries.
