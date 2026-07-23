import { describe, it, expect } from "vitest";
import type { Ingredient, PerMemberPortion } from "@fitlife/plan-engine";
import {
  absenceScaleFactor,
  adjustedBatchWeight,
  roundAmountForUnit,
  scaleIngredients,
} from "./sharedMealAbsence";

const portion = (
  member_id: string,
  opts: Partial<PerMemberPortion> = {},
): PerMemberPortion => ({ member_id, ...opts });

const ing = (
  name_ar: string,
  amount: number,
  unit: Ingredient["unit"],
  opts: Partial<Ingredient> = {},
): Ingredient => ({ name_ar, amount, unit, ...opts });

describe("absenceScaleFactor", () => {
  const portions = [
    portion("mom", { portion_percentage: 40, portion_grams: 400 }),
    portion("a", { portion_percentage: 35, portion_grams: 350 }),
    portion("b", { portion_percentage: 25, portion_grams: 250 }),
  ];

  it("is 1 when nobody is absent", () => {
    expect(absenceScaleFactor(portions, new Set())).toBe(1);
  });

  it("uses percentages when every portion has one", () => {
    expect(absenceScaleFactor(portions, new Set(["b"]))).toBeCloseTo(0.75);
    expect(absenceScaleFactor(portions, new Set(["mom", "a"]))).toBeCloseTo(0.25);
  });

  it("normalizes percentages that do not sum to exactly 100", () => {
    const skewed = [
      portion("mom", { portion_percentage: 50 }),
      portion("a", { portion_percentage: 52 }),
    ];
    expect(absenceScaleFactor(skewed, new Set(["a"]))).toBeCloseTo(50 / 102);
  });

  it("falls back to grams when a percentage is missing", () => {
    const gramsOnly = [
      portion("mom", { portion_grams: 600 }),
      portion("a", { portion_percentage: 40, portion_grams: 200 }),
      portion("b", { portion_grams: 200 }),
    ];
    expect(absenceScaleFactor(gramsOnly, new Set(["mom"]))).toBeCloseTo(0.4);
  });

  it("falls back to headcount when portions carry no numbers", () => {
    const bare = [portion("mom"), portion("a"), portion("b"), portion("c")];
    expect(absenceScaleFactor(bare, new Set(["c"]))).toBeCloseTo(0.75);
  });

  it("never scales to zero — everyone absent shows the original recipe", () => {
    expect(absenceScaleFactor(portions, new Set(["mom", "a", "b"]))).toBe(1);
  });

  it("ignores absent ids that are not sharers of this meal", () => {
    expect(absenceScaleFactor(portions, new Set(["stranger"]))).toBe(1);
  });
});

describe("roundAmountForUnit", () => {
  it("rounds grams/ml to whole numbers at 10+, one decimal below", () => {
    expect(roundAmountForUnit(187.5, "g")).toBe(188);
    expect(roundAmountForUnit(7.33, "g")).toBe(7.3);
    expect(roundAmountForUnit(112.4, "ml")).toBe(112);
  });

  it("keeps two decimals for kg/l", () => {
    expect(roundAmountForUnit(0.746, "kg")).toBe(0.75);
    expect(roundAmountForUnit(1.333, "l")).toBe(1.33);
  });

  it("uses quarter steps for spoons, cups, and pieces", () => {
    expect(roundAmountForUnit(0.66, "cup")).toBe(0.75);
    expect(roundAmountForUnit(1.1, "tbsp")).toBe(1);
    expect(roundAmountForUnit(2.6, "piece")).toBe(2.5);
  });

  it("never rounds a countable amount down to zero", () => {
    expect(roundAmountForUnit(0.1, "piece")).toBe(0.25);
  });
});

describe("scaleIngredients", () => {
  it("returns the same array at factor 1", () => {
    const items = [ing("أرز", 300, "g")];
    expect(scaleIngredients(items, 1)).toBe(items);
  });

  it("scales amounts and ranges with unit-aware rounding", () => {
    const items = [
      ing("أرز", 400, "g"),
      ing("حليب", 1, "l"),
      ing("بيض", 6, "piece", { amount_min: 5, amount_max: 7 }),
    ];
    const scaled = scaleIngredients(items, 0.75);
    expect(scaled[0]!.amount).toBe(300);
    expect(scaled[1]!.amount).toBe(0.75);
    expect(scaled[2]!.amount).toBe(4.5);
    expect(scaled[2]!.amount_min).toBe(3.75);
    expect(scaled[2]!.amount_max).toBe(5.25);
  });

  it("leaves unlimited amounts untouched", () => {
    const items = [ing("خضار ورقية", 1, "unlimited")];
    expect(scaleIngredients(items, 0.5)[0]).toEqual(items[0]);
  });

  it("does not mutate the input", () => {
    const items = [ing("أرز", 400, "g")];
    scaleIngredients(items, 0.5);
    expect(items[0]!.amount).toBe(400);
  });
});

describe("adjustedBatchWeight", () => {
  const portions = [
    portion("mom", { portion_grams: 500 }),
    portion("a", { portion_grams: 300 }),
    portion("b", { portion_grams: 200 }),
  ];

  it("passes null through", () => {
    expect(adjustedBatchWeight(null, portions, new Set(["a"]), 0.7)).toBeNull();
    expect(adjustedBatchWeight(undefined, portions, new Set(["a"]), 0.7)).toBeNull();
  });

  it("returns the original weight when nobody is absent", () => {
    expect(adjustedBatchWeight(1000, portions, new Set(), 1)).toBe(1000);
  });

  it("sums the present grams when every portion carries them", () => {
    expect(adjustedBatchWeight(1000, portions, new Set(["b"]), 0.8)).toBe(800);
  });

  it("falls back to scaling the batch when grams are incomplete", () => {
    const partial = [portion("mom", { portion_grams: 500 }), portion("a")];
    expect(adjustedBatchWeight(900, partial, new Set(["a"]), 0.5)).toBe(450);
  });
});
