import { describe, it, expect } from "vitest";
import { MealPlanSchema, type MealPlan, type Meal } from "../schema";
import {
  macroAccuracy,
  maxDriftPct,
  inWeekRepeatRate,
  refinedFlourViolations,
  scorePlan,
} from "./metrics";

// Deterministic unit tests for the eval metric math (runs in CI; no API calls).

function meal(name: string, calories: number, ingredient = "بيض"): Meal {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: name,
    ingredients: [{ name_ar: ingredient, amount: 1, unit: "piece" }],
    prep_steps_ar: ["خطوة"],
    calories,
    macros: { protein_g: 10, carbs_g: 10, fat_g: 5 },
  };
}

function plan(opts: {
  target: number;
  dayTotals: number[];
  dishNames: string[][]; // per day, the dish names
  ingredient?: (dish: string) => string;
}): MealPlan {
  return MealPlanSchema.parse({
    week_start_date: "2026-06-06",
    members: [
      {
        member_id: "mom",
        member_name_ar: "أم",
        primary_goal: "fat_loss",
        daily_calories_target: opts.target,
        macros_target: { protein_g: 120, carbs_g: 150, fat_g: 60 },
        days: opts.dayTotals.map((cal, di) => ({
          day_index: di,
          day_name_ar: `يوم ${di}`,
          meals: opts.dishNames[di]!.map((n) =>
            meal(n, cal, opts.ingredient ? opts.ingredient(n) : "بيض"),
          ),
          day_total: { calories: cal, protein_g: 30, carbs_g: 30, fat_g: 15 },
        })),
      },
    ],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    days_total: opts.dayTotals.length,
    generating: false,
  });
}

describe("macroAccuracy / drift", () => {
  it("computes drift as |actual - target| / target percent", () => {
    const p = plan({ target: 1000, dayTotals: [1200, 800], dishNames: [["a"], ["b"]] });
    const rows = macroAccuracy(p);
    expect(rows.map((r) => Math.round(r.driftPct))).toEqual([20, 20]);
    expect(maxDriftPct(rows)).toBeCloseTo(20);
  });
});

describe("inWeekRepeatRate", () => {
  it("is 0% when every dish is distinct", () => {
    const p = plan({
      target: 1000,
      dayTotals: [1000, 1000, 1000],
      dishNames: [["كبسة"], ["مندي"], ["مرقوق"]],
    });
    expect(inWeekRepeatRate(p)[0]!.repeatPct).toBe(0);
  });

  it("flags repeated dishes (normalized) across the week", () => {
    const p = plan({
      target: 1000,
      dayTotals: [1000, 1000, 1000, 1000],
      // "كبسة" appears 3 of 4 days → 2 repeats of 4 meals = 50%
      dishNames: [["كبسة"], ["كبسة"], ["كبسة"], ["مندي"]],
    });
    expect(inWeekRepeatRate(p)[0]!.repeatPct).toBe(50);
  });
});

describe("refinedFlourViolations", () => {
  it("counts meals whose ingredients contain a refined flag", () => {
    const p = plan({
      target: 1000,
      dayTotals: [1000, 1000],
      dishNames: [["كيك"], ["سلطة"]],
      ingredient: (dish) => (dish === "كيك" ? "دقيق أبيض" : "خس"),
    });
    expect(refinedFlourViolations(p)).toBe(1);
  });
});

describe("scorePlan", () => {
  it("aggregates all three metric families", () => {
    const p = plan({
      target: 1000,
      dayTotals: [1100, 900],
      dishNames: [["كبسة"], ["كبسة"]],
    });
    const report = scorePlan(p);
    expect(report.macro.maxDriftPct).toBeCloseTo(10);
    expect(report.repeat.worstRepeatPct).toBe(50);
    expect(report.refinedFlourViolations).toBe(0);
  });
});
