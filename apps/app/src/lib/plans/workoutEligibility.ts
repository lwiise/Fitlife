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
 *   * The ACCOUNT HOLDER (mom) gets the SAME age gate via the momWorkout*
 *     variants below. She is a profiles row, not a family_members row, and
 *     historically skipped every check — an under-18 signup (birth_year only
 *     bounds to the current year) would sail through the opt-in page, the
 *     save action, and workoutTrainees, and receive an adult resistance
 *     program. The engine mirrors this gate in workoutTrainees (mom.age < 18
 *     is dropped like any member's).
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

/** The fields the mom rule reads — a subset of profiles rows. The account
 * holder is never typed as a child or a housekeeper, so only the age gate
 * applies; delegating keeps the 18+ line defined once, above. */
export interface WorkoutMomFields {
  birth_year: number | null;
}

export function momWorkoutIneligibleReason(
  p: WorkoutMomFields,
  currentYear: number = new Date().getFullYear(),
): WorkoutIneligibleReason | null {
  return workoutIneligibleReason(
    { member_type: "adult", role: null, birth_year: p.birth_year },
    currentYear,
  );
}

export function isWorkoutEligibleMom(
  p: WorkoutMomFields,
  currentYear: number = new Date().getFullYear(),
): boolean {
  return momWorkoutIneligibleReason(p, currentYear) === null;
}
