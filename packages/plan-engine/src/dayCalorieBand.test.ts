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
  dayProteinDeviations,
  normalizedDayDeviation,
  buildDayCorrectiveNote,
  rescaleDayCalories,
  scaleIngredientAmount,
  DAY_CALORIE_AIM_PCT,
  DAY_CALORIE_AIM_MIN_KCAL,
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

// Protein defaults to the same 25%-of-calories ratio the skeleton fixture
// uses, so a calorie-in-band slice is protein-in-band too unless a test
// overrides protein explicitly.
function mealOf(calories: number, name = "طبق", protein?: number): Meal {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: name,
    ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
    prep_steps_ar: ["اخفقي البيض"],
    calories,
    macros: {
      protein_g: protein ?? Math.round((calories * 0.25) / 4),
      carbs_g: 40,
      fat_g: 15,
    },
  };
}

function sliceOf(
  members: Array<{ id: string; calories: number; protein?: number }>,
): DaySlice {
  return {
    day_index: 0,
    members: members.map(({ id, calories, protein }) => ({
      member_id: id,
      meals: [mealOf(calories, `${id}-dish`, protein)],
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

describe("dayCalorieDeviations — aim band override", () => {
  const context = makeContext();
  const skeleton = skeletonWith([{ id: "mom", target: 1600 }]);

  it("flags a day that passes the hard band but misses the aim band", () => {
    // 1450 vs 1600: off by 150 — inside hard ±160, outside aim ±80.
    const slice = sliceOf([{ id: "mom", calories: 1450 }]);
    expect(dayCalorieDeviations(slice, skeleton, context)).toEqual([]);
    expect(
      dayCalorieDeviations(
        slice,
        skeleton,
        context,
        DAY_CALORIE_AIM_PCT,
        DAY_CALORIE_AIM_MIN_KCAL,
      ),
    ).toEqual([{ member_id: "mom", got: 1450, target: 1600, allowed: 80 }]);
  });

  it("accepts a day inside the aim band", () => {
    expect(
      dayCalorieDeviations(
        sliceOf([{ id: "mom", calories: 1550 }]),
        skeleton,
        context,
        DAY_CALORIE_AIM_PCT,
        DAY_CALORIE_AIM_MIN_KCAL,
      ),
    ).toEqual([]);
  });
});

describe("scaleIngredientAmount", () => {
  it("rounds grams/ml to kitchen steps by magnitude", () => {
    expect(scaleIngredientAmount(150, "g", 1.33)).toBe(200); // 199.5 → nearest 10
    expect(scaleIngredientAmount(50, "g", 1.33)).toBe(65); // 66.5 → nearest 5
    expect(scaleIngredientAmount(10, "g", 1.33)).toBe(13); // 13.3 → nearest 1
    expect(scaleIngredientAmount(2, "g", 0.1)).toBe(1); // floor of 1
  });

  it("rounds kg/l to 2 decimals and count-like units to quarters", () => {
    expect(scaleIngredientAmount(0.5, "kg", 1.33)).toBe(0.67);
    expect(scaleIngredientAmount(2, "piece", 1.185)).toBe(2.25);
    expect(scaleIngredientAmount(1, "tbsp", 0.1)).toBe(0.25); // floor of a quarter
  });
});

describe("rescaleDayCalories", () => {
  it("scales calories, macros, and ingredient amounts onto the target", () => {
    const slice = sliceOf([{ id: "mom", calories: 2030 }]);
    const out = rescaleDayCalories(slice, [
      { member_id: "mom", got: 2030, target: 2700, allowed: 135 },
    ]);
    const meal = out.members[0]!.meals[0]!;
    expect(meal.calories).toBe(2700); // 2030 × (2700/2030)
    expect(meal.macros.protein_g).toBe(Math.round(127 * (2700 / 2030)));
    expect(meal.ingredients[0]!.amount).toBe(2.75); // 2 pieces × 1.33 → quarter step
    // Untouched: the original slice and non-numeric fields.
    expect(slice.members[0]!.meals[0]!.calories).toBe(2030);
    expect(meal.recipe_name_ar).toBe("mom-dish");
  });

  it("leaves unlimited ingredients and non-deviating members untouched", () => {
    const slice = sliceOf([
      { id: "mom", calories: 2030 },
      { id: "dad", calories: 2500 },
    ]);
    slice.members[0]!.meals[0]!.ingredients.push({
      name_ar: "سلطة حرة",
      amount: 1,
      unit: "unlimited",
    });
    const out = rescaleDayCalories(slice, [
      { member_id: "mom", got: 2030, target: 2700, allowed: 135 },
    ]);
    expect(out.members[0]!.meals[0]!.ingredients[1]).toEqual({
      name_ar: "سلطة حرة",
      amount: 1,
      unit: "unlimited",
    });
    expect(out.members[1]).toBe(slice.members[1]);
  });

  it("clamps an extreme factor instead of exploding portions", () => {
    const slice = sliceOf([{ id: "mom", calories: 500 }]);
    const out = rescaleDayCalories(slice, [
      { member_id: "mom", got: 500, target: 2700, allowed: 135 },
    ]);
    // 2700/500 = 5.4 → clamped to 2.5.
    expect(out.members[0]!.meals[0]!.calories).toBe(1250);
  });
});

describe("dayProteinDeviations", () => {
  const context = makeContext();
  // target 1600 kcal → protein target 100g, band max(15, 10) = ±15g.
  const skeleton = skeletonWith([{ id: "mom", target: 1600 }]);

  it("accepts a day inside the protein band", () => {
    expect(
      dayProteinDeviations(sliceOf([{ id: "mom", calories: 1600, protein: 100 }]), skeleton, context),
    ).toEqual([]);
    expect(
      dayProteinDeviations(sliceOf([{ id: "mom", calories: 1600, protein: 86 }]), skeleton, context),
    ).toEqual([]);
    expect(
      dayProteinDeviations(sliceOf([{ id: "mom", calories: 1600, protein: 114 }]), skeleton, context),
    ).toEqual([]);
  });

  it("flags a protein-short day even when calories are on target", () => {
    const slice = sliceOf([{ id: "mom", calories: 1600, protein: 60 }]);
    expect(dayCalorieDeviations(slice, skeleton, context)).toEqual([]);
    expect(dayProteinDeviations(slice, skeleton, context)).toEqual([
      { member_id: "mom", got: 60, target: 100, allowed: 15 },
    ]);
  });

  it("applies the 15g minimum band for small targets", () => {
    // target 900 kcal → protein target 56g; 10% = 6 < 15 → band ±15.
    const small = skeletonWith([{ id: "mom", target: 900 }]);
    expect(
      dayProteinDeviations(sliceOf([{ id: "mom", calories: 900, protein: 42 }]), small, context),
    ).toEqual([]);
    expect(
      dayProteinDeviations(sliceOf([{ id: "mom", calories: 900, protein: 40 }]), small, context),
    ).toHaveLength(1);
  });

  it("exempts children entirely", () => {
    const ctx = makeContext(true);
    const skeleton2 = skeletonWith([
      { id: "mom", target: 1600 },
      { id: "member-2", target: 1200 },
    ]);
    expect(
      dayProteinDeviations(
        sliceOf([
          { id: "mom", calories: 1600, protein: 100 },
          { id: "member-2", calories: 1200, protein: 10 }, // child → exempt
        ]),
        skeleton2,
        ctx,
      ),
    ).toEqual([]);
  });
});

describe("normalizedDayDeviation", () => {
  it("weighs calorie and protein misses relative to their own targets", () => {
    // 200/1600 kcal + 20/100 g = 0.125 + 0.2 = 0.325
    expect(
      normalizedDayDeviation(
        [{ member_id: "mom", got: 1400, target: 1600, allowed: 160 }],
        [{ member_id: "mom", got: 80, target: 100, allowed: 15 }],
      ),
    ).toBeCloseTo(0.325, 5);
    expect(normalizedDayDeviation([], [])).toBe(0);
  });
});

describe("buildDayCorrectiveNote", () => {
  it("names each calorie-deviating member with previous total, target, and band", () => {
    const note = buildDayCorrectiveNote([
      { member_id: "mom", got: 1200, target: 1600, allowed: 160 },
    ]);
    expect(note).toContain("تصحيح إلزامي");
    expect(note).toContain('member_id="mom"');
    expect(note).toContain("1200");
    expect(note).toContain("1600");
    expect(note).toContain("من 1440 إلى 1760");
    expect(note).not.toContain("بروتين المحاولة السابقة");
  });

  it("directs protein misses at composition, not portion size", () => {
    const note = buildDayCorrectiveNote(
      [],
      [{ member_id: "mom", got: 60, target: 100, allowed: 15 }],
    );
    expect(note).toContain("تصحيح إلزامي");
    expect(note).toContain("بروتين المحاولة السابقة 60 جم");
    expect(note).toContain("من 85 إلى 115");
    expect(note).toContain("مصادر البروتين");
    expect(note).not.toContain("سعرات اليوم عن النطاق");
  });

  it("carries both sections when both measures missed", () => {
    const note = buildDayCorrectiveNote(
      [{ member_id: "mom", got: 1200, target: 1600, allowed: 160 }],
      [{ member_id: "mom", got: 60, target: 100, allowed: 15 }],
    );
    expect(note).toContain("سعرات اليوم عن النطاق");
    expect(note).toContain("بروتين اليوم عن النطاق");
  });
});

describe("buildDayPrompt — calorie + protein band lines", () => {
  it("states the mandatory sum requirement and the per-member bands", () => {
    const prompt = buildDayPrompt(
      makeContext(),
      skeletonWith([{ id: "mom", target: 1600 }]),
      0,
    );
    expect(prompt).toContain("قيد إلزامي");
    expect(prompt).toContain("اجمعي سعرات وبروتين وجبات كل فرد قبل الإخراج");
    // ±5% aim band around 1600 → 1520..1680
    expect(prompt).toContain("من 1520 إلى 1680");
    // Protein 100g ±15 → 85..115
    expect(prompt).toContain("من 85 إلى 115");
    expect(prompt).toContain("مصادر البروتين");
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

  it("re-rolls a protein-short day at CORRECT calories with a composition note, then accepts the fix", async () => {
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
      // 1st roll: calories on target but only 60g protein (target 100±15);
      // 2nd roll: composition fixed.
      const protein = dayCalls === 1 ? 60 : 100;
      return {
        text: JSON.stringify(sliceOf([{ id: "mom", calories: 1600, protein }])),
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
    // The re-roll carried the protein composition note, not a portion note.
    expect(prompts[1]).toContain("تصحيح إلزامي");
    expect(prompts[1]).toContain("مصادر البروتين");
    expect(prompts[1]).toContain("بروتين المحاولة السابقة 60 جم");
    // Accepted day: calories untouched (in aim band → no rescale), protein fixed.
    expect(plan.members[0]!.days[0]!.day_total.calories).toBe(1600);
    expect(plan.members[0]!.days[0]!.day_total.protein_g).toBe(100);
  }, 30_000);

  it("rescales an in-hard-band but off-aim day onto the target WITHOUT burning a re-roll", async () => {
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
      // 1450: inside hard ±160 (no re-roll) but outside aim ±80 (rescaled).
      return {
        text: JSON.stringify(sliceOf([{ id: "mom", calories: 1450 }])),
        tokensIn: 10,
        tokensOut: 20,
        stopReason: null,
      };
    });

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext(),
    });

    expect(dayCalls).toBe(1); // no corrective re-roll spent
    expect(plan.members[0]!.days[0]!.day_total.calories).toBe(1600);
  }, 30_000);

  it("accepts the CLOSEST attempt when every re-roll stays out of band — then rescales it onto the target", async () => {
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
    // Best attempt (1350) deterministically rescaled onto the 1600 target.
    expect(plan.members[0]!.days[0]!.day_total.calories).toBe(1600);
  }, 30_000);
});
