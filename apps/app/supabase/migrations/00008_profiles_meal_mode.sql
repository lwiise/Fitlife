-- ============================================================================
-- Fit Life 2.0 — profiles.meal_mode (mom: shared vs own meals)
-- ============================================================================
-- Migration: 00008
-- Created: 2026-06-11
--
-- Mirror of 00007 (family_members.meal_mode) for the account owner ("mom"),
-- whose profile lives in `profiles` rather than `family_members`. The plan-page
-- shared↔independent toggle now applies to mom too: 'shared' (default) means she
-- eats the family's shared meals; 'independent' gives her her own dishes. Like
-- 00007 this is a DISCRETIONARY toggle only — it never weakens allergen
-- avoidance, calorie floors, or medical/pregnancy gating.
--
-- Apply MANUALLY to production (no CI/Netlify migration runner) — see CLAUDE.md.
-- ============================================================================

alter table public.profiles
  add column if not exists meal_mode text not null default 'shared';

alter table public.profiles
  drop constraint if exists profiles_meal_mode_check;

alter table public.profiles
  add constraint profiles_meal_mode_check
  check (meal_mode in ('shared', 'independent'));
