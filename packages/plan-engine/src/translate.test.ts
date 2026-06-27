import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import { translateMealPlan } from "./generate";
import { MealPlanSchema, type MealPlan, type Meal } from "./schema";

const mockedStream = vi.mocked(streamAnthropic);

function meal(recipe: string): Meal {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: recipe,
    ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
    prep_steps_ar: ["اخفقي", "اطبخي"],
    calories: 400,
    macros: { protein_g: 20, carbs_g: 30, fat_g: 12 },
  };
}

// 2 members × 2 days, nothing translated yet. Each member's recipes carry a distinct
// prefix so the mock can tell which member a recipe-translate call is for.
function makePlan(): MealPlan {
  const member = (id: string, prefix: string) => ({
    member_id: id,
    member_name_ar: `اسم-${id}`,
    primary_goal: "fat_loss" as const,
    daily_calories_target: 1600,
    macros_target: { protein_g: 100, carbs_g: 150, fat_g: 50 },
    days: [0, 1].map((di) => ({
      day_index: di,
      day_name_ar: `يوم ${di}`,
      meals: [meal(`${prefix}-d${di}`)],
      day_total: { calories: 400, protein_g: 20, carbs_g: 30, fat_g: 12 },
    })),
  });
  return MealPlanSchema.parse({
    week_start_date: "2026-06-06",
    members: [member("mom", "m0"), member("dad-1", "m1")],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    days_total: 2,
    generating: false,
  });
}

function isNamePrompt(sp: string): boolean {
  return /transliteration/.test(sp);
}

describe("translateMealPlan — parallelized pass (WS2)", () => {
  beforeEach(() => mockedStream.mockReset());

  it("translates every member name and every meal, sequential first unit first", async () => {
    const callKinds: Array<{ kind: "name" | "recipe"; text: string }> = [];
    mockedStream.mockImplementation(async (params) => {
      // vitest can invoke a vi.fn() with no args during cleanup; ignore those and
      // only record real calls from the code under test (read defensively, as the
      // other generate tests do).
      const p = params as { systemPrompt?: string } | undefined;
      if (p === undefined)
        return { text: "[]", tokensIn: 0, tokensOut: 0, stopReason: null };
      const sp = p.systemPrompt ?? "";
      if (isNamePrompt(sp)) {
        callKinds.push({ kind: "name", text: sp });
        return {
          text: JSON.stringify([{ i: 0, name: "Translated" }]),
          tokensIn: 5,
          tokensOut: 5,
          stopReason: null,
        };
      }
      callKinds.push({ kind: "recipe", text: sp });
      // One ref per day in this fixture (i = 0).
      return {
        text: JSON.stringify([
          { i: 0, recipe_name: "X", ingredient_names: ["Y"], steps: ["Z"] },
        ]),
        tokensIn: 5,
        tokensOut: 5,
        stopReason: null,
      };
    });

    const { plan } = await translateMealPlan({
      anthropicApiKey: "test-key",
      plan: makePlan(),
      locale: "tl",
    });

    // Correctness: every member name + every meal translated.
    for (const m of plan.members) {
      expect(m.member_name_translated_locale).toBe("tl");
      for (const d of m.days) {
        for (const meal of d.meals) {
          expect(meal.prep_steps_translated_locale).toBe("tl");
          expect(meal.prep_steps_translated).toEqual(["Z"]);
        }
      }
    }

    // Sequential first unit: the first call is the first member's NAME, the second is
    // a RECIPE translate for that same member (m0) — both run before the parallel pool.
    expect(callKinds[0]!.kind).toBe("name");
    expect(callKinds[1]!.kind).toBe("recipe");
    expect(callKinds[1]!.text).toContain("m0");

    // Total calls: 2 names + 4 member-days.
    expect(callKinds.length).toBe(6);
  });
});
