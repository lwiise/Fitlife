-- ============================================================================
-- Fit Life 2.0 — Coach Sara questionnaire expansion
-- ============================================================================
-- Migration: 00013
-- Created: 2026-07-04
--
-- Coach Sara's intake review (07/2026): add the condensed question set to
-- onboarding (target weight, concrete exercise habits, water, sleep,
-- medications/supplements, free notes) plus the optional "deep dive" fields
-- collected post-first-plan. Also fixes two data-model gaps she surfaced:
--   * feeding_mode — the lactating wizard ASKED this but never persisted it;
--   * nausea_foods — pregnancy nausea foods were being stored in `allergies`
--     (they are temporary aversions, not allergens).
--
-- activity_level remains the canonical 5-level enum (matches the Saudi MOH
-- calculator multipliers 1.2/1.375/1.55/1.725/1.9). It is now DERIVED in code
-- (apps/app/src/lib/plans/activityLevel.ts) from day_nature × exercise_days;
-- the raw answers are stored alongside it.
--
-- Goals: the UI adds "maintain weight" and "improve health" first-class
-- options mapping to 'maintain' and 'general_health' — both ALREADY permitted
-- by the primary_goal CHECKs since 00005 (legacy list). No constraint change.
--
-- Style per 00005: non-destructive (IF NOT EXISTS + defaults), idempotent,
-- enum-like text validated in Zod (no DB CHECK unless safety-critical),
-- multi-value lists as jsonb '[]'. Applied MANUALLY to prod (no runner).
-- ============================================================================

-- ── Condensed set: profiles ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists target_weight_kg numeric(5,2),
  add column if not exists day_nature text,
  add column if not exists exercise_days text,
  add column if not exists exercise_type text,
  add column if not exists water_cups integer,
  add column if not exists sleep_hours numeric(3,1),
  add column if not exists medications jsonb default '[]'::jsonb,
  add column if not exists supplements jsonb default '[]'::jsonb,
  add column if not exists notes text,
  add column if not exists nausea_foods jsonb default '[]'::jsonb;

-- ── Condensed set: family_members (+ lactating feeding mode) ───────────────
alter table public.family_members
  add column if not exists target_weight_kg numeric(5,2),
  add column if not exists day_nature text,
  add column if not exists exercise_days text,
  add column if not exists exercise_type text,
  add column if not exists water_cups integer,
  add column if not exists sleep_hours numeric(3,1),
  add column if not exists medications jsonb default '[]'::jsonb,
  add column if not exists supplements jsonb default '[]'::jsonb,
  add column if not exists nausea_foods jsonb default '[]'::jsonb,
  add column if not exists feeding_mode text;

-- ── Range checks (safety-relevant numerics only; enum text stays Zod-side) ─
alter table public.profiles drop constraint if exists profiles_target_weight_kg_check;
alter table public.profiles add constraint profiles_target_weight_kg_check
  check (target_weight_kg is null or target_weight_kg between 20 and 300);

alter table public.family_members drop constraint if exists family_members_target_weight_kg_check;
alter table public.family_members add constraint family_members_target_weight_kg_check
  check (target_weight_kg is null or target_weight_kg between 20 and 300);

alter table public.profiles drop constraint if exists profiles_water_cups_check;
alter table public.profiles add constraint profiles_water_cups_check
  check (water_cups is null or water_cups between 0 and 40);

alter table public.family_members drop constraint if exists family_members_water_cups_check;
alter table public.family_members add constraint family_members_water_cups_check
  check (water_cups is null or water_cups between 0 and 40);

alter table public.profiles drop constraint if exists profiles_sleep_hours_check;
alter table public.profiles add constraint profiles_sleep_hours_check
  check (sleep_hours is null or sleep_hours between 2 and 16);

alter table public.family_members drop constraint if exists family_members_sleep_hours_check;
alter table public.family_members add constraint family_members_sleep_hours_check
  check (sleep_hours is null or sleep_hours between 2 and 16);

alter table public.family_members drop constraint if exists family_members_feeding_mode_check;
alter table public.family_members add constraint family_members_feeding_mode_check
  check (feeding_mode is null or feeding_mode in ('exclusive','mixed','formula'));

-- ── Deep-dive set (Phase B screen; inert until it ships): profiles only ────
alter table public.profiles
  add column if not exists waist_cm numeric(5,2),
  add column if not exists steps_daily integer,
  add column if not exists exercise_duration text,
  add column if not exists liked_foods jsonb default '[]'::jsonb,
  add column if not exists meals_per_day integer,
  add column if not exists snacks_habit text,
  add column if not exists breakfast_habit text,
  add column if not exists intermittent_fasting text,
  add column if not exists food_recall_24h text,
  add column if not exists sleep_quality text,
  add column if not exists stress_level text,
  add column if not exists who_cooks text,
  add column if not exists cooking_time text,
  add column if not exists previous_diets text,
  add column if not exists food_budget text,
  add column if not exists deep_dive_completed_at timestamptz;

alter table public.profiles drop constraint if exists profiles_waist_cm_check;
alter table public.profiles add constraint profiles_waist_cm_check
  check (waist_cm is null or waist_cm between 30 and 250);

alter table public.profiles drop constraint if exists profiles_steps_daily_check;
alter table public.profiles add constraint profiles_steps_daily_check
  check (steps_daily is null or steps_daily between 0 and 60000);

alter table public.profiles drop constraint if exists profiles_meals_per_day_check;
alter table public.profiles add constraint profiles_meals_per_day_check
  check (meals_per_day is null or meals_per_day between 1 and 8);
