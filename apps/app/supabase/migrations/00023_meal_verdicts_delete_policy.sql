-- ============================================================================
-- 00023 — meal_verdicts DELETE policy
--
-- 00017 created SELECT / INSERT / UPDATE policies for meal_verdicts but no
-- DELETE policy — the same omission 00019 had to correct for meal_checkins.
-- Under RLS a missing DELETE policy is not an error: PostgREST deletes zero
-- rows and returns success. So `setMealVerdict({ verdict: null })`, the «كيف
-- كانت؟» un-tap, reports ok while the row survives — the verdict reappears on
-- reload and keeps feeding both the engagement digest (Sara's adaptation:
-- golden dishes and vetoes) and the «موسم بيتنا» leaderboard score.
--
-- Clearing a verdict is a first-class action for the same reason clearing a
-- check-in is: a mis-tap has to be reversible, and an opinion the user
-- withdrew must not keep steering next week's plan.
--
-- Written as its own migration rather than an edit to 00017 so it applies
-- correctly whether or not 00017 has already been run. Idempotent.
-- ============================================================================

drop policy if exists "Users can delete own meal verdicts" on public.meal_verdicts;
create policy "Users can delete own meal verdicts"
  on public.meal_verdicts for delete
  using (auth.uid() = user_id);
