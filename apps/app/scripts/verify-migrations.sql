-- ============================================================================
-- Fit Life 2.0 — migration status report (READ-ONLY)
-- ============================================================================
-- Paste into the Supabase SQL Editor (prod) and run. Each row tells you
-- whether a migration's fingerprint object exists. Nothing is modified.
--
-- If anything shows MISSING: open apps/app/supabase/migrations/ and run the
-- missing files in numeric order. Every migration from 00008 onward is
-- idempotent (IF NOT EXISTS / guarded drops), so re-running an
-- already-applied file is a harmless no-op — when in doubt, run 00008→00014
-- in order.
-- ============================================================================

select * from (values
  ('00008 admin_users table',
    (select case when to_regclass('public.admin_users') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00009 profiles.meal_mode',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='meal_mode')
      then 'APPLIED' else 'MISSING' end)),
  ('00010 admin_audit_log table',
    (select case when to_regclass('public.admin_audit_log') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00011 audit CHECK includes account actions',
    (select case when exists (select 1 from information_schema.check_constraints
      where constraint_schema='public' and constraint_name='admin_audit_log_action_check'
        and check_clause like '%delete_subscriber_account%')
      then 'APPLIED' else 'MISSING' end)),
  ('00012 one-started-per-user index (superseded by 00014)',
    (select case
      when exists (select 1 from pg_indexes where schemaname='public'
        and indexname='plan_generations_one_started_per_user_kind') then 'SUPERSEDED BY 00014 (ok)'
      when exists (select 1 from pg_indexes where schemaname='public'
        and indexname='plan_generations_one_started_per_user') then 'APPLIED (old form — run 00014)'
      else 'MISSING' end)),
  ('00013 questionnaire columns (profiles.target_weight_kg)',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='target_weight_kg')
      then 'APPLIED' else 'MISSING' end)),
  ('00013 lactation fix (family_members.feeding_mode)',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='family_members' and column_name='feeding_mode')
      then 'APPLIED' else 'MISSING' end)),
  ('00014 workout_plans table',
    (select case when to_regclass('public.workout_plans') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00014 plan_generations.plan_kind',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='plan_generations' and column_name='plan_kind')
      then 'APPLIED' else 'MISSING' end)),
  ('00014 per-kind in-flight lock index',
    (select case when exists (select 1 from pg_indexes where schemaname='public'
      and indexname='plan_generations_one_started_per_user_kind')
      then 'APPLIED' else 'MISSING' end)),
  ('00014 workout opt-in columns (profiles.workout_profile)',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='workout_profile')
      then 'APPLIED' else 'MISSING' end)),
  ('00015 water in liters (profiles.water_liters)',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='water_liters')
      then 'APPLIED' else 'MISSING' end)),
  ('00016 intake expansion (profiles.sleep_band)',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='sleep_band')
      then 'APPLIED' else 'MISSING' end)),
  ('00016 cuisine remap (five-option CHECK)',
    (select case when exists (select 1 from information_schema.check_constraints
      where constraint_schema='public' and constraint_name='profiles_cuisine_preference_check'
        and check_clause like '%khaleeji%')
      then 'APPLIED' else 'MISSING' end)),
  ('00017 meal_checkins table',
    (select case when to_regclass('public.meal_checkins') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00017 member_exceptions table',
    (select case when to_regclass('public.member_exceptions') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00017 meal_verdicts table',
    (select case when to_regclass('public.meal_verdicts') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00017 body_logs table',
    (select case when to_regclass('public.body_logs') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00017 one-checkin-per-meal unique (superseded by 00019)',
    (select case
      when exists (select 1 from pg_indexes where schemaname='public'
        and indexname='meal_checkins_one_per_member_meal') then 'SUPERSEDED BY 00019 (ok)'
      when exists (select 1 from pg_indexes where schemaname='public'
        and indexname='meal_checkins_one_per_meal') then 'APPLIED (old form — run 00019)'
      else 'MISSING' end)),
  ('00018 body photo column (body_logs.photo_path)',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='body_logs' and column_name='photo_path')
      then 'APPLIED' else 'MISSING' end)),
  ('00018 private body-photos bucket',
    (select case when exists (select 1 from storage.buckets
      where id='body-photos' and public=false)
      then 'APPLIED' else 'MISSING' end)),
  ('00019 per-person check-in column (meal_checkins.member_id)',
    (select case when exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='meal_checkins' and column_name='member_id')
      then 'APPLIED' else 'MISSING' end)),
  ('00019 one-checkin-per-member-meal unique',
    (select case when exists (select 1 from pg_indexes where schemaname='public'
      and indexname='meal_checkins_one_per_member_meal')
      then 'APPLIED' else 'MISSING' end)),
  ('00019 meal_checkins DELETE policy (clears were silent no-ops without it)',
    (select case when exists (select 1 from pg_policies
      where schemaname='public' and tablename='meal_checkins' and cmd='DELETE')
      then 'APPLIED' else 'MISSING' end)),
  ('00020 workout_checkins table',
    (select case when to_regclass('public.workout_checkins') is not null
      then 'APPLIED' else 'MISSING' end)),
  ('00020 workout_checkins DELETE policy (shipped day one)',
    (select case when exists (select 1 from pg_policies
      where schemaname='public' and tablename='workout_checkins' and cmd='DELETE')
      then 'APPLIED' else 'MISSING' end))
) as report(migration, status);
