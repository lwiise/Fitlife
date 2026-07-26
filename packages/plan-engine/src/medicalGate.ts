/**
 * The ONE definition of "this person needs doctor sign-off before a plan".
 *
 * It used to live in five places — the engine's context build, the Netlify
 * background function's SDK-free mirror, the onboarding wizard, the profile
 * health form, and the profile save action — with five different rules. The
 * engine's was the broadest, so a pregnant low-risk owner was permanently
 * blocked from generating while no surface ever offered her the confirmation
 * checkbox. Everything now reads from here.
 *
 * Pure and dependency-free on purpose: client wizards, server actions, the
 * engine, and the SDK-free background bundle all import it.
 */

/** Conditions that require doctor sign-off for ANY person (owner or member). */
export const HIGH_RISK_MEDICAL_FLAGS = [
  "unstable_diabetes",
  "uncontrolled_hypertension",
  "heart_disease",
  "kidney_disease",
  "liver_disease",
  "unstable_thyroid",
  "severe_food_allergy",
  "acute_digestive",
  "eating_disorder",
  "post_surgical",
  "bariatric_surgery",
  "unexplained_symptoms",
];

/**
 * True when at least one condition is high-risk. Exported so the goal mapping
 * can use the SAME list to decide when a condition should LEAD the plan instead
 * of the user's stated goal — a stable, managed condition informs the plan
 * without erasing what she asked for.
 */
export function hasHighRiskCondition(
  conditions: readonly string[] | null | undefined,
): boolean {
  return (conditions ?? []).some((c) => HIGH_RISK_MEDICAL_FLAGS.includes(c));
}

export interface OwnerMedicalFacts {
  /** Every stored condition, INCLUDING the free-text "حالة أخرى" entry — the
   * save actions append it to medical_conditions, so callers building this
   * from a live form must append it too. */
  medical_conditions?: readonly string[] | null;
  has_medical_conditions?: boolean | null;
  is_pregnant?: boolean | null;
}

/**
 * The account owner's rule: ANY medical condition, or pregnancy at any risk
 * level. High-risk flags and high-risk pregnancy are subsets of those two, so
 * naming them separately would be redundant — a condition is a condition.
 *
 * Deliberately broader than the member rule below: the owner answers her own
 * questionnaire and is the person the plan is primarily built around.
 */
export function ownerRequiresDoctorSignOff(facts: OwnerMedicalFacts): boolean {
  const conditions = facts.medical_conditions ?? [];
  return (
    !!facts.has_medical_conditions || conditions.length > 0 || !!facts.is_pregnant
  );
}

export interface MemberMedicalFacts {
  medical_conditions?: readonly string[] | null;
  high_risk_pregnancy?: boolean | null;
}

/**
 * A family member's rule: only HIGH-RISK conditions or a high-risk pregnancy.
 * Narrower than the owner's by design — a member's stable condition informs
 * the plan without gating the whole household's generation, and one member's
 * unanswered checkbox must never block everyone else.
 */
export function memberRequiresDoctorSignOff(facts: MemberMedicalFacts): boolean {
  const conditions = facts.medical_conditions ?? [];
  return (
    conditions.some((c) => HIGH_RISK_MEDICAL_FLAGS.includes(c)) ||
    !!facts.high_risk_pregnancy
  );
}

/** Arabic message shown wherever the sign-off is missing. */
export const DOCTOR_SIGN_OFF_REQUIRED_AR =
  "يلزم تأكيد استشارة الطبيب قبل إنشاء الخطة";
