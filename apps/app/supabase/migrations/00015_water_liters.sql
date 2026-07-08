-- ============================================================================
-- Fit Life 2.0 — water intake in liters (coach's bands)
-- ============================================================================
-- Migration: 00015
-- Created: 2026-07-08
--
-- Coach Sara's questionnaire asks water intake in LITERS bands (أقل من لتر /
-- 1-2 / 2-3 / أكثر من 3), not cups. New enum-like text column (Zod-validated
-- per house convention); water_cups stays as a legacy read-fallback only —
-- no write path uses it anymore.
-- ============================================================================

alter table public.profiles
  add column if not exists water_liters text;

alter table public.family_members
  add column if not exists water_liters text;
