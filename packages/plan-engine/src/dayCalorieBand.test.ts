import { describe, it, expect, vi, beforeEach } from "vitest";

// Fake only streamAnthropic; keep the real pure helpers.
vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import {
  generateMealPlan,
  dayCalorieDeviations,
  buildDayCalorieCorrectiveNote,
} from "./generate";
import { buildDayPrompt } from "./systemPrompt";
import type { PlanPromptContext } from "./buildContext";
import type { PlanSkeleton, DaySlice, Meal } from "./schema";

const mockedStream = vi.mocked(streamAnthropic);
beforeEach(() => mockedStream.mockReset());

const DAY_INDICES = [0];

function makeContext(withChild = false): PlanPromptContext {
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
    family_members: withChild
      ? [
          {
            id: "member-2",
            name: "سارة",
            role: "daughter",
            member_type: "child",
            is_child: true,
            age: 8,
            sex: "female",
            height_cm: null,
            weight_kg: null,
            activity_level: null,
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
            meal_mode: "shared",
            preferred_language: "ar",
          } as unknown as PlanPromptContext["family_members"][number],
        ]
      : [],
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

function skeletonWith(members: Array<{ id: string; target: number }>): PlanSkeleton {
  return {
    members: members.map(({ id, target }) => ({
      member_id: id,
      member_name_ar: id,
      primary_goal: "fat_loss",
      daily_calories_target: target,
      macros_target: {
        protein_g: Math.round((target * 0.25) / 4),
        carbs_g: Math.round((target * 0.45) / 4),
        fat_g: Math.round((target * 0.3) / 9),
      },
      days: DAY_INDICES.map((di) => ({
        day_index: di,
        day_name_ar: `اليوم ${di + 1}`,
        meals: [
          { slot: "breakfast", slot_name_ar: "الفطور", recipe_name_ar: `${id}-d${di}` },
        ],
      })),
    })),
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
  };
}

function mealOf(calories: number, name = "طبق"): Meal {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: name,
    ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
    prep_steps_ar: ["اخفقي البيض"],
    calories,
    macros: { protein_g: 30, carbs_g: 40, fat_g: 15 },
  };
}

function sliceOf(members: Array<{ id: string; calories: number }>): DaySlice {
  return {
    day_index: 0,
    members: members.map(({ id, calories }) => ({
      member_id: id,
      meals: [mealOf(calories, `${id}-dish`)],
    })),
  };
}

describe("dayCalorieDeviations", () => {
  const context = makeContext();
  const skeleton = skeletonWith([{ id: "mom", target: 1600 }]);

  it("accepts a day inside the ±10% band", () => {
    expect(dayCalorieDeviations(sliceOf([{ id: "mom", calories: 1600 }]), skeleton, context)).toEqual([]);
    expect(dayCalorieDeviations(sliceOf([{ id: "mom", calories: 1450 }]), skeleton, context)).toEqual([]);
    expect(dayCalorieDeviations(sliceOf([{ id: "mom", calories: 1755 }]), skeleton, context)).toEqual([]);
  });

  it("flags a day outside the band with got/target/allowed", () => {
    const dev = dayCalorieDeviations(sliceOf([{ id: "mom", calories: 1200 }]), skeleton, context);
    expect(dev).toEqual([{ member_id: "mom", got: 1200, target: 1600, allowed: 160 }]);
  });

  it("applies the 100 kcal minimum band for small targets", () => {
    const small = skeletonWith([{ id: "mom", target: 900 }]); // 10% = 90 < 100
    expect(dayCalorieDeviations(sliceOf([{ id: "mom", calories: 995 }]), small, context)).toEqual([]);
    expect(
      dayCalorieDeviations(sliceOf([{ id: "mom", calories: 1005 }]), small, context),
    ).toHaveLength(1);
  });

  it("exempts children entirely", () => {
    const ctx = makeContext(true);
    const skeleton2 = skeletonWith([
      { id: "mom", target: 1600 },
      { id: "member-2", target: 1200 },
    ]);
    const dev = dayCalorieDeviations(
      sliceOf([
        { id: "mom", calories: 1600 },
        { id: "member-2", calories: 500 }, // way off, but a child → exempt
      ]),
      skeleton2,
      ctx,
    );
    expect(dev).toEqual([]);
  });

  it("skips members missing from the skeleton or with non-positive targets", () => {
    expect(
      dayCalorieDeviations(sliceOf([{ id: "ghost", calories: 100 }]), skeleton, context),
    ).toEqual([]);
    const zero = skeletonWith([{ id: "mom", target: 0 }]);
    expect(dayCalorieDeviations(sliceOf([{ id: "mom", calories: 100 }]), zero, context)).toEqual([]);
  });
});

describe("buildDayCalorieCorrectiveNote", () => {
  it("names each member with previous total, target, and band", () => {
    const note = buildDayCalorieCorrectiveNote([
      { member_id: "mom", got: 1200, target: 1600, allowed: 160 },
    ]);
    expect(note).toContain("تصحيح إلزامي");
    expect(note).toContain('member_id="mom"');
    expect(note).toContain("1200");
    expect(note).toContain("1600");
    expect(note).toContain("من 1440 إلى 1760");
  });
});

describe("buildDayPrompt — calorie band lines", () => {
  it("states the mandatory sum requirement and the per-member aim band", () => {
    const prompt = buildDayPrompt(
      makeContext(),
      skeletonWith([{ id: "mom", target: 1600 }]),
      0,
    );
    expect(prompt).toContain("قيد إلزامي");
    expect(prompt).toContain("اجمعي سعرات وجبات كل فرد قبل الإخراج");
    // ±5% aim band around 1600 → 1520..1680
    expect(prompt).toContain("من 1520 إلى 1680");
  });
});

describe("generateMealPlan — per-day calorie enforcement", () => {
  it("re-rolls an out-of-band day WITH a corrective note, then accepts the fixed roll", async () => {
    let dayCalls = 0;
    const prompts: string[] = [];
    mockedStream.mockImplementation(async (params) => {
      const systemPrompt =
        (params as { systemPrompt?: string } | undefined)?.systemPrompt ?? "";
      if (!/day_index=\d+/.test(systemPrompt)) {
        return {
          text: JSON.stringify(skeletonWith([{ id: "mom", target: 1600 }])),
          tokensIn: 10,
          tokensOut: 20,
          stopReason: null,
        };
      }
      dayCalls++;
      prompts.push(systemPrompt);
      // 1st roll: 900 kcal (out of band); 2nd roll: 1600 (in band).
      const calories = dayCalls === 1 ? 900 : 1600;
      return {
        text: JSON.stringify(sliceOf([{ id: "mom", calories }])),
        tokensIn: 10,
        tokensOut: 20,
        stopReason: null,
      };
    });

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext(),
    });

    expect(dayCalls).toBe(2);
    // The re-roll carried the corrective block with the previous total.
    expect(prompts[1]).toContain("تصحيح إلزامي");
    expect(prompts[1]).toContain("900");
    // The accepted day is the in-band roll.
    expect(plan.members[0]!.days[0]!.day_total.calories).toBe(1600);
  }, 30_000);

  it("accepts the CLOSEST attempt (log-only) when every re-roll stays out of band", async () => {
    let dayCalls = 0;
    mockedStream.mockImplementation(async (params) => {
      const systemPrompt =
        (params as { systemPrompt?: string } | undefined)?.systemPrompt ?? "";
      if (!/day_index=\d+/.test(systemPrompt)) {
        return {
          text: JSON.stringify(skeletonWith([{ id: "mom", target: 1600 }])),
          tokensIn: 10,
          tokensOut: 20,
          stopReason: null,
        };
      }
      dayCalls++;
      // All rolls out of band; the SECOND (1350) is the closest to 1600.
      const calories = [900, 1350, 1100][dayCalls - 1] ?? 1100;
      return {
        text: JSON.stringify(sliceOf([{ id: "mom", calories }])),
        tokensIn: 10,
        tokensOut: 20,
        stopReason: null,
      };
    });

    const { plan, missingDays } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext(),
    });

    expect(dayCalls).toBe(3); // initial + CONTENT_MAX_RETRIES corrective rolls
    expect(missingDays).toEqual([]); // the day is NOT lost
    expect(plan.members[0]!.days[0]!.day_total.calories).toBe(1350); // best attempt
  }, 30_000);
});
