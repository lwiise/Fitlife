import { describe, it, expect } from "vitest";
import { buildDayPrompt, buildSkeletonPrompt } from "./systemPrompt";
import type { PlanPromptContext } from "./buildContext";
import type { PlanSkeleton } from "./schema";

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
      target_weight_kg: null,
      day_nature: null,
      exercise_days: null,
      exercise_type: null,
      water_cups: null,
      water_liters: null,
      sleep_hours: null,
      medications: [],
      supplements: [],
      nausea_foods: [],
      notes: null,
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

// Coach questionnaire (00013) — placement contract: verbose lifestyle fields
// appear in the SKELETON prompt; only meds + nausea repeat in day prompts.
describe("coach questionnaire prompt threading", () => {
  function enrichedContext(): PlanPromptContext {
    const ctx = makeMomContext("shared");
    ctx.mom.target_weight_kg = 65;
    ctx.mom.day_nature = "desk";
    ctx.mom.exercise_days = "d3_5";
    ctx.mom.exercise_type = "resistance";
    ctx.mom.water_liters = "l1_2";
    ctx.mom.sleep_hours = 5;
    ctx.mom.medications = ["ميتفورمين"];
    ctx.mom.supplements = ["حديد"];
    ctx.mom.nausea_foods = ["بيض"];
    ctx.mom.notes = "أفضل وجبات سريعة التحضير أيام الدوام";
    return ctx;
  }

  it("skeleton prompt carries the full questionnaire clauses", () => {
    const prompt = buildSkeletonPrompt(enrichedContext());
    expect(prompt).toContain("65 كيلو");
    expect(prompt).toContain("مكتبية");
    expect(prompt).toContain("3-5 أيام");
    expect(prompt).toContain("مقاومة");
    expect(prompt).toContain("أدوية: ميتفورمين");
    expect(prompt).toContain("مكملات: حديد");
    expect(prompt).toContain("الغثيان");
    expect(prompt).toContain("1-2 لتر");
    expect(prompt).toContain("5 ساعات");
    expect(prompt).toContain("ملاحظات إضافية من العميلة");
    expect(prompt).toContain("سريعة التحضير");
  });

  it("legacy cups value still renders when no liters band is set", () => {
    const ctx = makeMomContext("shared");
    ctx.mom.water_cups = 4;
    const prompt = buildSkeletonPrompt(ctx);
    expect(prompt).toContain("4 أكواب");
  });

  it("day prompt repeats only meds + nausea, not the lifestyle fields", () => {
    const prompt = buildDayPrompt(enrichedContext(), skeleton, 0);
    expect(prompt).toContain("أدوية: ميتفورمين");
    expect(prompt).toContain("غثيان من: بيض");
    expect(prompt).not.toContain("65 كيلو");
    expect(prompt).not.toContain("لتر");
    expect(prompt).not.toContain("سريعة التحضير");
  });
});
