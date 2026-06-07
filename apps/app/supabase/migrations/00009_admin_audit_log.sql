-- ============================================================================
-- Fit Life 2.0 — Admin audit log (PDPL accountability for back-office access)
-- ============================================================================
-- Migration: 00009
-- Created: 2026-06-07
--
-- Every time an admin views a subscriber's data through /admin we record an
-- access event here: WHO (admin), WHAT subscriber, WHAT was viewed, WHEN.
-- Views of sensitive health/medical detail are logged with a distinct action
-- so they can be audited separately (PDPL).
--
-- This table is written and read ONLY by the service-role (server) client.
-- Like admin_users, RLS is enabled with ZERO policies, so no browser-bound
-- client can read or tamper with the trail.
--
-- Retention vs erasure: the FKs use `on delete set null` rather than cascade,
-- so the audit ROW survives even after an admin or subscriber account is
-- deleted — the personal link is severed (de-identified) but the fact that an
-- access happened, and when, is retained for accountability. `detail` stores
-- metadata ABOUT the access (which section / member id), never the sensitive
-- values themselves.
-- ============================================================================

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  subscriber_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in (
    'view_subscriber_list',
    'view_subscriber_detail',
    'view_health_detail',
    'view_plan_data',
    'view_insights'
  )),
  detail jsonb,
  created_at timestamptz not null default now()
);

-- "All accesses to a given subscriber, newest first" (subscriber detail page)
-- and "this admin's recent activity" are the two read patterns.
create index if not exists admin_audit_log_subscriber_idx
  on public.admin_audit_log (subscriber_id, created_at desc);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

-- RLS ENABLED WITH ZERO POLICIES — service-role only (see admin_users for the
-- rationale). The audit trail must be unreadable and untamperable from any
-- client session; only server-side admin code touches it.
alter table public.admin_audit_log enable row level security;
