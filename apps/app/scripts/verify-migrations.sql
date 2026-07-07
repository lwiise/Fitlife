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
      then 'APPLIED' else 'MISSING' end))
) as report(migration, status);
