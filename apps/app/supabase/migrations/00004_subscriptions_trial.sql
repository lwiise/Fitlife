-- ============================================================================
-- Fit Life 2.0 — Subscriptions: trial infrastructure
-- ============================================================================
-- Migration: 00004
-- Created: 2026-05-19
--
-- Goals:
--   1. Add trial-tracking columns to subscriptions
--   2. Swap status CHECK from ('on_trial', 'active', 'paused', 'past_due',
--      'unpaid', 'cancelled', 'expired') to ('trialing', 'active', 'past_due',
--      'cancelled', 'expired')
--   3. Loosen NOT NULL on legacy LS columns so trial-only rows can exist
--   4. Add new lemonsqueezy_* and cadence columns (additive, legacy ls_* +
--      billing_interval stay in place)
--   5. Update handle_new_user trigger to also create a trial subscription row
--   6. Backfill existing users
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add new audit / billing columns
-- ----------------------------------------------------------------------------

alter table public.subscriptions add column if not exists cadence text;
alter table public.subscriptions add constraint subscriptions_cadence_check
  check (cadence is null or cadence in ('monthly', 'annual'));

alter table public.subscriptions add column if not exists trial_started_at timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists lemonsqueezy_subscription_id text;
alter table public.subscriptions add column if not exists lemonsqueezy_customer_id text;
alter table public.subscriptions add column if not exists lemonsqueezy_variant_id text;

-- ----------------------------------------------------------------------------
-- 2. Drop NOT NULL on legacy columns so trial rows can be inserted
-- ----------------------------------------------------------------------------

alter table public.subscriptions alter column ls_subscription_id drop not null;
alter table public.subscriptions alter column ls_customer_id drop not null;
alter table public.subscriptions alter column ls_variant_id drop not null;
alter table public.subscriptions alter column billing_interval drop not null;

-- Drop the unique constraint on ls_subscription_id since many trial rows will
-- have null in this column.
alter table public.subscriptions drop constraint if exists subscriptions_ls_subscription_id_key;

-- ----------------------------------------------------------------------------
-- 3. Migrate existing 'on_trial' values → 'trialing' before swapping the CHECK
-- ----------------------------------------------------------------------------

update public.subscriptions set status = 'trialing' where status = 'on_trial';

-- ----------------------------------------------------------------------------
-- 4. Swap the status CHECK constraint
-- ----------------------------------------------------------------------------

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions alter column status set default 'trialing';
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired'));

-- ----------------------------------------------------------------------------
-- 5. Ensure tier has a sensible default (so the trigger can omit it)
-- ----------------------------------------------------------------------------

alter table public.subscriptions alter column tier set default 'starter';

-- ----------------------------------------------------------------------------
-- 6. Update handle_new_user trigger to also create the trial subscription
-- ----------------------------------------------------------------------------

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

  -- Use WHERE NOT EXISTS because subscriptions has no unique(user_id) constraint.
  insert into public.subscriptions (
    user_id,
    tier,
    status,
    trial_started_at,
    trial_ends_at
  )
  select new.id, 'starter', 'trialing', now(), now() + interval '7 days'
  where not exists (
    select 1 from public.subscriptions where user_id = new.id
  );

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Backfill existing rows: fill trial dates where missing
-- ----------------------------------------------------------------------------

update public.subscriptions
set
  trial_started_at = coalesce(trial_started_at, created_at),
  trial_ends_at = coalesce(trial_ends_at, created_at + interval '7 days')
where trial_started_at is null or trial_ends_at is null;

-- ----------------------------------------------------------------------------
-- 8. Backfill: ensure every existing auth.user has a subscriptions row
-- ----------------------------------------------------------------------------

insert into public.subscriptions (user_id, tier, status, trial_started_at, trial_ends_at)
select u.id, 'starter', 'trialing', u.created_at, u.created_at + interval '7 days'
from auth.users u
where not exists (
  select 1 from public.subscriptions s where s.user_id = u.id
);
