import { describe, it, expect } from "vitest";
import {
  mapUserGoalToSara,
  mapSaraGoalToUser,
  type SaraGoal,
  type UserGoal,
} from "./goalMapping";

const noSignals = { hasMedical: false, isPregnantOrLactating: false, conditions: [] };
// STABLE conditions: they inform the plan, they no longer replace the goal.
const stable = { hasMedical: true, isPregnantOrLactating: false, conditions: ["stable_diabetes"] };
const pcos = { hasMedical: true, isPregnantOrLactating: false, conditions: ["pcos"] };
const digestive = { hasMedical: true, isPregnantOrLactating: false, conditions: ["ibs"] };
// HIGH-RISK conditions lead the plan whatever was picked.
const highRisk = { hasMedical: true, isPregnantOrLactating: false, conditions: ["unstable_diabetes"] };
const highRiskDigestive = {
  hasMedical: true,
  isPregnantOrLactating: false,
  conditions: ["acute_digestive"],
};
const pregnant = { hasMedical: false, isPregnantOrLactating: true, conditions: [] };

describe("mapUserGoalToSara", () => {
  it("maps the six coach goals without medical signals", () => {
    expect(mapUserGoalToSara("lose_weight", noSignals)).toBe("fat_loss");
    expect(mapUserGoalToSara("build_muscle", noSignals)).toBe("muscle_gain");
    expect(mapUserGoalToSara("recomposition", noSignals)).toBe("body_recomposition");
    expect(mapUserGoalToSara("maintain_weight", noSignals)).toBe("maintain");
    expect(mapUserGoalToSara("athletic", noSignals)).toBe("athletic_performance");
    expect(mapUserGoalToSara("improve_health", noSignals)).toBe("general_health");
  });

  it("a STABLE condition keeps the goal she asked for", () => {
    // The whole point: PCOS + «خسارة الدهون» is a fat-loss plan built around
    // PCOS, not a metabolic plan with no deficit.
    expect(mapUserGoalToSara("lose_weight", pcos)).toBe("fat_loss");
    expect(mapUserGoalToSara("lose_weight", stable)).toBe("fat_loss");
    expect(mapUserGoalToSara("recomposition", stable)).toBe("body_recomposition");
    expect(mapUserGoalToSara("maintain_weight", stable)).toBe("maintain");
    expect(mapUserGoalToSara("build_muscle", stable)).toBe("muscle_gain");
    expect(mapUserGoalToSara("athletic", stable)).toBe("athletic_performance");
  });

  it("«تحسين الحالة الصحية» is condition-led for ANY condition — that IS the ask", () => {
    expect(mapUserGoalToSara("improve_health", stable)).toBe("metabolic_health");
    expect(mapUserGoalToSara("improve_health", pcos)).toBe("metabolic_health");
    expect(mapUserGoalToSara("improve_health", digestive)).toBe("digestive_health");
    expect(mapUserGoalToSara("improve_health", noSignals)).toBe("general_health");
  });

  it("a HIGH-RISK condition leads the plan for every goal, muscle/athletic included", () => {
    const goals: UserGoal[] = [
      "lose_weight", "build_muscle", "recomposition",
      "maintain_weight", "athletic", "improve_health",
    ];
    for (const g of goals) {
      expect(mapUserGoalToSara(g, highRisk)).toBe("metabolic_health");
      expect(mapUserGoalToSara(g, highRiskDigestive)).toBe("digestive_health");
    }
  });

  it("pregnancy/lactation overrides everything", () => {
    const goals: UserGoal[] = [
      "lose_weight", "build_muscle", "recomposition",
      "maintain_weight", "athletic", "improve_health",
    ];
    for (const g of goals) {
      expect(mapUserGoalToSara(g, pregnant)).toBe("pregnancy_lactation");
    }
  });
});

describe("mapSaraGoalToUser", () => {
  it("round-trips the six non-lossy goals", () => {
    const nonLossy: UserGoal[] = [
      "lose_weight", "build_muscle", "recomposition",
      "maintain_weight", "athletic", "improve_health",
    ];
    for (const g of nonLossy) {
      expect(mapSaraGoalToUser(mapUserGoalToSara(g, noSignals))).toBe(g);
    }
  });

  it("maps every canonical goal to a selectable UI option", () => {
    const all: SaraGoal[] = [
      "fat_loss", "muscle_gain", "body_recomposition", "athletic_performance",
      "metabolic_health", "digestive_health", "pregnancy_lactation",
      "posture_recovery", "maintain", "general_health",
    ];
    for (const g of all) {
      expect(typeof mapSaraGoalToUser(g)).toBe("string");
    }
  });
});
