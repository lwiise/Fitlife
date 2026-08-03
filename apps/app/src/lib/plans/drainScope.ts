import type { MealPlan } from "@fitlife/plan-engine";

/**
 * Members already IN the plan who are still missing days, and are still under
 * the per-member retry cap.
 *
 * The drain fills gaps one member at a time: `pickNextMemberId` returns a single
 * id and the run targets only them. That is right for a NEWLY ADDED member —
 * they need a skeleton, and a shared newcomer needs the whole shared group
 * rebuilt so the merged dishes line up. It is wrong for the common case after a
 * budget-trimmed run, where four or five people are each missing the same two or
 * three days: the household then needs one drain round PER MEMBER, each waiting
 * on a page visit to dispatch and each holding the generation lock, so the week
 * trickles in over five separate invocations.
 *
 * The engine has always supported the better shape — `membersToGenerate` is
 * `beneficiaries.filter((b) => !isComplete(b))` whenever no `onlyMemberId` is
 * given, so a carry-over run with no member scope fills EVERY incomplete member.
 * And because members already in the plan carry their targets from it, such a
 * run needs no skeleton call at all: it is day calls only. Nothing had to be
 * built; the drain simply never asked.
 *
 * The list is deliberately restricted to members already in the plan. An ABSENT
 * member is a different job (skeleton + possibly a shared-group rebuild), and
 * mixing the two into one run is what `regenerateSharedGroup` exists to handle.
 */
export function incompleteInPlanMemberIds(params: {
  plan: MealPlan;
  maxAttempts: number;
}): string[] {
  const { plan, maxAttempts } = params;
  const daysTotal = plan.days_total ?? 7;
  const attempts = plan.gen_attempts ?? {};
  return plan.members
    .filter(
      (m) =>
        m.days.filter((d) => d.meals.length > 0).length < daysTotal &&
        (attempts[m.member_id] ?? 0) < maxAttempts,
    )
    .map((m) => m.member_id);
}
