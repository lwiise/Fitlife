-- ============================================================================
-- Fit Life 2.0 — profiles.food_preferences (durable per-family taste memory)
-- ============================================================================
-- Migration: 00013
-- Created: 2026-06-27
--
-- A durable, structured preference store distilled from the user's free-text
-- regeneration feedback ("what's wrong / what to improve"). Today that feedback is
-- used once for the current regen and discarded; this column lets the system
-- REMEMBER it and feed it back into future plans, so generation personalizes over
-- time without any model training (context/memory-based personalization).
--
-- Shape (jsonb): { "loves": string[], "avoids": string[], "notes": string[],
--                  "updated_at": timestamptz }
--   loves  — dishes/ingredients the family wants more of (soft preference)
--   avoids — dishes/ingredients to steer away from (soft, NOT an allergen/medical
--            hard-exclude — those stay in allergies/dislikes/medical_conditions)
--   notes  — free-form soft hints that don't fit loves/avoids
-- Arrays are capped on write (see distillPreferences in plan-engine). Matches the
-- existing jsonb-on-profiles pattern (allergies, dislikes, family_dislikes).
--
-- Apply MANUALLY to production (no CI/Netlify migration runner) — see CLAUDE.md.
-- After applying, regenerate the typed client:
--   pnpm --filter @fitlife/app db:types
-- ============================================================================

alter table public.profiles
  add column if not exists food_preferences jsonb not null default '{}'::jsonb;
