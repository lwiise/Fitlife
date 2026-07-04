import { describe, it, expect } from "vitest";
import {
  mapUserGoalToSara,
  mapSaraGoalToUser,
  type SaraGoal,
  type UserGoal,
} from "./goalMapping";

const noSignals = { hasMedical: false, isPregnantOrLactating: false, conditions: [] };
const metabolic = { hasMedical: true, isPregnantOrLactating: false, conditions: ["stable_diabetes"] };
const digestive = { hasMedical: true, isPregnantOrLactating: false, conditions: ["ibs"] };
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

  it("medical conditions override weight/health goals (not muscle/athletic)", () => {
    expect(mapUserGoalToSara("lose_weight", metabolic)).toBe("metabolic_health");
    expect(mapUserGoalToSara("recomposition", metabolic)).toBe("metabolic_health");
    expect(mapUserGoalToSara("maintain_weight", metabolic)).toBe("metabolic_health");
    expect(mapUserGoalToSara("improve_health", digestive)).toBe("digestive_health");
    expect(mapUserGoalToSara("build_muscle", metabolic)).toBe("muscle_gain");
    expect(mapUserGoalToSara("athletic", metabolic)).toBe("athletic_performance");
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
