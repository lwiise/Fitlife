/**
 * «تحقّق الهدف» milestone detection — has a member REACHED their target weight?
 *
 * Direction is inferred from where they STARTED relative to the target (began
 * above it → a loss journey, reached at/below; began below → a gain journey,
 * reached at/above), so it works for cuts and bulks alike without trusting a
 * possibly-stale goal label. What matters is the LATEST weigh-in, so a member
 * who reached the target and then drifted back past it is (honestly) no longer
 * shown as reached. A lone first log already on the far side of the target is
 * NOT a milestone — there is no journey to celebrate yet.
 *
 * Loss-framing by nature: callers MUST NOT run this for pregnant/lactating
 * members — the contract forbids weight targets and loss-framing for them.
 * Children and the housekeeper never have a target and are excluded upstream.
 */
export function hasReachedWeightGoal(
  weightsAscending: number[],
  targetKg: number | null | undefined,
): boolean {
  if (targetKg == null) return false;
  const earliest = weightsAscending[0];
  const latest = weightsAscending[weightsAscending.length - 1];
  if (earliest === undefined || latest === undefined) return false; // no weigh-ins
  if (earliest > targetKg) return latest <= targetKg; // losing → reached at/below
  if (earliest < targetKg) return latest >= targetKg; // gaining → reached at/above
  return false; // started exactly at target — nothing to celebrate
}
