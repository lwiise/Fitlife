/**
 * Who may have a private weight record («رحلتك الخاصة» / «الوزن والمتابعة»).
 *
 * OWNER DECISION (07/2026): CHILDREN are now included in the PRIVATE weight
 * journey (previously excluded outright — the 00017 "adults only" stance). The
 * owner directed this with the child-safety trade-offs surfaced. To keep the
 * reversal narrow and safe, the concept is split into three gates (below), and
 * two things stay adults-only regardless: BODY PHOTOS (a stored image of a
 * minor's body is a line we don't cross) and the family-VISIBLE goal-milestone
 * celebration on «موسم بيتنا» (a child's weight is never shown on a shared
 * surface). The housekeeper is NEVER tracked (dignity rule — the employer does
 * not track her body), same as workout plans.
 *
 *   isWeighInEligibleMember      — may keep a PRIVATE record (adults + children;
 *                                  never the housekeeper). Journey page, /plan
 *                                  entry, and the logBodyWeight write gate.
 *   isChildWeighInMember         — the member is a MINOR → no body photos, and
 *                                  never on the shared celebration.
 *   isGoalCelebrationEligibleMember — adults only → the shared «تحقّق الهدف».
 *
 * Pregnant/lactating members ARE eligible — pregnancy changes the framing (no
 * loss targets, no deltas toward a goal), never the right to a private record.
 * Children get the same no-loss-framing shape by construction: the target line
 * is mom-only, so a child journey is a neutral weight-over-time record.
 */

/** The fields the rules read — a subset of family_members rows. */
export interface WeighInMemberFields {
  member_type: string | null;
  role: string | null;
  birth_year: number | null;
}

/** May keep a PRIVATE weight record. Adults AND children; the housekeeper never. */
export function isWeighInEligibleMember(m: WeighInMemberFields): boolean {
  if (m.member_type === "housekeeper" || m.role === "housekeeper") return false;
  return true;
}

/** The member is a MINOR (child type, or under-18 by a known birth year).
 * Minors may keep a private record but get NO body photos and NEVER appear on
 * the shared goal-milestone celebration. */
export function isChildWeighInMember(
  m: WeighInMemberFields,
  currentYear: number = new Date().getFullYear(),
): boolean {
  if (m.member_type === "child") return true;
  if (m.birth_year != null && currentYear - m.birth_year < 18) return true;
  return false;
}

/** Eligible for the family-VISIBLE goal-milestone celebration on «موسم بيتنا»
 * («تحقّق الهدف»). Adults only — a child's weight is never celebrated on a
 * shared surface, and the housekeeper is never tracked. */
export function isGoalCelebrationEligibleMember(
  m: WeighInMemberFields,
  currentYear: number = new Date().getFullYear(),
): boolean {
  return isWeighInEligibleMember(m) && !isChildWeighInMember(m, currentYear);
}

/** The account owner: 18+ when the birth year is known (matches the action's
 * existing gate — unknown age is allowed, under-18 is refused). */
export function isWeighInEligibleMom(
  birthYear: number | null | undefined,
  currentYear: number = new Date().getFullYear(),
): boolean {
  return birthYear == null || currentYear - birthYear >= 18;
}
