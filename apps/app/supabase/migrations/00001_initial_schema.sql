-- ============================================================================
-- Fit Life 2.0 — Initial Schema
-- ============================================================================
-- Migration: 00001
-- Created: 2026-05-18
--
-- Tables:
--   profiles         — extends auth.users (Mom is primary user)
--   family_members   — household members (Dad, Kids, Housekeeper)
--   meal_plans       — AI-generated meal plans (JSONB structure)
--   subscriptions    — Lemonsqueezy subscription state
--   plan_generations — audit log for rate limiting + cost tracking
--
-- RLS: every user-scoped table enforces "user sees own data only"
-- Cascades: auth.users delete removes all child rows (PDPL/GDPR compliance)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles — extends auth.users with app-specific data
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  -- Identity
  display_name text,
  preferred_language text not null default 'ar' check (preferred_language in ('ar', 'en')),

  -- Mom's profile (the primary user)
  birth_year integer check (birth_year between 1940 and extract(year from now())::integer),
  weight_kg numeric(5,2) check (weight_kg between 20 and 300),
  height_cm numeric(5,2) check (height_cm between 80 and 250),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  primary_goal text check (primary_goal in ('lose_weight', 'maintain', 'gain_weight', 'general_health', 'pregnancy', 'post_pregnancy')),

  -- Cultural / dietary
  cuisine_preference text not null default 'khaleeji' check (cuisine_preference in ('khaleeji', 'mixed', 'mediterranean')),
  dietary_restrictions text[] default '{}'::text[],  -- e.g., ['gluten_free', 'lactose_intolerant']

  -- Medical safety (for plan generation guardrails)
  has_medical_conditions boolean not null default false,
  medical_conditions text[] default '{}'::text[],     -- e.g., ['diabetes_t2', 'hypertension', 'pregnancy']
  is_pregnant boolean not null default false,
  pregnancy_trimester integer check (pregnancy_trimester between 1 and 3),
  consulted_doctor boolean not null default false,

  -- Onboarding state
  onboarding_completed_at timestamptz,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Extends auth.users with Fit Life-specific Mom profile data.';
comment on column public.profiles.medical_conditions is 'Array of conditions that affect AI plan generation: diabetes_t1, diabetes_t2, hypertension, hypothyroid, etc.';
comment on column public.profiles.consulted_doctor is 'User explicitly acknowledged consulting their doctor for medical conditions before using the plan.';

-- Index for fast lookup by language preference (for future i18n features)
create index profiles_language_idx on public.profiles(preferred_language);

-- ----------------------------------------------------------------------------
-- 2. family_members — household members beyond the Mom
-- ----------------------------------------------------------------------------

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Identity
  name text not null,
  role text not null check (role in ('dad', 'son', 'daughter', 'housekeeper', 'other_adult', 'other_child')),

  -- Personalization
  birth_year integer check (birth_year between 1940 and extract(year from now())::integer),
  weight_kg numeric(5,2) check (weight_kg between 5 and 300),
  height_cm numeric(5,2) check (height_cm between 40 and 250),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  primary_goal text check (primary_goal in ('lose_weight', 'maintain', 'gain_weight', 'general_health', 'child_growth')),

  -- Language (critical for housekeeper)
  preferred_language text not null default 'ar' check (preferred_language in ('ar', 'en', 'tl', 'id', 'bn', 'am', 'ur')),

  -- Dietary
  dietary_restrictions text[] default '{}'::text[],
  medical_conditions text[] default '{}'::text[],

  -- Order for display in family card row
  display_order integer not null default 0,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.family_members is 'Household members other than the Mom. Each has their own personalized plan.';
comment on column public.family_members.preferred_language is 'Member language — used to render their portion of the plan in their language. ar=Arabic, en=English, tl=Tagalog, id=Indonesian, bn=Bengali, am=Amharic, ur=Urdu.';
comment on column public.family_members.display_order is 'Display order in the UI (Mom card always first, others ordered by this column).';

create index family_members_user_id_idx on public.family_members(user_id);
create index family_members_user_id_display_order_idx on public.family_members(user_id, display_order);

-- ----------------------------------------------------------------------------
-- 3. meal_plans — AI-generated nutrition plans
-- ----------------------------------------------------------------------------

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Plan metadata
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed', 'archived')),
  generated_at timestamptz,
  error_message text,

  -- The actual plan (structure may evolve; JSONB lets us iterate without migrations)
  plan_data jsonb,

  -- AI generation metadata (for cost tracking + debugging)
  ai_model text,                -- e.g., 'claude-sonnet-4'
  ai_input_tokens integer,
  ai_output_tokens integer,
  ai_generation_seconds numeric(6,2),

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meal_plans is 'AI-generated meal plans. plan_data structure: { week_start_date, days: [{ date, members: [{ member_id, meals: [{ slot, name, calories, ingredients, prep_notes }] }] }] }';
comment on column public.meal_plans.status is 'generating=AI in progress, ready=visible to user, failed=error during generation, archived=user generated a newer plan';

create index meal_plans_user_id_idx on public.meal_plans(user_id);
create index meal_plans_user_id_status_idx on public.meal_plans(user_id, status);
create index meal_plans_generated_at_idx on public.meal_plans(generated_at desc);

-- ----------------------------------------------------------------------------
-- 4. subscriptions — Lemonsqueezy subscription state
-- ----------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Lemonsqueezy identifiers
  ls_subscription_id text unique not null,
  ls_customer_id text not null,
  ls_variant_id text not null,    -- which tier (starter, pro, family, premium)
  ls_order_id text,

  -- Subscription state (mirrors Lemonsqueezy status)
  tier text not null check (tier in ('starter', 'pro', 'family', 'premium')),
  status text not null check (status in (
    'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired'
  )),

  -- Billing period
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  ends_at timestamptz,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is 'Mirrors Lemonsqueezy subscription state. Updated via webhook.';

create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_user_id_status_idx on public.subscriptions(user_id, status);
create index subscriptions_ls_subscription_id_idx on public.subscriptions(ls_subscription_id);

-- ----------------------------------------------------------------------------
-- 5. plan_generations — audit log for rate limiting + cost tracking
-- ----------------------------------------------------------------------------

create table public.plan_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_plan_id uuid references public.meal_plans(id) on delete set null,

  -- Cost tracking
  ai_input_tokens integer not null default 0,
  ai_output_tokens integer not null default 0,
  estimated_cost_usd numeric(8,4) not null default 0,

  -- Status
  status text not null check (status in ('success', 'rate_limited', 'failed', 'cancelled')),
  failure_reason text,

  -- Audit
  created_at timestamptz not null default now()
);

comment on table public.plan_generations is 'One row per AI generation attempt — for rate limiting (3/week per user) and cost tracking.';

create index plan_generations_user_id_idx on public.plan_generations(user_id);
create index plan_generations_user_id_created_at_idx on public.plan_generations(user_id, created_at desc);

-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger family_members_updated_at
  before update on public.family_members
  for each row execute function public.handle_updated_at();

create trigger meal_plans_updated_at
  before update on public.meal_plans
  for each row execute function public.handle_updated_at();

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- AUTO-CREATE PROFILE ON AUTH.USERS INSERT
-- ============================================================================
-- When a user signs up via magic link, automatically create their profile row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', null),
    coalesce(new.raw_user_meta_data->>'preferred_language', 'ar')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
