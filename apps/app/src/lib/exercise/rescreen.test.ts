import { describe, it, expect } from "vitest";
import { rescreenExerciseProfile } from "./rescreen";
import type { ExerciseProfile } from "./types";

const base: ExerciseProfile = {
  availability_days: "3-4",
  session_minutes: 30,
  preferred_types: ["walking"],
  hr_meds: false,
  resting_hr: 62,
  symptoms: [],
  screening: {
    intensity_ceiling: "can_progress_to_vigorous",
    clearance_required: false,
    intensity_mode: "hr_zones",
  },
};

const health = {
  member_type: "adult" as const,
  age: 35,
  activity_level: "active",
  conditions: [] as string[],
};

describe("rescreenExerciseProfile", () => {
  it("recomputes a stale verdict: a newly-added gating condition forces clearance + caps intensity", () => {
    // The whole point — a health edit that adds heart_disease must flip the stored
    // (clean) verdict to withheld + light_moderate, so generation withholds.
    const out = rescreenExerciseProfile(base, { ...health, conditions: ["heart_disease"] });
    expect(out!.screening).toEqual({
      intensity_ceiling: "light_moderate",
      clearance_required: true,
      intensity_mode: "hr_zones",
    });
  });

  it("keeps a clean verdict clean for an active, condition-free member", () => {
    const out = rescreenExerciseProfile(base, health);
    expect(out!.screening!.clearance_required).toBe(false);
    expect(out!.screening!.intensity_ceiling).toBe("can_progress_to_vigorous");
  });

  it("re-screens from the profile's own exercise answers (hr_meds → RPE), not the health inputs", () => {
    const out = rescreenExerciseProfile({ ...base, hr_meds: true }, health);
    expect(out!.screening!.intensity_mode).toBe("rpe");
  });

  it("is a no-op (same reference) for a null / child / non-prescription profile", () => {
    expect(rescreenExerciseProfile(null, health)).toBeNull();
    const child: ExerciseProfile = { child_activities: "كرة قدم", screening: null };
    expect(rescreenExerciseProfile(child, { ...health, member_type: "child" })).toBe(child);
    const noAvail: ExerciseProfile = { ...base, availability_days: null };
    expect(rescreenExerciseProfile(noAvail, health)).toBe(noAvail);
  });
});
