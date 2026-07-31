/**
 * Who may have a private weight record («رحلتك الخاصة» / «الوزن والمتابعة»).
 *
 * OWNER DECISION (07/2026): CHILDREN are now included in the PRIVATE weight
 * journey (previously excluded outright — the 00017 "adults only" stance). The
 * owner directed this with the child-safety trade-offs surfaced. To keep the
 * reversal narrow and safe, the concept is split into three gates (below). The
 * one thing that stays adults-only is the family-VISIBLE goal-milestone
 * celebration on «موسم بيتنا» (a child's weight is never shown on a shared
 * surface). BODY PHOTOS were also adults-only at first, but a LATER owner
 * directive (07/2026) extended them to children too — a progress photo is a
 * private, per-account, journey-page-only record that never reaches a shared
 * surface (see logBodyWeight / the journey page). The housekeeper is NEVER
 * tracked (dignity rule — the employer does not track her body), same as
 * workout plans.
 *
 *   isWeighInEligibleMember      — may keep a PRIVATE record, PHOTOS included
 *                                  (adults + children; never the housekeeper).
 *                                  Journey page, /plan entry, and the
 *                                  logBodyWeight write gate.
 *   isChildWeighInMember         — the member is a MINOR → still never on the
 *                                  shared goal-milestone celebration.
 *   isGoalCelebrationEligibleMember — adults only → the shared «تحقّق الهدف».
 *
 * Pregnant/lactating members ARE eligible — pregnancy changes the framing (no
 * loss targets, no deltas toward a goal), never the right to a private record.
 * Children get the same no-loss-framing shape by construction: the target line
 * is mom-only, so a child journey is a neutral weight-over-time record (with an
 * optional private progress photo, per the later owner directive).
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
 * Minors may keep a private record (progress photos included) but NEVER appear
 * on the shared goal-milestone celebration. */
export function isChildWeighInMember(
  m: WeighInMemberFields,
  currentYear: number = new Date().getFullYear(),
): boolean {
  if (m.member_type === "child") return true;
  if (m.birth_year != null && currentYear - m.birth_year < 18) return true;
  return false;
}

/**
 * Pregnancy and lactation are not weight-change goals, so hitting a stored
 * target during either is not an achievement to announce — least of all on the
 * card the whole household reads.
 *
 * Its own predicate because the rule has to hold for the OWNER and for family
 * members, and those are two different row shapes evaluated in two different
 * branches. They had already drifted: the member branch excluded both states,
 * while the owner branch tested only `is_pregnant`, so a nursing mother who had
 * set a pre-pregnancy target before giving birth got «تحقّق الهدف — مبارك» on
 * «موسم بيتنا» the moment a /journey weigh-in touched it — a postpartum
 * weight-loss celebration in front of her children, when an identical family
 * member in the same state was correctly skipped.
 */
export function isInNoLossFramingState(m: {
  member_type: string | null;
  is_pregnant?: boolean | null;
}): boolean {
  return (
    m.member_type === "pregnant" ||
    m.member_type === "lactating" ||
    m.is_pregnant === true
  );
}

/** Eligible for the family-VISIBLE goal-milestone celebration on «موسم بيتنا»
 * («تحقّق الهدف»). Adults only — a child's weight is never celebrated on a
 * shared surface, and the housekeeper is never tracked. */
export function isGoalCelebrationEligibleMember(
  m: WeighInMemberFields,
  currentYear: number = new Date().getFullYear(),
): boolean {
  return (
    isWeighInEligibleMember(m) &&
    !isChildWeighInMember(m, currentYear) &&
    !isInNoLossFramingState(m)
  );
}

/**
 * The ACCOUNT OWNER's version of the same gate. `profiles` carries both
 * `member_type` and `is_pregnant`, and both must be honoured — the owner's
 * pregnancy is recorded in the boolean while lactation lives in member_type.
 */
export function isGoalCelebrationEligibleOwner(
  p: { member_type: string | null; is_pregnant?: boolean | null; birth_year: number | null },
  currentYear: number = new Date().getFullYear(),
): boolean {
  return (
    isWeighInEligibleMom(p.birth_year, currentYear) && !isInNoLossFramingState(p)
  );
}

/** The account owner: 18+ when the birth year is known (matches the action's
 * existing gate — unknown age is allowed, under-18 is refused). */
export function isWeighInEligibleMom(
  birthYear: number | null | undefined,
  currentYear: number = new Date().getFullYear(),
): boolean {
  return birthYear == null || currentYear - birthYear >= 18;
}
