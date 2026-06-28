import { describe, it, expect } from "vitest";
import { buildWorkoutsFromSkeleton } from "./buildWorkouts";
import type { PlanPromptContext } from "../buildContext";
import type { PlanSkeleton } from "../schema";
import type { ExerciseProfile } from "./types";

function ctx(profile: ExerciseProfile | null): PlanPromptContext {
  return {
    mom: {
      id: "u1",
      display_name: "أم",
      sex: "female",
      member_type: "adult",
      age: 35,
      height_cm: 165,
      weight_kg: 70,
      activity_level: "moderate",
      primary_goal: "fat_loss",
      dietary_restrictions: [],
      cuisine_preference: "khaleeji",
      medical_conditions: [],
      allergies: [],
      dislikes: [],
      is_pregnant: false,
      pregnancy_trimester: null,
      months_postpartum: null,
      high_risk_pregnancy: false,
      consulted_doctor: true,
      meal_mode: "shared",
      exercise_profile: profile,
    },
    family_members: [],
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

type Training = PlanSkeleton["members"][number]["training"];
const skeleton = (training?: Training): PlanSkeleton => ({
  members: [
    {
      member_id: "mom",
      member_name_ar: "أم",
      primary_goal: "fat_loss",
      daily_calories_target: 1600,
      macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
      days: [
        {
          day_index: 0,
          day_name_ar: "السبت",
          meals: [{ slot: "breakfast", slot_name_ar: "فطور", recipe_name_ar: "بيض" }],
        },
      ],
      training,
    },
  ],
});

const optedIn: ExerciseProfile = {
  availability_days: "3-4",
  session_minutes: 30,
  preferred_types: ["walking"],
  resting_hr: 60,
  screening: {
    intensity_ceiling: "light_moderate",
    clearance_required: false,
    intensity_mode: "hr_zones",
  },
};

describe("buildWorkoutsFromSkeleton", () => {
  it("meals-only (no exercise_profile) → no workouts", () => {
    expect(buildWorkoutsFromSkeleton(ctx(null), skeleton())).toHaveLength(0);
  });

  it("opted-in member with emitted training → one WorkoutPlan (7 days)", () => {
    const training: Training = {
      sessions: [{ day_index: 0, modality: "walking", band: "moderate", duration_min: 30 }],
    };
    const out = buildWorkoutsFromSkeleton(ctx(optedIn), skeleton(training));
    expect(out).toHaveLength(1);
    expect(out[0]!.member_id).toBe("mom");
    expect(out[0]!.days).toHaveLength(7);
  });

  it("opted-in but the skeleton emitted no training → no workout", () => {
    expect(buildWorkoutsFromSkeleton(ctx(optedIn), skeleton(undefined))).toHaveLength(0);
  });

  it("clearance withheld → no workout", () => {
    const withheld: ExerciseProfile = {
      ...optedIn,
      screening: {
        intensity_ceiling: "light_moderate",
        clearance_required: true,
        intensity_mode: "rpe",
      },
    };
    expect(
      buildWorkoutsFromSkeleton(ctx(withheld), skeleton({ withheld: true })),
    ).toHaveLength(0);
  });
});
