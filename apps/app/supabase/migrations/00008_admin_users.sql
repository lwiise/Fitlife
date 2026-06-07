-- ============================================================================
-- Fit Life 2.0 — Admin role table (back-office access control)
-- ============================================================================
-- Migration: 00008
-- Created: 2026-06-07
--
-- The internal admin dashboard (/admin) exposes every subscriber's PII and
-- health data, so admin status MUST NOT be self-grantable. We model it as a
-- dedicated table — NOT a boolean on profiles, NOT an env allowlist — so that:
--
--   1. RLS DENIES all access to anon + authenticated roles (zero policies
--      below). No browser-bound client can ever read or write this table, so
--      a normal user cannot read who the admins are, nor escalate themselves.
--   2. Only the service-role (server) Supabase client — which bypasses RLS —
--      can read it, and only from server-side admin code.
--   3. Granting/revoking admin is a single DB row: no redeploy, no code change.
--
-- The `role` column exists for future granularity (e.g. read-only support vs
-- full super_admin). v1 treats any row here as "admin"; routes may branch on
-- role later without a schema change.
--
-- Rows cascade on account deletion via the user_id FK (PDPL erasure).
-- ============================================================================

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin', 'support')),
  created_at timestamptz not null default now()
);

-- RLS ENABLED WITH ZERO POLICIES.
-- This is intentional and load-bearing: with RLS on and no policy granting
-- access, the anon and authenticated roles can neither select nor mutate any
-- row. Only the service_role key (server-only) bypasses RLS to read this table.
-- DO NOT add a select/insert/update policy here — doing so would let logged-in
-- users discover or modify admin membership.
alter table public.admin_users enable row level security;

-- ----------------------------------------------------------------------------
-- Seeding the first admin (run manually, server-side, never via the app UI)
-- ----------------------------------------------------------------------------
-- Replace the email below with the operator's auth email, then run this once
-- against production (e.g. via the Supabase SQL editor, which runs as a
-- privileged role). Look the user up by email in auth.users:
--
--   insert into public.admin_users (user_id, role)
--   select id, 'super_admin'
--   from auth.users
--   where email = 'OPERATOR_EMAIL_HERE'
--   on conflict (user_id) do nothing;
--
-- To revoke admin access later, just delete the row:
--   delete from public.admin_users where user_id = '<uuid>';
-- ----------------------------------------------------------------------------
