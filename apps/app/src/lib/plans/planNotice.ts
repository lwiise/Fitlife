/**
 * The ONE page-level notice on /plan («شريط الأسبوع», 09/2026). The page used
 * to stack every true notice above the plan — a masked failure, the tier
 * upsell and the «نجهّز خطة …» line could all show at once, pushing the meals
 * below the fold on a phone. Now it shows the most consequential one:
 *
 *   masked_failure › tier_blocked › members_pending
 *
 * A masked failure leads because it changes what the plan on screen IS (last
 * week's, not the one she asked for). The tier block comes next because it is
 * the only one that needs her to act — members_pending resolves by itself.
 * Pure so the priority is pinned by a test rather than by JSX order.
 */
export type PlanNoticeKind = "masked_failure" | "tier_blocked" | "members_pending";

export function pickPlanNotice(input: {
  maskedFailure: boolean;
  tierBlocked: boolean;
  membersPending: boolean;
}): PlanNoticeKind | null {
  if (input.maskedFailure) return "masked_failure";
  if (input.tierBlocked) return "tier_blocked";
  if (input.membersPending) return "members_pending";
  return null;
}
