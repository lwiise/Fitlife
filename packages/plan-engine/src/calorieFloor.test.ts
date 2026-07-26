import { describe, it, expect } from "vitest";
import {
  minimumDailyCalories,
  applyCalorieFloor,
  ADULT_FEMALE_CALORIE_FLOOR,
  ADULT_MALE_CALORIE_FLOOR,
  MINOR_CALORIE_FLOOR,
} from "./calorieFloor";

describe("minimumDailyCalories", () => {
  it("floors minors highest — they are growing and must not be restricted unsupervised", () => {
    expect(minimumDailyCalories({ age: 15, sex: "female" })).toBe(MINOR_CALORIE_FLOOR);
    expect(minimumDailyCalories({ age: 15, sex: "male" })).toBe(MINOR_CALORIE_FLOOR);
    // is_child wins even when age is absent (the member_type path).
    expect(minimumDailyCalories({ is_child: true, sex: "male" })).toBe(MINOR_CALORIE_FLOOR);
  });

  it("uses adult floors at 18 and above", () => {
    expect(minimumDailyCalories({ age: 18, sex: "female" })).toBe(ADULT_FEMALE_CALORIE_FLOOR);
    expect(minimumDailyCalories({ age: 40, sex: "male" })).toBe(ADULT_MALE_CALORIE_FLOOR);
  });

  it("defaults to the female floor when sex is unknown (the safer of the two)", () => {
    expect(minimumDailyCalories({ age: 30, sex: null })).toBe(ADULT_FEMALE_CALORIE_FLOOR);
  });
});

describe("applyCalorieFloor", () => {
  const macros = { protein_g: 37, carbs_g: 71, fat_g: 18 };

  it("leaves a legitimate target completely untouched", () => {
    const t = { daily_calories_target: 1610, macros_target: { protein_g: 181, carbs_g: 161, fat_g: 27 } };
    const out = applyCalorieFloor(t, { age: 34, sex: "female" });
    expect(out.daily_calories_target).toBe(1610);
    expect(out.macros_target).toEqual(t.macros_target);
    expect(out.raisedFrom).toBeUndefined();
  });

  it("raises the real 630 kcal/15-year-old case to the minor floor", () => {
    // The exact production output that motivated this backstop.
    const out = applyCalorieFloor({ daily_calories_target: 630, macros_target: macros }, { age: 15, sex: "female" });
    expect(out.daily_calories_target).toBe(MINOR_CALORIE_FLOOR);
    expect(out.raisedFrom).toBe(630);
  });

  it("scales macros by the same factor so the split stays coherent", () => {
    const input = { protein_g: 50, carbs_g: 90, fat_g: 22 };
    const out = applyCalorieFloor({ daily_calories_target: 800, macros_target: input }, { age: 30, sex: "female" });
    const factor = ADULT_FEMALE_CALORIE_FLOOR / 800; // 1.5
    expect(out.daily_calories_target).toBe(ADULT_FEMALE_CALORIE_FLOOR);
    expect(out.macros_target).toEqual({
      protein_g: Math.round(50 * factor),
      carbs_g: Math.round(90 * factor),
      fat_g: Math.round(22 * factor),
    });
    // The contract is PROPORTIONALITY, not absolute reconstruction: the floor
    // must not silently re-balance a split it was never asked to judge. (An
    // earlier version of this test asserted the scaled macros reconstruct the
    // new calorie total — but that fails whenever the INPUT macros didn't
    // reconstruct their own total, which says nothing about the scaling.)
    const ratioBefore = input.protein_g / input.carbs_g;
    const ratioAfter = out.macros_target.protein_g / out.macros_target.carbs_g;
    expect(Math.abs(ratioAfter - ratioBefore)).toBeLessThan(0.02);
  });

  it("substitutes a whole target when the upstream one is zero or absent", () => {
    const out = applyCalorieFloor({ daily_calories_target: 0, macros_target: { protein_g: 0, carbs_g: 0, fat_g: 0 } }, { age: 30, sex: "female" });
    expect(out.daily_calories_target).toBe(ADULT_FEMALE_CALORIE_FLOOR);
    expect(out.macros_target.protein_g).toBeGreaterThan(0);
    expect(out.raisedFrom).toBe(0);
  });

  it("never binds on pregnancy/lactation targets, which sit well above the floor", () => {
    for (const kcal of [2000, 2232]) {
      const out = applyCalorieFloor({ daily_calories_target: kcal, macros_target: macros }, { age: 29, sex: "female" });
      expect(out.daily_calories_target).toBe(kcal);
      expect(out.raisedFrom).toBeUndefined();
    }
  });
});
