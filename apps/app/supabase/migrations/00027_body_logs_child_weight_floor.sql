-- ============================================================================
-- 00027 — body_logs: a child's weigh-in may be under 20 kg
-- ============================================================================
-- 00017 copied the ADULT profile range («Same safety ranges as profiles») when
-- body_logs was adults-only. Two later owner directives (07/2026) brought
-- children into the private journey, and neither the CHECK nor its Zod mirror
-- moved — so a child under roughly six years (≈ under 20 kg) could not be
-- weighed at all: the row was refused by Postgres and the form showed a
-- generic failure.
--
-- The floor now mirrors family_members.weight_kg (00001: 5–300), the range the
-- same child's own profile row already accepts. The account owner keeps the
-- 20 kg floor in the Zod schema (profiles.weight_kg's CHECK is 20–300 and the
-- weigh-in mirrors the scalar there), so the DB range is the union and the
-- per-person rule lives in one place in code. waist_cm (30–250) is unchanged;
-- it already covers a small child.
--
-- Widening a CHECK never fails on existing rows. Idempotent. Apply after
-- 00026. Verify with apps/app/scripts/verify-migrations.sql (row «00027 …»).
-- ============================================================================

alter table public.body_logs
  drop constraint if exists body_logs_weight_kg_check;

alter table public.body_logs
  add constraint body_logs_weight_kg_check
  check (weight_kg is null or weight_kg between 5 and 300);
