-- ============================================================================
-- Fit Life 2.0 — Admin audit: allow account-management actions
-- ============================================================================
-- Migration: 00011
-- Created: 2026-06-25
--
-- The admin subscriber-detail page can now deactivate / reactivate / delete a
-- subscriber account. Each is recorded in admin_audit_log, so the action `check`
-- constraint from 00010 must accept the three new action values.
--
-- A Postgres CHECK constraint can't be extended in place, so drop and re-add it.
-- The inline constraint from 00010 is auto-named `admin_audit_log_action_check`.
-- ============================================================================

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_action_check;

alter table public.admin_audit_log
  add constraint admin_audit_log_action_check check (action in (
    'view_subscriber_list',
    'view_subscriber_detail',
    'view_health_detail',
    'view_plan_data',
    'view_insights',
    'deactivate_subscriber_account',
    'reactivate_subscriber_account',
    'delete_subscriber_account'
  ));
