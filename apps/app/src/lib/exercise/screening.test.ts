import { describe, it, expect } from "vitest";
import { computeExerciseScreening } from "./screening";

describe("computeExerciseScreening", () => {
  it("healthy active 30yo → vigorous, no clearance, HR zones", () => {
    expect(
      computeExerciseScreening({
        member_type: "adult",
        age: 30,
        activity_level: "active",
        conditions: [],
        resting_hr: 60,
      }),
    ).toEqual({
      intensity_ceiling: "can_progress_to_vigorous",
      clearance_required: false,
      intensity_mode: "hr_zones",
    });
  });

  it("sedentary start caps at light-moderate even when otherwise clear", () => {
    const r = computeExerciseScreening({
      member_type: "adult",
      age: 30,
      activity_level: "sedentary",
      conditions: [],
      resting_hr: 62,
    });
    expect(r.intensity_ceiling).toBe("light_moderate");
    expect(r.clearance_required).toBe(false);
  });

  it("controlled hypertension on beta-blockers (stable) → no clearance but RPE", () => {
    const r = computeExerciseScreening({
      member_type: "adult",
      age: 40,
      activity_level: "moderate",
      conditions: ["controlled_hypertension"],
      hr_meds: true,
    });
    expect(r.clearance_required).toBe(false); // stable condition, not a gate
    expect(r.intensity_mode).toBe("rpe");
    expect(r.intensity_ceiling).toBe("can_progress_to_vigorous");
  });

  it("symptom flag → clearance + light-moderate; old age w/o resting HR → RPE", () => {
    expect(
      computeExerciseScreening({
        member_type: "adult",
        age: 55,
        activity_level: "moderate",
        conditions: [],
        symptoms: ["chest_pain"],
      }),
    ).toEqual({
      intensity_ceiling: "light_moderate",
      clearance_required: true,
      intensity_mode: "rpe",
    });
  });

  it("gate condition (heart disease) forces clearance + light-moderate", () => {
    const r = computeExerciseScreening({
      member_type: "adult",
      age: 50,
      activity_level: "active",
      conditions: ["heart_disease"],
      resting_hr: 70,
    });
    expect(r.clearance_required).toBe(true);
    expect(r.intensity_ceiling).toBe("light_moderate");
    expect(r.intensity_mode).toBe("hr_zones"); // resting HR known, age < threshold
  });

  it("pregnant → always clearance + light-moderate, HR zones when young", () => {
    expect(
      computeExerciseScreening({
        member_type: "pregnant",
        age: 32,
        activity_level: "active",
        conditions: [],
      }),
    ).toEqual({
      intensity_ceiling: "light_moderate",
      clearance_required: true,
      intensity_mode: "hr_zones",
    });
  });

  it("'none' symptom sentinel is treated as cleared", () => {
    const r = computeExerciseScreening({
      member_type: "adult",
      age: 35,
      activity_level: "active",
      conditions: [],
      symptoms: ["none"],
      resting_hr: 58,
    });
    expect(r.clearance_required).toBe(false);
    expect(r.intensity_ceiling).toBe("can_progress_to_vigorous");
  });
});
