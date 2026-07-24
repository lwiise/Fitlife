-- ============================================================================
-- 00022 — Session intensity feedback (workout_checkins.intensity)
--
-- The adaptation half of the exercise loop. Marking a session «أنجزتها» can
-- now carry how it FELT — easy / right / hard — and the next workout
-- generation reads the last weeks' ratings per member and adjusts volume and
-- intensity (the trainee prompt gets an explicit adaptation clause; see
-- plan-engine workout/feedback.ts). Without this, programs never respond to
-- the person actually doing them.
--
--   * intensity — easy | right | hard, enum-like TEXT validated in Zod (no DB
--     CHECK, house convention). NULLABLE: absence of a rating is UNKNOWN and
--     steers nothing (engagement-layer contract — never fabricate). Only
--     meaningful on status='done' rows; the app writes NULL otherwise and the
--     reader ignores intensity on non-done rows regardless.
--
-- No new table, no RLS/policy change — the column rides workout_checkins'
-- existing house rules (owner-scoped RLS, DELETE policy, updated_at trigger,
-- CASCADE wipe). /api/account/export reads * so the column ships in the same
-- release.
--
-- Style per 00020: idempotent, additive. Applied MANUALLY to prod (no
-- runner) — run after 00021, then re-run scripts/verify-migrations.sql (now
-- covers 00022). Until applied, intensity writes degrade gracefully (the app
-- retries the upsert without the column and logs to Sentry).
-- ============================================================================

alter table public.workout_checkins
  add column if not exists intensity text;

comment on column public.workout_checkins.intensity is
  'How the done session felt: easy | right | hard (Zod-validated). NULL = unrated (unknown, never assumed). Feeds the next workout generation''s adaptation clause.';
