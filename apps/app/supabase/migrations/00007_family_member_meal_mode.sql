-- ============================================================================
-- Fit Life 2.0 — family_members.meal_mode (shared vs own meals)
-- ============================================================================
-- Migration: 00007
-- Created: 2026-06-04
--
-- When adding a family member, the household chooses whether that member eats
-- the FAMILY'S SHARED meals (one base recipe with per-member portions — Sara's
-- family-as-unit default) or gets their OWN independent dishes. Persisted per
-- member; default 'shared'. This is a DISCRETIONARY toggle only — it never
-- weakens allergen avoidance, calorie floors, or medical/pregnancy gating, which
-- the methodology enforces in BOTH modes.
-- ============================================================================

alter table public.family_members
  add column if not exists meal_mode text not null default 'shared';

alter table public.family_members
  drop constraint if exists family_members_meal_mode_check;

alter table public.family_members
  add constraint family_members_meal_mode_check
  check (meal_mode in ('shared', 'independent'));
