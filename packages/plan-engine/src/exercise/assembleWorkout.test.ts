import { describe, it, expect } from "vitest";
import { assembleWorkoutPlan } from "./assembleWorkout";
import type { EnergyBudget } from "./schema";
import type { SkeletonTraining } from "../schema";

const budget: EnergyBudget = {
  bmr: 1400,
  baseline_maintenance: 1820,
  weekly_eee: 1000,
  tdee: 1963,
  target_intake: 1563,
  intensity_mode: "hr_zones",
  intensity_ceiling: "light_moderate",
  clearance_required: false,
  notes: [],
};

const params = {
  weight_kg: 70,
  age: 40,
  resting_hr: 60,
  intensity_mode: "hr_zones" as const,
  intensity_ceiling: "light_moderate" as const,
  budget,
};

const training: SkeletonTraining = {
  sessions: [
    { day_index: 0, modality: "walking", band: "moderate", duration_min: 30 },
    { day_index: 2, modality: "cycling", band: "moderate", duration_min: 45 },
    { day_index: 4, modality: "strength", band: "light", duration_min: 30 },
  ],
};

describe("assembleWorkoutPlan", () => {
  it("builds 7 days: sessions on training days, rest otherwise", () => {
    const plan = assembleWorkoutPlan("mom", training, params)!;
    expect(plan.days).toHaveLength(7);
    expect(plan.days.map((d) => d.entry.kind)).toEqual([
      "session",
      "rest",
      "session",
      "rest",
      "session",
      "rest",
      "rest",
    ]);
  });

  it("attaches HR zones + est_kcal in hr_zones mode", () => {
    const plan = assembleWorkoutPlan("mom", training, params)!;
    const day0 = plan.days[0]!.entry;
    expect(day0.kind).toBe("session");
    if (day0.kind === "session") {
      expect(day0.est_kcal).toBe(123); // 3.5 MET × 70kg × 0.5h
      expect(day0.hr_zone).toEqual({ band: "moderate", low_bpm: 108, high_bpm: 131 });
      expect(day0.rpe_low).toBeUndefined();
    }
  });

  it("uses RPE when intensity_mode is rpe", () => {
    const plan = assembleWorkoutPlan("mom", training, { ...params, intensity_mode: "rpe" })!;
    const day0 = plan.days[0]!.entry;
    if (day0.kind === "session") {
      expect(day0.rpe_low).toBe(12);
      expect(day0.rpe_high).toBe(13);
      expect(day0.hr_zone).toBeUndefined();
    }
  });

  it("falls back to RPE when hr_zones mode but no resting HR", () => {
    const plan = assembleWorkoutPlan("mom", training, { ...params, resting_hr: null })!;
    const day0 = plan.days[0]!.entry;
    if (day0.kind === "session") {
      expect(day0.hr_zone).toBeUndefined();
      expect(day0.rpe_low).toBe(12);
    }
  });

  it("returns null when withheld / no sessions / no training", () => {
    expect(assembleWorkoutPlan("mom", { withheld: true }, params)).toBeNull();
    expect(assembleWorkoutPlan("mom", { sessions: [] }, params)).toBeNull();
    expect(assembleWorkoutPlan("mom", null, params)).toBeNull();
  });

  it("coerces an unknown modality to a safe default without throwing", () => {
    const plan = assembleWorkoutPlan(
      "mom",
      { sessions: [{ day_index: 0, modality: "zumba", band: "moderate", duration_min: 30 }] },
      params,
    )!;
    const day0 = plan.days[0]!.entry;
    if (day0.kind === "session") {
      expect(day0.exercise_type).toBe("walking"); // safe default for unknown modality
    }
  });
});
