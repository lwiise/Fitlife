import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Fake only streamAnthropic; keep the real pure helpers.
vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import { generateMealPlan, scoreDaySlice } from "./generate";
import type { PlanPromptContext } from "./buildContext";
import type { DaySlice, PlanSkeleton, Meal } from "./schema";

const mockedStream = vi.mocked(streamAnthropic);
const DAY_INDICES = [0, 1, 2];

function makeMeal(name: string, calories: number, ingredient = "بيض"): Meal {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: name,
    ingredients: [{ name_ar: ingredient, amount: 1, unit: "piece" }],
    prep_steps_ar: ["خطوة"],
    calories,
    macros: { protein_g: 20, carbs_g: 10, fat_g: 15 },
  };
}

// ── scoreDaySlice (pure) ─────────────────────────────────────────────────────
describe("scoreDaySlice", () => {
  const skeleton = (target: number): PlanSkeleton => ({
    members: [
      {
        member_id: "mom",
        member_name_ar: "أم",
        primary_goal: "fat_loss",
        daily_calories_target: target,
        macros_target: { protein_g: 100, carbs_g: 150, fat_g: 50 },
        days: [],
      },
    ],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
  });
  const slice = (meals: Meal[]): DaySlice => ({
    day_index: 0,
    members: [{ member_id: "mom", meals }],
  });

  it("is 0 for a clean, on-target day", () => {
    const s = slice([makeMeal("كبسة", 1500)]);
    expect(scoreDaySlice(s, skeleton(1500), true)).toBe(0);
  });

  it("flags a meal that uses refined flour/sugar", () => {
    const s = slice([makeMeal("كيك", 1500, "دقيق أبيض")]);
    expect(scoreDaySlice(s, skeleton(1500), true)).toBe(1);
  });

  it("flags a day total that drifts beyond the band", () => {
    const s = slice([makeMeal("سلطة", 600)]); // 600 vs 1500 → 60% drift
    expect(scoreDaySlice(s, skeleton(1500), true)).toBe(1);
  });

  it("ignores drift when includeDrift is false (partial scope)", () => {
    const s = slice([makeMeal("سلطة", 600)]);
    expect(scoreDaySlice(s, skeleton(1500), false)).toBe(0);
  });
});

// ── best-of-N re-roll via generateMealPlan ───────────────────────────────────
function soloContext(): PlanPromptContext {
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
      meal_mode: "shared",
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

function skeletonResponse() {
  // macros calc = 1450 (≈ 1500, <10% drift → no snap), adult > 1400 floor → unchanged.
  return {
    text: JSON.stringify({
      members: [
        {
          member_id: "mom",
          member_name_ar: "mom",
          primary_goal: "fat_loss",
          daily_calories_target: 1500,
          macros_target: { protein_g: 100, carbs_g: 150, fat_g: 50 },
          days: DAY_INDICES.map((di) => ({
            day_index: di,
            day_name_ar: `اليوم ${di + 1}`,
            meals: [{ slot: "breakfast", slot_name_ar: "الفطور", recipe_name_ar: `mom-${di}` }],
          })),
        },
      ],
      methodology_notes_ar: "ملاحظات",
      safety_disclaimer_ar: "تنبيه",
    }),
    tokensIn: 10,
    tokensOut: 20,
    stopReason: null,
  };
}

// On-target (1500 cal) day slice, optionally using a refined-flour ingredient.
function dayResponse(systemPrompt: string, refined: boolean) {
  const di = Number(systemPrompt.match(/day_index=(\d+)/)?.[1] ?? 0);
  const slice = {
    day_index: di,
    members: [
      { member_id: "mom", meals: [makeMeal(`mom-d${di}`, 1500, refined ? "دقيق أبيض" : "بيض")] },
    ],
  };
  return { text: JSON.stringify(slice), tokensIn: 10, tokensOut: 20, stopReason: null };
}

function hasRefined(plan: { members: { days: { meals: { ingredients: { name_ar: string }[] }[] }[] }[] }): boolean {
  return plan.members.some((m) =>
    m.days.some((d) =>
      d.meals.some((meal) => meal.ingredients.some((i) => i.name_ar.includes("أبيض"))),
    ),
  );
}

describe("generateMealPlan — WS3 best-of-N day guard", () => {
  beforeEach(() => {
    mockedStream.mockReset();
    vi.stubEnv("PLAN_GUARD_DAY_REROLLS", "1"); // enable the guard (off by default under vitest)
  });
  afterEach(() => vi.unstubAllEnvs());

  it("re-rolls a refined-flour day and commits the clean re-roll", async () => {
    const dayCalls = new Map<number, number>();
    mockedStream.mockImplementation(async (params) => {
      const sp = (params as { systemPrompt?: string }).systemPrompt ?? "";
      const dm = sp.match(/day_index=(\d+)/);
      if (!dm) return skeletonResponse();
      const di = Number(dm[1]);
      const n = (dayCalls.get(di) ?? 0) + 1;
      dayCalls.set(di, n);
      // First call per day → refined (score 1); the re-roll → clean (score 0).
      return dayResponse(sp, n === 1);
    });

    const { plan, missingDays } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: soloContext(),
    });

    expect(missingDays).toEqual([]); // no day dropped
    expect(hasRefined(plan)).toBe(false); // clean re-roll won
    // Each day called twice: the initial flawed slice + one best-of-N re-roll.
    for (const di of DAY_INDICES) expect(dayCalls.get(di)).toBe(2);
  });

  it("never drops a day even when every attempt still violates (keeps least-bad)", async () => {
    mockedStream.mockImplementation(async (params) => {
      const sp = (params as { systemPrompt?: string }).systemPrompt ?? "";
      if (!/day_index=\d+/.test(sp)) return skeletonResponse();
      return dayResponse(sp, /* always refined */ true);
    });

    const { plan, missingDays } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: soloContext(),
    });

    // The violation persists, but the day is committed (not dropped for a style flag).
    expect(missingDays).toEqual([]);
    expect(plan.members[0]!.days.length).toBe(DAY_INDICES.length);
    expect(hasRefined(plan)).toBe(true);
  });
});
