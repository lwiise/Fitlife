/**
 * Who may have a private weigh-in journey («رحلتك الخاصة»).
 *
 * One rule, three call sites (plan-page entry, journey page, logBodyWeight
 * action) — keep them identical by keeping the rule HERE:
 *
 *   * Children NEVER — the 00017 schema stance (adults only, no child body
 *     tracking), regardless of what birth_year says.
 *   * The housekeeper NEVER — the same dignity rule that keeps her out of
 *     workout plans (lib/plans/workoutEligibility.ts): the employer does not
 *     track her body.
 *   * Under-18 by birth_year NEVER — even when typed as an adult.
 *   * Unknown birth_year on an adult type is allowed (the age gate cannot
 *     fabricate a birthday; member_type already asserts adulthood).
 *
 * Pregnant/lactating members ARE eligible — pregnancy changes the framing
 * (no loss targets, no deltas toward a goal), never the right to a private
 * record.
 */

/** The fields the rule reads — a subset of family_members rows. */
export interface WeighInMemberFields {
  member_type: string | null;
  role: string | null;
  birth_year: number | null;
}

export function isWeighInEligibleMember(
  m: WeighInMemberFields,
  currentYear: number = new Date().getFullYear(),
): boolean {
  if (m.member_type === "child") return false;
  if (m.member_type === "housekeeper" || m.role === "housekeeper") return false;
  if (m.birth_year != null && currentYear - m.birth_year < 18) return false;
  return true;
}

/** The account owner: 18+ when the birth year is known (matches the action's
 * existing gate — unknown age is allowed, under-18 is refused). */
export function isWeighInEligibleMom(
  birthYear: number | null | undefined,
  currentYear: number = new Date().getFullYear(),
): boolean {
  return birthYear == null || currentYear - birthYear >= 18;
}
