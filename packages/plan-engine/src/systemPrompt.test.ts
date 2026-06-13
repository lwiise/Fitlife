import { describe, it, expect } from "vitest";
import { buildDayPrompt } from "./systemPrompt";
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
