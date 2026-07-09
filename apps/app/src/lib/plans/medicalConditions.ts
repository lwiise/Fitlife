// Sara's medical-condition lists, shared by the Mom + adult/pregnant/lactating
// wizards. GATE_CONDITIONS slugs MUST match HIGH_RISK_MEDICAL_FLAGS in the engine
// (packages/plan-engine/src/buildContext.ts) so selecting one triggers the
// medical gate. STABLE_CONDITIONS inform the plan but never gate.

export interface ConditionOption {
  slug: string;
  label_ar: string;
}

// 10 high-risk conditions — require doctor sign-off before a plan is generated.
export const GATE_CONDITIONS: ConditionOption[] = [
  { slug: "unstable_diabetes", label_ar: "مرض السكري غير مستقر" },
  { slug: "uncontrolled_hypertension", label_ar: "ارتفاع ضغط غير مسيطر عليه" },
  { slug: "heart_disease", label_ar: "أمراض القلب" },
  { slug: "kidney_disease", label_ar: "أمراض الكلى" },
  { slug: "liver_disease", label_ar: "أمراض الكبد" },
  { slug: "unstable_thyroid", label_ar: "اضطراب الغدة الدرقية غير مستقر" },
  { slug: "severe_food_allergy", label_ar: "حساسية غذائية شديدة" },
  { slug: "acute_digestive", label_ar: "اضطراب هضمي حاد" },
  { slug: "eating_disorder", label_ar: "اضطراب في الأكل" },
  { slug: "post_surgical", label_ar: "ما بعد عملية جراحية" },
  { slug: "bariatric_surgery", label_ar: "جراحة سمنة سابقة" },
];

// Stable / managed conditions — inform the plan, no gate.
export const STABLE_CONDITIONS: ConditionOption[] = [
  { slug: "stable_diabetes", label_ar: "مرض السكري مستقر" },
  { slug: "controlled_hypertension", label_ar: "ارتفاع ضغط مسيطر عليه" },
  { slug: "pcos", label_ar: "تكيس المبايض" },
  { slug: "stable_hypothyroid", label_ar: "قصور الغدة الدرقية مستقر" },
  { slug: "high_cholesterol", label_ar: "ارتفاع الكوليسترول" },
  { slug: "ibs", label_ar: "متلازمة القولون العصبي" },
  { slug: "anemia", label_ar: "فقر الدم" },
];

const GATE_SLUGS = new Set(GATE_CONDITIONS.map((c) => c.slug));

/** True if any selected condition is a high-risk gate condition. */
export function hasGateCondition(conditions: string[]): boolean {
  return conditions.some((c) => GATE_SLUGS.has(c));
}
