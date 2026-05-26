// Maps the user-facing goal choice (4 friendly options + a medical 5th) to one
// of Sara's 8 internal goals, using other profile signals. See Prompt 1.8c
// §Goal mapping. Pure + shared by the Mom wizard and the adult member wizard.

export type UserGoal =
  | "lose_weight"
  | "maintain_health"
  | "build_muscle"
  | "athletic"
  | "manage_condition";

export type SaraGoal =
  | "fat_loss"
  | "muscle_gain"
  | "body_recomposition"
  | "athletic_performance"
  | "metabolic_health"
  | "digestive_health"
  | "pregnancy_lactation"
  | "posture_recovery";

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
    case "maintain_health":
      return hasMedical ? medicalGoal : "body_recomposition";
    case "build_muscle":
      return "muscle_gain";
    case "athletic":
      return "athletic_performance";
    case "manage_condition":
      return medicalGoal;
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
    case "athletic_performance":
      return "athletic";
    case "metabolic_health":
    case "digestive_health":
      return "manage_condition";
    case "body_recomposition":
    case "pregnancy_lactation":
    case "posture_recovery":
      return "maintain_health";
  }
}
