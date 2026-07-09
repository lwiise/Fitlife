-- ============================================================================
-- Fit Life 2.0 — Coach Sara full-intake expansion (employer spec, 07/2026)
-- ============================================================================
-- Migration: 00016
-- Created: 2026-07-09
--
-- The employer's intake questionnaire moves the deep-dive answers into main
-- onboarding and adds the remaining gaps. Most spec fields ALREADY exist
-- (waist_cm, stress_level, meals_per_day, intermittent_fasting,
-- food_recall_24h, liked_foods, previous_diets — 00013; water_liters — 00015).
-- This migration adds only what's genuinely new:
--   * phone            — optional contact number (basic data section)
--   * hip_cm           — محيط الورك, optional beside the required waist
--   * feeding_mode     — رضاعة كاملة/مختلطة for the ACCOUNT OWNER
--                        (family_members got it in 00013; profiles never did)
--   * never_eat_foods  — أطعمة لا تتناولها نهائياً: hard exclusions, distinct
--                        from dislikes (soft) and allergies (medical)
--   * pregnancy_month  — شهر الحمل 1-9; pregnancy_trimester stays and is
--                        DERIVED in code (ceil(month/3)) for engine parity
--   * sleep_band       — النوم bands (lt5/h5_6/h7_8/gt8) replacing the free
--                        numeric input; sleep_hours stays as legacy fallback
--
-- Cuisine list per spec (خليجي/عربي/آسيوي/غربي/متنوع): existing rows are
-- remapped to the nearest new value; labels live in the form + engine maps.
--
-- Style per 00005/00013: non-destructive (IF NOT EXISTS + defaults),
-- idempotent, enum-like text validated in Zod (no DB CHECK unless
-- safety-critical), multi-value lists as jsonb '[]'.
-- Applied MANUALLY to prod (no runner).
-- ============================================================================

-- ── New intake columns: profiles ────────────────────────────────────────────
alter table public.profiles
  add column if not exists phone text,
  add column if not exists hip_cm numeric(5,1),
  add column if not exists feeding_mode text,
  add column if not exists never_eat_foods jsonb default '[]'::jsonb,
  add column if not exists pregnancy_month integer,
  add column if not exists sleep_band text;

-- ── Range checks (safety-relevant numerics only) ────────────────────────────
alter table public.profiles drop constraint if exists profiles_hip_cm_check;
alter table public.profiles add constraint profiles_hip_cm_check
  check (hip_cm is null or hip_cm between 30 and 300);

alter table public.profiles drop constraint if exists profiles_pregnancy_month_check;
alter table public.profiles add constraint profiles_pregnancy_month_check
  check (pregnancy_month is null or pregnancy_month between 1 and 9);

-- ── Cuisine remap to the spec's five options ────────────────────────────────
-- New canonical set: khaleeji / arabic / asian / western / varied.
update public.profiles set cuisine_preference = 'arabic'
  where cuisine_preference = 'mediterranean';
update public.profiles set cuisine_preference = 'varied'
  where cuisine_preference = 'mixed';
update public.profiles set cuisine_preference = 'western'
  where cuisine_preference = 'international';
