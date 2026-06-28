import { describe, it, expect } from "vitest";
import {
  buildDayPrompt,
  buildSkeletonPrompt,
  householdHasExerciseProgram,
} from "./systemPrompt";
import type { PlanPromptContext } from "./buildContext";
import type { PlanSkeleton } from "./schema";
import type { ExerciseProfile } from "./exercise/types";

function makeMomContext(mealMode: "shared" | "independent"): PlanPromptContext {
  return {
    mom: {
      id: "user-1",
      display_name: "أم محمد",
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
      consulted_doctor: false,
      meal_mode: mealMode,
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

const skeleton: PlanSkeleton = {
  members: [
    {
      member_id: "mom",
      member_name_ar: "أم محمد",
      primary_goal: "fat_loss",
      daily_calories_target: 1600,
      macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
      days: [
        {
          day_index: 0,
          day_name_ar: "اليوم 1",
          meals: [{ slot: "breakfast", slot_name_ar: "فطور", recipe_name_ar: "بيض" }],
        },
      ],
    },
  ],
  methodology_notes_ar: "ملاحظات",
  safety_disclaimer_ar: "تنبيه",
};

describe("buildDayPrompt — mom meal_mode", () => {
  it("flags 'independent' as the own-dishes exception for mom", () => {
    const prompt = buildDayPrompt(makeMomContext("independent"), skeleton, 0, "اليوم 1");
    expect(prompt).toContain("وجبات مستقلة");
  });

  it("does not flag the independent exception when mom is 'shared'", () => {
    const prompt = buildDayPrompt(makeMomContext("shared"), skeleton, 0, "اليوم 1");
    expect(prompt).not.toContain("وجبات مستقلة (طبق خاص باسم مختلف)");
  });
});

// A member day with NO target dishes (the skeleton omitted it / the family grid was
// empty during a shared-group regen) must NOT print "وجبات اليوم: —" — the model
// echoes that as an empty `meals` array, which fails DaySlice validation (meals.min(1))
// and every retry re-rolls the same empty target. Direct a fresh full day instead.
describe("buildDayPrompt — empty meal target", () => {
  const emptyDaySkeleton: PlanSkeleton = {
    members: [
      {
        member_id: "mom",
        member_name_ar: "أم محمد",
        primary_goal: "fat_loss",
        daily_calories_target: 1600,
        macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
        days: [{ day_index: 0, day_name_ar: "اليوم 1", meals: [] }],
      },
    ],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
  };

  it("directs a full fresh day instead of an empty '—' target", () => {
    const prompt = buildDayPrompt(
      makeMomContext("shared"),
      emptyDaySkeleton,
      0,
      "اليوم 1",
    );
    expect(prompt).not.toContain("وجبات اليوم: —");
    expect(prompt).toContain("لا أطباق محددة لهذا الفرد اليوم");
  });

  it("still lists the dish names verbatim when the day HAS a target", () => {
    const prompt = buildDayPrompt(makeMomContext("shared"), skeleton, 0, "اليوم 1");
    expect(prompt).toContain("بيض");
    expect(prompt).not.toContain("لا أطباق محددة لهذا الفرد اليوم");
  });
});

// The skeleton is the phase that decides which dishes are shared (same
// recipe_name_ar). Mom's 'independent' flag must reach its roster — otherwise the
// skeleton hands mom the family's shared dish names and she stays grouped as
// shared even after switching to independent. Mom-only context → solo sharedNote,
// which never says "وجبات مستقلة", so the roster line is the only possible source.
describe("buildSkeletonPrompt — mom meal_mode in the roster", () => {
  it("surfaces 'independent' for mom so the skeleton gives her own dish names", () => {
    const prompt = buildSkeletonPrompt(makeMomContext("independent"));
    expect(prompt).toContain("وجبات مستقلة: أعطيها أطباقاً خاصة بها");
  });

  it("does not flag the independent exception when mom is 'shared'", () => {
    const prompt = buildSkeletonPrompt(makeMomContext("shared"));
    expect(prompt).not.toContain("وجبات مستقلة");
  });
});

describe("buildDayPrompt — token-lean output contract", () => {
  const prompt = buildDayPrompt(makeMomContext("shared"), skeleton, 0, "اليوم 1");

  it("asks for terse JSON keys", () => {
    expect(prompt).toContain("d: number");
    expect(prompt).toContain("ms: Array");
    expect(prompt).toContain("st: string[]");
    expect(prompt).toContain("mc: { p: number; cb: number; f: number }");
  });

  it("does not declare slot_name_ar as an output field (filled in code)", () => {
    expect(prompt).not.toContain("slot_name_ar:");
  });

  it("caps prep steps at 3", () => {
    expect(prompt).toContain("3 خطوات");
  });

  it("does NOT inline housekeeper translation even with a housekeeper locale", () => {
    const hkPrompt = buildDayPrompt(
      { ...makeMomContext("shared"), housekeeper_locale: "tl" },
      skeleton,
      0,
      "اليوم 1",
    );
    expect(hkPrompt).not.toContain("recipe_name_translated");
    expect(hkPrompt).not.toContain("ترجمة الوصفة للخادمة");
  });
});

// 2c — the exercise section is APPENDED only for opted-in members, so a meal-only
// household's skeleton prompt is byte-identical to before (no "# التمارين").
describe("buildSkeletonPrompt — exercise section (2c)", () => {
  const optedIn: ExerciseProfile = {
    availability_days: "3-4",
    session_minutes: 30,
    preferred_types: ["walking", "strength"],
    setting: "home",
    equipment: ["none"],
    msk_regions: ["knee"],
    screening: {
      intensity_ceiling: "light_moderate",
      clearance_required: false,
      intensity_mode: "hr_zones",
    },
  };
  const momWith = (profile: ExerciseProfile | null): PlanPromptContext => {
    const c = makeMomContext("shared");
    return { ...c, mom: { ...c.mom, exercise_profile: profile } };
  };

  it("meal-only household: no exercise section (byte-identical path)", () => {
    const ctx = makeMomContext("shared");
    expect(householdHasExerciseProgram(ctx)).toBe(false);
    expect(buildSkeletonPrompt(ctx)).not.toContain("# التمارين");
  });

  it("opted-in member: emits the section + constraints + training output field", () => {
    const ctx = momWith(optedIn);
    expect(householdHasExerciseProgram(ctx)).toBe(true);
    const prompt = buildSkeletonPrompt(ctx);
    expect(prompt).toContain("# التمارين");
    expect(prompt).toContain("member_id=mom");
    expect(prompt).toContain("3-4"); // availability surfaced
    expect(prompt).toContain("training?:"); // output-shape addendum
    expect(prompt).not.toContain("withheld: true");
  });

  it("clearance member: withholds the program instead of a schedule", () => {
    const ctx = momWith({
      ...optedIn,
      screening: {
        intensity_ceiling: "light_moderate",
        clearance_required: true,
        intensity_mode: "rpe",
      },
    });
    const prompt = buildSkeletonPrompt(ctx);
    expect(prompt).toContain("withheld: true");
    expect(prompt).toContain("يحتاج موافقة طبيب");
  });

  it("opted-in CHILD is excluded (play only, no prescribed schedule)", () => {
    const c = makeMomContext("shared");
    const ctx: PlanPromptContext = {
      ...c,
      mom: { ...c.mom, exercise_profile: null },
      family_members: [
        {
          id: "kid-1",
          name: "خالد",
          role: "son",
          member_type: "child",
          sex: "male",
          age: 9,
          height_cm: 130,
          weight_kg: 30,
          activity_level: "active",
          primary_goal: null,
          dietary_restrictions: [],
          medical_conditions: [],
          allergies: [],
          dislikes: [],
          trimester: null,
          months_postpartum: null,
          high_risk_pregnancy: false,
          school_meal_handling: null,
          picky_eater: false,
          consulted_doctor: false,
          is_child: true,
          preferred_language: "ar",
          meal_mode: "shared",
          exercise_profile: { availability_days: "3-4", screening: null },
        },
      ],
    };
    expect(householdHasExerciseProgram(ctx)).toBe(false);
    expect(buildSkeletonPrompt(ctx)).not.toContain("# التمارين");
  });
});
