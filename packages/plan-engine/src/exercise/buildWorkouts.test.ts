import { describe, it, expect } from "vitest";
import {
  buildWorkoutsFromSkeleton,
  defaultTrainingFromProfile,
  energyBudgetMemberFromContext,
} from "./buildWorkouts";
import { computeEnergyBudget } from "./energyBudget";
import type { PlanPromptContext, PlanPromptContextMember } from "../buildContext";
import type { PlanSkeleton } from "../schema";
import type { ExerciseProfile } from "./types";
import { WorkoutPlanSchema, type WorkoutPlan } from "./schema";

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

  it("opted-in, non-clearance, no emitted training → deterministic fallback workout", () => {
    // Model variance: skeleton omitted `training` → she still gets a real plan.
    const out = buildWorkoutsFromSkeleton(ctx(optedIn), skeleton(undefined));
    expect(out).toHaveLength(1);
    expect(out[0]!.days).toHaveLength(7);
    const sessions = out[0]!.days.filter((d) => d.entry.kind === "session");
    expect(sessions).toHaveLength(3); // availability "3-4" → 3 sessions/week
  });

  it("clearance withheld (explicit) → no workout", () => {
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

  it("clearance required but model didn't withhold → still no fallback", () => {
    const needsClearance: ExerciseProfile = {
      ...optedIn,
      screening: {
        intensity_ceiling: "light_moderate",
        clearance_required: true,
        intensity_mode: "rpe",
      },
    };
    expect(
      buildWorkoutsFromSkeleton(ctx(needsClearance), skeleton(undefined)),
    ).toHaveLength(0);
  });

  // A distinctive prior workout: 2 resistance sessions @45min. The deterministic default
  // for `optedIn` ("3-4") is 3 walking sessions @30min — so the two are easy to tell apart.
  const priorMomWorkout: WorkoutPlan = WorkoutPlanSchema.parse({
    member_id: "mom",
    budget: {
      bmr: 1400,
      baseline_maintenance: 1900,
      weekly_eee: 600,
      tdee: 2000,
      target_intake: 1600,
      intensity_mode: "hr_zones",
      intensity_ceiling: "light_moderate",
      clearance_required: false,
      notes: [],
    },
    days: [0, 1, 2, 3, 4, 5, 6].map((day_index) =>
      day_index === 1 || day_index === 4
        ? {
            day_index,
            entry: {
              kind: "session",
              exercise_type: "resistance",
              band: "moderate",
              duration_min: 45,
            },
          }
        : { day_index, entry: { kind: "rest" } },
    ),
  });

  it("carries a prior workout VERBATIM for a member not re-skeletoned this run", () => {
    // Single-member regen: the carried member is absent from THIS run's skeleton. Her
    // prior (model-tailored) workout must be carried unchanged, NOT recomputed into the
    // generic default — guards the regen-overwrite bug.
    const out = buildWorkoutsFromSkeleton(ctx(optedIn), { members: [] }, [
      priorMomWorkout,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(priorMomWorkout); // same reference → carried verbatim
  });

  it("recomputes (does NOT carry) a member who IS in this run's skeleton", () => {
    // mom is being regenerated this run → her skeleton drives a fresh computation; the
    // prior workout is intentionally replaced (3 default sessions, not the prior 2).
    const out = buildWorkoutsFromSkeleton(ctx(optedIn), skeleton(undefined), [
      priorMomWorkout,
    ]);
    expect(out).toHaveLength(1);
    const sessions = out[0]!.days.filter((d) => d.entry.kind === "session");
    expect(sessions).toHaveLength(3);
  });
});

// ── Scoped (exercise-only) regen: force-recompute one member, carry the rest ──

const memberFixture: PlanPromptContextMember = {
  id: "m1",
  name: "نورة",
  role: "daughter",
  member_type: "adult",
  sex: "female",
  age: 22,
  height_cm: 160,
  weight_kg: 60,
  activity_level: "moderate",
  primary_goal: "fat_loss",
  dietary_restrictions: [],
  medical_conditions: [],
  allergies: [],
  dislikes: [],
  trimester: null,
  months_postpartum: null,
  high_risk_pregnancy: false,
  school_meal_handling: null,
  picky_eater: false,
  consulted_doctor: true,
  is_child: false,
  preferred_language: "ar",
  meal_mode: "shared",
  exercise_profile: optedIn,
};

function ctxWith(
  momProfile: ExerciseProfile | null,
  member: PlanPromptContextMember,
): PlanPromptContext {
  return { ...ctx(momProfile), family_members: [member] };
}

// Module-scoped priors for the cross-member scoped-regen tests. Both are 2 resistance
// @45 (NOT the deterministic default for `optedIn` — 3 walking @30), so carry vs
// recompute is unambiguous. `priorMomWorkout` above lives inside another describe.
const distinctiveDays = (a: number, b: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((day_index) =>
    day_index === a || day_index === b
      ? {
          day_index,
          entry: {
            kind: "session" as const,
            exercise_type: "resistance" as const,
            band: "moderate" as const,
            duration_min: 45,
          },
        }
      : { day_index, entry: { kind: "rest" as const } },
  );
const distinctiveBudget = {
  bmr: 1300,
  baseline_maintenance: 1700,
  weekly_eee: 500,
  tdee: 1800,
  target_intake: 1450,
  intensity_mode: "hr_zones",
  intensity_ceiling: "light_moderate",
  clearance_required: false,
  notes: [],
};
const momPrior: WorkoutPlan = WorkoutPlanSchema.parse({
  member_id: "mom",
  budget: distinctiveBudget,
  days: distinctiveDays(1, 4),
});
const priorMemberWorkout: WorkoutPlan = WorkoutPlanSchema.parse({
  member_id: "m1",
  budget: distinctiveBudget,
  days: distinctiveDays(2, 5),
});

describe("buildWorkoutsFromSkeleton — forceRecomputeMemberIds (exercise-only)", () => {
  it("recomputes the forced target with an empty skeleton, carries every other member verbatim", () => {
    // Exercise-only on mom: empty skeleton, force ["mom"]. Mom is rebuilt from her
    // profile (3 default walking sessions); the daughter — neither in skeleton nor
    // forced — keeps her prior tailored workout (bug-#2 carry guarantee, scoped path).
    const out = buildWorkoutsFromSkeleton(
      ctxWith(optedIn, memberFixture),
      { members: [] },
      [momPrior, priorMemberWorkout],
      ["mom"],
    );
    expect(out).toHaveLength(2);
    const mom = out.find((w) => w.member_id === "mom")!;
    const m1 = out.find((w) => w.member_id === "m1")!;
    expect(mom.days.filter((d) => d.entry.kind === "session")).toHaveLength(3);
    expect(m1).toBe(priorMemberWorkout); // same reference → carried verbatim
  });

  it("an edit that raises clearance withholds: the forced member is dropped, not carried", () => {
    const withheld: ExerciseProfile = {
      ...optedIn,
      screening: {
        intensity_ceiling: "light_moderate",
        clearance_required: true,
        intensity_mode: "rpe",
      },
    };
    const out = buildWorkoutsFromSkeleton(
      ctx(withheld),
      { members: [] },
      [momPrior],
      ["mom"],
    );
    // Clearance now required → no program; the stale prior is NOT carried.
    expect(out).toHaveLength(0);
  });
});

describe("energyBudgetMemberFromContext", () => {
  it("returns null for an unknown member id", () => {
    expect(energyBudgetMemberFromContext(ctx(optedIn), "nope")).toBeNull();
  });

  it("dispatch-side budget matches the budget baked into the workout (no drift)", () => {
    // The promotion check recomputes a member's budget via this shaper; it must equal
    // the budget assembleWorkoutPlan stored on the workout, or it reports false changes.
    const out = buildWorkoutsFromSkeleton(ctx(optedIn), skeleton(undefined));
    const baked = out[0]!.budget;
    const recomputed = computeEnergyBudget(
      energyBudgetMemberFromContext(ctx(optedIn), "mom")!,
      optedIn,
      optedIn.screening,
    );
    expect(recomputed).toEqual(baked);
  });
});

describe("defaultTrainingFromProfile", () => {
  const base: ExerciseProfile = {
    availability_days: "3-4",
    session_minutes: 30,
    preferred_types: ["strength"],
    screening: {
      intensity_ceiling: "light_moderate",
      clearance_required: false,
      intensity_mode: "hr_zones",
    },
  };

  it("maps availability to session count (1-2→2, 3-4→3, 5+→4)", () => {
    expect(defaultTrainingFromProfile({ ...base, availability_days: "1-2" }).sessions).toHaveLength(2);
    expect(defaultTrainingFromProfile({ ...base, availability_days: "3-4" }).sessions).toHaveLength(3);
    expect(defaultTrainingFromProfile({ ...base, availability_days: "5+" }).sessions).toHaveLength(4);
  });

  it("uses the top preference's modality, chosen duration, and a safe moderate band", () => {
    const t = defaultTrainingFromProfile(base);
    expect(t.sessions!.every((s) => s.modality === "resistance")).toBe(true);
    expect(t.sessions!.every((s) => s.duration_min === 30)).toBe(true);
    expect(t.sessions!.every((s) => s.band === "moderate")).toBe(true);
  });

  it("defaults modality to walking and duration to 30 when unset", () => {
    const t = defaultTrainingFromProfile({ availability_days: "1-2" });
    expect(t.sessions!.every((s) => s.modality === "walking")).toBe(true);
    expect(t.sessions!.every((s) => s.duration_min === 30)).toBe(true);
  });

  it("spreads sessions across distinct days (0-6)", () => {
    const days = defaultTrainingFromProfile({ ...base, availability_days: "5+" }).sessions!.map(
      (s) => s.day_index,
    );
    expect(new Set(days).size).toBe(days.length);
    expect(days.every((d) => d >= 0 && d <= 6)).toBe(true);
  });
});
