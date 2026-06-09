/**
 * Whether owning/activating a PAID subscription should kick off a whole-family
 * (re)generation — i.e. the tier now covers more beneficiaries than the current
 * plan actually contains. Pure, so it can be unit-tested without a DB.
 *
 * `tierMaxPeople` null means unlimited. A trial (no paid subscription) never
 * triggers this: the primary user's plan is created via the explicit
 * "continue with just my plan" path, not auto-generated on load.
 */
export function shouldRegenerateFamilyOnActivation(params: {
  isPaidActive: boolean;
  planMemberCount: number;
  beneficiaryCount: number;
  tierMaxPeople: number | null;
}): boolean {
  const { isPaidActive, planMemberCount, beneficiaryCount, tierMaxPeople } = params;
  if (!isPaidActive) return false;
  const coverable =
    tierMaxPeople == null
      ? beneficiaryCount
      : Math.min(beneficiaryCount, tierMaxPeople);
  return coverable > planMemberCount;
}
