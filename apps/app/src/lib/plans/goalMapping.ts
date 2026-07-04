// Maps the user-facing goal choice (Coach Sara's six options) to one of Sara's
// internal canonical goals, using other profile signals. See Prompt 1.8c
// §Goal mapping. Pure + shared by the Mom wizard and the adult member wizard.
//
// Coach questionnaire alignment (07/2026): the UI list is exactly her six —
// خسارة الدهون، بناء العضلات، إعادة تشكيل الجسم، المحافظة على الوزن، تحسين
// الأداء الرياضي، تحسين الحالة الصحية. The former "إدارة حالة صحية" option was
// folded into improve_health: the medical checklist (hasMedical) still routes
// any goal to the appropriate medical canonical goal. 'maintain' and
// 'general_health' were already valid DB values (00005 legacy list) and were
// promoted to first-class targets — no migration needed.

export type UserGoal =
  | "lose_weight"
  | "build_muscle"
  | "recomposition"
  | "maintain_weight"
  | "athletic"
  | "improve_health";

export type SaraGoal =
  | "fat_loss"
  | "muscle_gain"
  | "body_recomposition"
  | "athletic_performance"
  | "metabolic_health"
  | "digestive_health"
  | "pregnancy_lactation"
  | "posture_recovery"
  | "maintain"
  | "general_health";

// Conditions that point at digestive health rather than metabolic health.
const DIGESTIVE_CONDITIONS = new Set([
  "ibs",
  "acute_digestive",
]);

export function mapUserGoalToSara(
  uiGoal: UserGoal,
  signals: {
    hasMedical: boolean;
    isPregnantOrLactating: boolean;
    conditions: string[];
  },
): SaraGoal {
  const { hasMedical, isPregnantOrLactating, conditions } = signals;

  // Pregnancy/lactation overrides everything except athletic intent staying
  // performance is not desired here — pregnancy nutrition takes priority.
  if (isPregnantOrLactating) return "pregnancy_lactation";

  const medicalGoal: SaraGoal = conditions.some((c) =>
    DIGESTIVE_CONDITIONS.has(c),
  )
    ? "digestive_health"
    : "metabolic_health";

  switch (uiGoal) {
    case "lose_weight":
      return hasMedical ? medicalGoal : "fat_loss";
    case "build_muscle":
      return "muscle_gain";
    case "recomposition":
      return hasMedical ? medicalGoal : "body_recomposition";
    case "maintain_weight":
      return hasMedical ? medicalGoal : "maintain";
    case "athletic":
      return "athletic_performance";
    case "improve_health":
      return hasMedical ? medicalGoal : "general_health";
  }
}

// Best-effort inverse of mapUserGoalToSara, used to pre-select the goal radio
// when editing a profile. The forward map is lossy (medical/pregnancy override
// the chosen goal), so this returns the closest user-facing option; the real
// goal is re-derived from the full form on save.
export function mapSaraGoalToUser(goal: SaraGoal): UserGoal {
  switch (goal) {
    case "fat_loss":
      return "lose_weight";
    case "muscle_gain":
      return "build_muscle";
    case "body_recomposition":
      return "recomposition";
    case "maintain":
      return "maintain_weight";
    case "athletic_performance":
      return "athletic";
    case "metabolic_health":
    case "digestive_health":
    case "general_health":
    case "posture_recovery":
    case "pregnancy_lactation":
      return "improve_health";
  }
}
