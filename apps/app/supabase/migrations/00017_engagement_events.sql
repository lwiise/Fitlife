-- ============================================================================
-- Fit Life 2.0 — Engagement layer event spine (Sprint 1)
-- ============================================================================
-- Migration: 00017
-- Created: 2026-07-16
--
-- First event/time-series tables in the product (everything before this is
-- current-state or generation audit). Four tables, designed per the validated
-- engagement plan (product/engagement-layer-brainstorm.md §7):
--
--   * meal_checkins    — the «ختام اليوم» ritual: ONE household-level row per
--                        planned meal (plan, day, slot). The mom attests what
--                        her kitchen did: cooked as planned / swapped /
--                        skipped, with an optional no-shame reason chip.
--                        NOT per-member (one pot feeds the house; fanning out
--                        per-member rows is contradictory-data bait under
--                        regeneration).
--   * member_exceptions— sparse per-member deviation on a check-in. Language
--                        is DISH-directed by design («ما ناسبه الطبق»), and the
--                        kinds are Zod-constrained in app code so child
--                        consumption surveillance is unrepresentable. No
--                        amounts, no counts surfaced anywhere.
--   * meal_verdicts    — per-dish family feedback (loved/fine/not_again) keyed
--                        by a server-minted canonical_key (normalized recipe
--                        identity), because meals in plan_data have NO UUIDs
--                        and regeneration re-words recipe names. Feeds golden
--                        dishes + veto avoid-clauses into generation.
--   * body_logs        — dated weight/waist time series (the scalar
--                        weight_kg on profiles/family_members has no history).
--                        ADULTS ONLY — enforced in app code by birth_year
--                        (18+), never offered for children; pregnancy profiles
--                        get no loss-framing (app-layer rule).
--
-- Key conventions (why these columns exist):
--   * local_date — Riyadh-local calendar date stamped at WRITE time. Meal
--     day_index is week_start-offset-anchored while workout day_index is
--     weekday-anchored; local_date is the universal join key for streaks,
--     letters, and any cross-surface calendar. Never derive it later.
--   * slot is TEXT with NO CHECK — the slot vocabulary must stay extensible
--     (a future Ramadan season adds suhoor/iftar/ghabga as a config change,
--     not a data migration). Values are Zod-validated in server actions.
--   * member_id is TEXT, not an FK — it carries the plan-JSON convention
--     ("mom" | family_members.id). RLS stays on user_id only (house rule).
--   * Unanswered is UNKNOWN: absence of a row means "not asked/answered",
--     never "skipped". No defaults that fabricate adherence.
--
-- PDPL: all four tables cascade from profiles(id) → auth.users deletion wipes
-- them; /api/account/export includes them in the same release.
--
-- Style per 00005/00013/00016: idempotent (IF NOT EXISTS + guarded drops),
-- additive, enum-like text validated in Zod (no DB CHECK unless
-- safety-critical), range checks on safety-relevant numerics only.
-- Applied MANUALLY to prod (no runner) — run after 00016, then re-run
-- scripts/verify-migrations.sql and `pnpm --filter @fitlife/app db:types`.
-- ============================================================================

-- ── meal_checkins ───────────────────────────────────────────────────────────
create table if not exists public.meal_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day_index integer not null,
  local_date date not null,
  slot text not null,
  status text not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_checkins_day_index_check check (day_index between 0 and 6),
  constraint meal_checkins_one_per_meal unique (meal_plan_id, day_index, slot)
);

-- Streak windows and week aggregation read "this user's days" by date.
create index if not exists meal_checkins_user_local_date_idx
  on public.meal_checkins (user_id, local_date desc);
create index if not exists meal_checkins_user_created_idx
  on public.meal_checkins (user_id, created_at desc);

alter table public.meal_checkins enable row level security;

drop policy if exists "Users can read own meal checkins" on public.meal_checkins;
create policy "Users can read own meal checkins"
  on public.meal_checkins for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal checkins" on public.meal_checkins;
create policy "Users can insert own meal checkins"
  on public.meal_checkins for insert
  with check (auth.uid() = user_id);

-- Grace-window edits: she may change an answer (48h window enforced in app).
drop policy if exists "Users can update own meal checkins" on public.meal_checkins;
create policy "Users can update own meal checkins"
  on public.meal_checkins for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists meal_checkins_updated_at on public.meal_checkins;
create trigger meal_checkins_updated_at
  before update on public.meal_checkins
  for each row execute function public.handle_updated_at();

-- ── member_exceptions ───────────────────────────────────────────────────────
create table if not exists public.member_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_id uuid not null references public.meal_checkins(id) on delete cascade,
  member_id text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint member_exceptions_one_per_member unique (checkin_id, member_id)
);

create index if not exists member_exceptions_user_created_idx
  on public.member_exceptions (user_id, created_at desc);

alter table public.member_exceptions enable row level security;

drop policy if exists "Users can read own member exceptions" on public.member_exceptions;
create policy "Users can read own member exceptions"
  on public.member_exceptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own member exceptions" on public.member_exceptions;
create policy "Users can insert own member exceptions"
  on public.member_exceptions for insert
  with check (auth.uid() = user_id);

-- Exceptions are retractable (a mistaken tap), not editable.
drop policy if exists "Users can delete own member exceptions" on public.member_exceptions;
create policy "Users can delete own member exceptions"
  on public.member_exceptions for delete
  using (auth.uid() = user_id);

-- ── meal_verdicts ───────────────────────────────────────────────────────────
create table if not exists public.meal_verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  member_id text not null,
  day_index integer not null,
  slot text not null,
  recipe_name_ar text not null,
  canonical_key text not null,
  verdict text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_verdicts_day_index_check check (day_index between 0 and 6),
  constraint meal_verdicts_one_per_member_meal
    unique (meal_plan_id, member_id, day_index, slot)
);

-- Golden-dish and veto aggregation group by normalized recipe identity.
create index if not exists meal_verdicts_user_canonical_idx
  on public.meal_verdicts (user_id, canonical_key);
create index if not exists meal_verdicts_user_created_idx
  on public.meal_verdicts (user_id, created_at desc);

alter table public.meal_verdicts enable row level security;

drop policy if exists "Users can read own meal verdicts" on public.meal_verdicts;
create policy "Users can read own meal verdicts"
  on public.meal_verdicts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal verdicts" on public.meal_verdicts;
create policy "Users can insert own meal verdicts"
  on public.meal_verdicts for insert
  with check (auth.uid() = user_id);

-- A verdict can be changed at the table («عادي» → «أحبه») — upsert path.
drop policy if exists "Users can update own meal verdicts" on public.meal_verdicts;
create policy "Users can update own meal verdicts"
  on public.meal_verdicts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists meal_verdicts_updated_at on public.meal_verdicts;
create trigger meal_verdicts_updated_at
  before update on public.meal_verdicts
  for each row execute function public.handle_updated_at();

-- ── body_logs ───────────────────────────────────────────────────────────────
create table if not exists public.body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_id text not null default 'mom',
  recorded_on date not null,
  weight_kg numeric(5,2),
  waist_cm numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same safety ranges as profiles (00001/00013) — these gate clinical logic.
  constraint body_logs_weight_kg_check
    check (weight_kg is null or weight_kg between 20 and 300),
  constraint body_logs_waist_cm_check
    check (waist_cm is null or waist_cm between 30 and 250),
  constraint body_logs_one_per_member_day unique (user_id, member_id, recorded_on)
);

create index if not exists body_logs_user_member_recorded_idx
  on public.body_logs (user_id, member_id, recorded_on desc);

alter table public.body_logs enable row level security;

drop policy if exists "Users can read own body logs" on public.body_logs;
create policy "Users can read own body logs"
  on public.body_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own body logs" on public.body_logs;
create policy "Users can insert own body logs"
  on public.body_logs for insert
  with check (auth.uid() = user_id);

-- Same-day correction (mistyped weight) — upsert on (user, member, day).
drop policy if exists "Users can update own body logs" on public.body_logs;
create policy "Users can update own body logs"
  on public.body_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists body_logs_updated_at on public.body_logs;
create trigger body_logs_updated_at
  before update on public.body_logs
  for each row execute function public.handle_updated_at();
