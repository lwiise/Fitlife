/**
 * Who may receive a workout plan.
 *
 * One rule, three call sites (the opt-in questionnaire page, its save action,
 * and anything that later needs the same gate) — keep them identical by
 * keeping the rule HERE, the same way lib/engagement/eligibility.ts guards
 * the weigh-in journey:
 *
 *   * Explicit children NEVER — structured training programs are for the
 *     adults of the household; children's needs live in the meal plan only.
 *   * Under-18 by birth_year NEVER — even when typed as an adult. This mirrors
 *     the generation engine, which drops any trainee with age < 18 from
 *     `workoutTrainees` (packages/plan-engine: is_child = member_type ===
 *     "child" || age < 18). Without the gate here a 16-year-old typed "adult"
 *     would show as a selectable row, collect seven answers, and then be
 *     silently omitted from the plan — the exact "mysteriously short list"
 *     this screen exists to prevent. Reported as `child` so the UI reason
 *     ("plans are for adults") reads correctly for a minor.
 *   * The housekeeper NEVER — by member_type OR role, checked BEFORE the age
 *     gate so an under-18 housekeeper still reads as the dignity exclusion:
 *     the employer does not manage her training, the same rule that keeps her
 *     out of the weigh-in journey.
 *
 * Pregnant/lactating members ARE eligible — the methodology adapts the
 * program (ACOG rules), it never removes the right to one.
 */

/** The fields the rule reads — a subset of family_members rows. */
export interface WorkoutMemberFields {
  member_type: string | null;
  role: string | null;
  birth_year: number | null;
}

export type WorkoutIneligibleReason = "child" | "housekeeper";

/** Why a member is excluded from workout plans, or null when eligible. */
export function workoutIneligibleReason(
  m: WorkoutMemberFields,
  currentYear: number = new Date().getFullYear(),
): WorkoutIneligibleReason | null {
  if (m.member_type === "child") return "child";
  if (m.member_type === "housekeeper" || m.role === "housekeeper")
    return "housekeeper";
  if (m.birth_year != null && currentYear - m.birth_year < 18) return "child";
  return null;
}

export function isWorkoutEligibleMember(
  m: WorkoutMemberFields,
  currentYear: number = new Date().getFullYear(),
): boolean {
  return workoutIneligibleReason(m, currentYear) === null;
}
