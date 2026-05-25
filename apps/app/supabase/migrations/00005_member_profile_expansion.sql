-- 00005_member_profile_expansion.sql
-- Prompt 1.8c — per-member personalization + family-coordinated planning.
-- Restructures member capture: family-wide preferences (on profiles), Mom's
-- expanded personal profile (on profiles), and per-member fields branched by
-- member_type (on family_members). Non-destructive: every new column has a
-- DEFAULT, and existing rows keep working. Idempotent (IF NOT EXISTS + guarded
-- constraint drops) so re-runs are safe.

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — Mom is also a "member"; family-wide prefs live here (household owner)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists sex text default 'female';
alter table public.profiles add column if not exists member_type text not null default 'adult';
alter table public.profiles add column if not exists allergies jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists dislikes jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists months_postpartum integer;
alter table public.profiles add column if not exists high_risk_pregnancy boolean default false;

-- Family-wide preferences (cuisine reuses existing profiles.cuisine_preference)
alter table public.profiles add column if not exists family_dietary_restrictions jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists family_dislikes jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists cooking_methods jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists meal_out_frequency text;

-- Onboarding phase tracking
alter table public.profiles add column if not exists family_wide_completed_at timestamptz;
alter table public.profiles add column if not exists mom_profile_completed_at timestamptz;
alter table public.profiles add column if not exists member_addition_order jsonb default '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────
-- family_members — per-member fields (branched by member_type at the UI layer)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.family_members add column if not exists member_type text not null default 'adult';
alter table public.family_members add column if not exists sex text;
alter table public.family_members add column if not exists consulted_doctor boolean default false;
alter table public.family_members add column if not exists allergies jsonb default '[]'::jsonb;
alter table public.family_members add column if not exists dislikes jsonb default '[]'::jsonb;
alter table public.family_members add column if not exists trimester integer;
alter table public.family_members add column if not exists months_postpartum integer;
alter table public.family_members add column if not exists high_risk_pregnancy boolean default false;
alter table public.family_members add column if not exists school_meal_handling text;
alter table public.family_members add column if not exists picky_eater boolean default false;

-- ─────────────────────────────────────────────────────────────────────────
-- CHECK constraints (guarded drops so the migration is idempotent)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_member_type_check;
alter table public.profiles add constraint profiles_member_type_check
  check (member_type in ('adult','child','pregnant','lactating','housekeeper'));

alter table public.family_members drop constraint if exists family_members_type_check;
alter table public.family_members add constraint family_members_type_check
  check (member_type in ('adult','child','pregnant','lactating','housekeeper'));

alter table public.family_members drop constraint if exists family_members_trimester_check;
alter table public.family_members add constraint family_members_trimester_check
  check (trimester is null or trimester between 1 and 3);

alter table public.family_members drop constraint if exists family_members_postpartum_check;
alter table public.family_members add constraint family_members_postpartum_check
  check (months_postpartum is null or months_postpartum between 0 and 24);

alter table public.profiles drop constraint if exists profiles_postpartum_check;
alter table public.profiles add constraint profiles_postpartum_check
  check (months_postpartum is null or months_postpartum between 0 and 24);

-- Widen cuisine to include 'international' (عالمي) for the family-wide question.
alter table public.profiles drop constraint if exists profiles_cuisine_preference_check;
alter table public.profiles add constraint profiles_cuisine_preference_check
  check (cuisine_preference in ('khaleeji','mixed','mediterranean','international'));

-- primary_goal: widen both tables to Sara's 8 goals ∪ legacy slugs (non-destructive).
-- The inline checks from 00001 are auto-named *_primary_goal_check.
alter table public.profiles drop constraint if exists profiles_primary_goal_check;
alter table public.profiles add constraint profiles_primary_goal_check
  check (primary_goal is null or primary_goal in (
    -- Sara's 8
    'fat_loss','muscle_gain','body_recomposition','athletic_performance',
    'metabolic_health','digestive_health','pregnancy_lactation','posture_recovery',
    -- legacy
    'lose_weight','maintain','gain_weight','general_health','pregnancy','post_pregnancy','child_growth'
  ));

alter table public.family_members drop constraint if exists family_members_primary_goal_check;
alter table public.family_members add constraint family_members_primary_goal_check
  check (primary_goal is null or primary_goal in (
    'fat_loss','muscle_gain','body_recomposition','athletic_performance',
    'metabolic_health','digestive_health','pregnancy_lactation','posture_recovery',
    'lose_weight','maintain','gain_weight','general_health','pregnancy','post_pregnancy','child_growth'
  ));
