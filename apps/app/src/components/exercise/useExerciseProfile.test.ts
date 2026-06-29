import { describe, it, expect } from "vitest";
import {
  buildExerciseProfile,
  exerciseStateFromProfile,
  type ExerciseState,
} from "./useExerciseProfile";
import type { ExerciseProfile } from "@/lib/exercise/types";

// The edit wizard seeds state from a stored ExerciseProfile via
// exerciseStateFromProfile, then re-assembles via buildExerciseProfile on save. A
// snake_case↔camelCase mapping slip would silently drop an answer, so pin the
// round-trip: profile → state → profile must preserve every prescription input.

const reused = {
  member_type: "adult" as const,
  age: 35,
  activity_level: "moderate",
  conditions: [] as string[],
};

const adultProfile: ExerciseProfile = {
  focus: "strength",
  msk_regions: ["knee"],
  msk_notes: "ركبة يسار",
  availability_days: "3-4",
  session_minutes: 30,
  preferred_types: ["walking", "strength"],
  disliked_types: ["yoga_pilates"],
  setting: "home",
  equipment: ["bands"],
  hr_meds: false,
  resting_hr: 62,
  symptoms: [],
  delivery_type: null,
  pelvic_floor_issues: null,
  screening: {
    intensity_ceiling: "light_moderate",
    clearance_required: false,
    intensity_mode: "hr_zones",
  },
};

describe("exerciseStateFromProfile ⇄ buildExerciseProfile round-trip", () => {
  it("seeds opted-in and preserves every adult prescription input", () => {
    const state = exerciseStateFromProfile(adultProfile) as ExerciseState;
    expect(state.optedIn).toBe(true);
    expect(state.restingHr).toBe("62"); // number → string for the NumberField

    const rebuilt = buildExerciseProfile(state, reused);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.focus).toBe(adultProfile.focus);
    expect(rebuilt!.msk_regions).toEqual(adultProfile.msk_regions);
    expect(rebuilt!.msk_notes).toBe(adultProfile.msk_notes);
    expect(rebuilt!.availability_days).toBe(adultProfile.availability_days);
    expect(rebuilt!.session_minutes).toBe(adultProfile.session_minutes);
    expect(rebuilt!.preferred_types).toEqual(adultProfile.preferred_types);
    expect(rebuilt!.disliked_types).toEqual(adultProfile.disliked_types);
    expect(rebuilt!.setting).toBe(adultProfile.setting);
    expect(rebuilt!.equipment).toEqual(adultProfile.equipment);
    expect(rebuilt!.hr_meds).toBe(adultProfile.hr_meds);
    expect(rebuilt!.resting_hr).toBe(adultProfile.resting_hr); // back to a number
    // Screening is recomputed on assembly (not carried from the seed) — so an edit
    // raising a flag re-screens — but it stays well-formed for unchanged inputs.
    expect(rebuilt!.screening).not.toBeNull();
  });

  it("round-trips a child's free-text activities", () => {
    const childProfile: ExerciseProfile = {
      child_activities: "كرة قدم مرتين بالأسبوع",
      screening: null,
    };
    const state = exerciseStateFromProfile(childProfile) as ExerciseState;
    expect(state.childActivities).toBe(childProfile.child_activities);

    const rebuilt = buildExerciseProfile(state, {
      ...reused,
      member_type: "child",
    });
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.child_activities).toBe(childProfile.child_activities);
    expect(rebuilt!.screening).toBeNull(); // children carry no screening
  });
});
