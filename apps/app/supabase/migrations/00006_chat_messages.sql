-- ============================================================================
-- Fit Life 2.0 — Advisor chat usage audit (metadata only)
-- ============================================================================
-- Migration: 00006
-- Created: 2026-06-04
--
-- The Arabic advisor chatbot is read-only and does NOT persist conversation
-- content (chat about a family's health/diet is sensitive PDPL data — we keep it
-- session-only). This table stores ONLY per-turn usage metadata, used for:
--   1. a conservative per-user daily message cap (rate limit), and
--   2. model-aware token/cost auditing (same pricing as plan generation).
--
-- No message text, no recipes, no household data is stored here. Rows cascade on
-- account deletion (PDPL erasure) via the user_id FK.
-- ============================================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

-- Daily-cap count is "this user's rows since now()-24h", so index (user_id, created_at).
create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

-- Users only ever see/insert their own usage rows (the cookie-bound RLS client).
create policy "Users can read own chat usage"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own chat usage"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);
