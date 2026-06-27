-- ============================================================================
-- Fit Life 2.0 — exercise_profile (opt-in exercise plan, Phase 1)
-- ============================================================================
-- Migration: 00012
-- Created: 2026-06-27
--
-- Phase 1 of the opt-in exercise feature COLLECTS each beneficiary's exercise
-- inputs + a computed ACSM-grounded safety screen, without yet changing meal
-- generation (coupled day generation lands in a later phase). Per-member opt-in:
-- meals-only members keep `exercise_profile` NULL.
--
-- Stored as a single jsonb blob now (mirrors the allergies/dislikes jsonb added
-- in 00005) so the wizard persists end-to-end; a later phase normalizes the blob
-- into typed columns + reads it in the plan engine. Shape: see
-- apps/app/src/lib/exercise/types.ts (ExerciseProfile).
--
-- `exercise_prompt_shown_at` (profiles only) makes mom's POST-generation opt-in
-- prompt one-time: it's set whether she picks meals-only or meals+exercise, so
-- the /plan banner never replays.
--
-- Apply MANUALLY to production (no CI/Netlify migration runner) — see CLAUDE.md.
-- After applying, regenerate types: pnpm --filter @fitlife/app db:types
-- ============================================================================

-- Account owner ("mom") lives in profiles.
alter table public.profiles
  add column if not exists exercise_profile jsonb;

alter table public.profiles
  add column if not exists exercise_prompt_shown_at timestamptz;

-- Everyone else lives in family_members (housekeeper is never offered exercise,
-- so her row simply keeps this NULL).
alter table public.family_members
  add column if not exists exercise_profile jsonb;
