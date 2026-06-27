import { describe, it, expect } from "vitest";
import { extractRecentDishes } from "./buildContext";
import { buildSkeletonPrompt } from "./systemPrompt";
import type { PlanPromptContext } from "./buildContext";

function plan(...dishes: string[]) {
  return {
    plan_data: {
      members: [
        {
          days: [
            { meals: dishes.map((d) => ({ recipe_name_ar: d })) },
          ],
        },
      ],
    },
  };
}

describe("extractRecentDishes", () => {
  it("collects dish names across plans, members, and days", () => {
    const out = extractRecentDishes([plan("كبسة", "مندي"), plan("مرقوق")]);
    expect(out).toEqual(["كبسة", "مندي", "مرقوق"]);
  });

  it("dedups by whitespace/case-folded name, keeping the first display form", () => {
    const out = extractRecentDishes([plan("كبسة", "كبسة "), plan("  كبسة")]);
    expect(out).toEqual(["كبسة"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 100 }, (_, i) => `طبق-${i}`);
    expect(extractRecentDishes([plan(...many)], 30)).toHaveLength(30);
  });

  it("is defensive against malformed plan_data", () => {
    expect(extractRecentDishes([null, undefined, {}, { plan_data: 5 }])).toEqual([]);
    expect(extractRecentDishes([{ plan_data: { members: "nope" } }])).toEqual([]);
  });

  it("skips empty / non-string names", () => {
    const out = extractRecentDishes([
      { plan_data: { members: [{ days: [{ meals: [{ recipe_name_ar: "" }, { recipe_name_ar: 7 }, { recipe_name_ar: "كبسة" }] }] }] } },
    ]);
    expect(out).toEqual(["كبسة"]);
  });
});

function ctx(recent?: string[]): PlanPromptContext {
  return {
    mom: {
      id: "user-1",
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
      consulted_doctor: false,
      meal_mode: "shared",
    },
    family_members: [],
    family_wide: { dietary_restrictions: [], dislikes: [], cooking_methods: [], meal_out_frequency: null },
    composition_summary: "عائلة",
    recent_dishes: recent,
  };
}

describe("buildSkeletonPrompt — anti-repetition block (WS4)", () => {
  it("includes recent dishes when supplied", () => {
    const prompt = buildSkeletonPrompt(ctx(), undefined, ["كبسة", "مندي"]);
    expect(prompt).toContain("أطباق استُخدمت مؤخراً");
    expect(prompt).toContain("- كبسة");
    expect(prompt).toContain("- مندي");
  });

  it("omits the block when no recent dishes are passed", () => {
    const prompt = buildSkeletonPrompt(ctx(), undefined, undefined);
    expect(prompt).not.toContain("أطباق استُخدمت مؤخراً");
  });

  it("omits the block for an empty list", () => {
    const prompt = buildSkeletonPrompt(ctx(), undefined, []);
    expect(prompt).not.toContain("أطباق استُخدمت مؤخراً");
  });
});
