/**
 * A scoped regeneration used to skip the calorie band entirely.
 *
 * `if (!partialScope)` guarded the whole band-and-rescale block, on the stated
 * reasoning that "the slice's own sum isn't the member's full day". The premise
 * is right — under a partial scope the model still returns a whole day, some of
 * which is discarded, and the rest of the day is spliced back from the stored
 * plan — but the conclusion was backwards: the fix is to add the other half in,
 * not to stop checking.
 *
 * Measured on production. One tap of «إنشاء خطة جديدة» on a member (the dialog
 * defaults to scope "both", which pulls every co-sharer in too) rewrote five of
 * seven days with no band check and no rescale, and the household came out at
 * roughly half its targets — a 3865-kcal adult landed on 1880-2230, while the
 * two days that run did not touch stayed at 3785-4045.
 *
 * What is pinned here is the projection: the band must be judged on
 * carried + spliceable-fresh, and the rescale must close that gap using only the
 * meals it can actually move.
 */
import { describe, it, expect } from "vitest";
import {
  dayCalorieDeviations,
  dayProteinDeviations,
  rescaleDayCalories,
  type CarriedDayTotals,
} from "./generate";
import type { DaySlice, PlanSkeleton, Meal } from "./schema";
import type { PlanPromptContext } from "./buildContext";

const TARGET = 3865;
const PROTEIN_TARGET = 290;

function meal(name: string, calories: number, protein: number): Meal {
  return {
    slot: "dinner",
    slot_name_ar: "عشاء",
    recipe_name_ar: name,
    ingredients: [{ name_ar: "أرز", amount: 200, unit: "g" }],
    prep_steps_ar: ["اطبخي"],
    calories,
    macros: { protein_g: protein, carbs_g: 100, fat_g: 40 },
  };
}

function slice(meals: Meal[]): DaySlice {
  return { day_index: 0, members: [{ member_id: "dad", meals }] };
}

const skeleton: PlanSkeleton = {
  members: [
    {
      member_id: "dad",
      member_name_ar: "فيصل",
      primary_goal: "muscle_gain",
      daily_calories_target: TARGET,
      macros_target: { protein_g: PROTEIN_TARGET, carbs_g: 380, fat_g: 120 },
      days: [],
    },
  ],
  methodology_notes_ar: "ملاحظات",
  safety_disclaimer_ar: "تنبيه",
};

/** Only the adult matters here; the context just has to resolve `is_child`. */
const context = {
  mom: { member_type: "adult", age: 36 },
  family_members: [{ id: "dad", is_child: false }],
} as unknown as PlanPromptContext;

const carried = (calories: number, protein_g: number): CarriedDayTotals =>
  new Map([["dad", { calories, protein_g }]]);

const dayTotal = (s: DaySlice) =>
  s.members[0]!.meals.reduce((n, m) => n + m.calories, 0);

describe("the band counts the meals a scoped regen is NOT rewriting", () => {
  it("does not call a member starving over the half of the day it is holding", () => {
    // 1900 fresh + 1965 carried = 3865 — exactly on target. Judged on the fresh
    // half alone this reads as a 2000-kcal miss and would burn re-rolls, then
    // rescale a correct day into a wrong one.
    const devs = dayCalorieDeviations(
      slice([meal("عشاء", 1900, 140)]),
      skeleton,
      context,
      undefined,
      undefined,
      carried(1965, 150),
    );
    expect(devs).toEqual([]);
  });

  it("still catches a genuinely low day once the carried half is added", () => {
    // The production shape: 2220 total against 3865.
    const devs = dayCalorieDeviations(
      slice([meal("عشاء", 1200, 90)]),
      skeleton,
      context,
      undefined,
      undefined,
      carried(1020, 70),
    );
    expect(devs).toHaveLength(1);
    expect(devs[0]).toMatchObject({ member_id: "dad", got: 2220, target: TARGET });
  });

  it("applies the same rule to protein", () => {
    const onTarget = dayProteinDeviations(
      slice([meal("عشاء", 1900, 140)]),
      skeleton,
      context,
      carried(1965, 150),
    );
    expect(onTarget).toEqual([]);

    const short = dayProteinDeviations(
      slice([meal("عشاء", 1900, 90)]),
      skeleton,
      context,
      carried(1965, 70),
    );
    expect(short).toHaveLength(1);
    expect(short[0]!.got).toBe(160);
  });

  it("behaves exactly as before for a full regen (nothing carried)", () => {
    const onTarget = dayCalorieDeviations(slice([meal("عشاء", TARGET, 290)]), skeleton, context);
    expect(onTarget).toEqual([]);
    const low = dayCalorieDeviations(slice([meal("عشاء", 2000, 150)]), skeleton, context);
    expect(low).toHaveLength(1);
  });
});

describe("the rescale closes the gap with the meals it can move", () => {
  it("scales the fresh half so carried + fresh lands ON the target", () => {
    const s = slice([meal("عشاء", 1200, 90)]);
    const c = carried(1020, 70);
    const dev = dayCalorieDeviations(s, skeleton, context, undefined, undefined, c)[0]!;

    // Whole-day miss → fresh-meal space, which is what rescaleDayCalories scales by.
    const carriedKcal = c.get("dad")!.calories;
    const fixed = rescaleDayCalories(s, [
      { ...dev, got: dev.got - carriedKcal, target: dev.target - carriedKcal },
    ]);

    // 1200 → 2845 so the spliced day is 2845 + 1020 = 3865.
    expect(dayTotal(fixed) + carriedKcal).toBeCloseTo(TARGET, -2);
  });

  it("leaves a full regen's arithmetic untouched", () => {
    const s = slice([meal("عشاء", 2000, 150)]);
    const dev = dayCalorieDeviations(s, skeleton, context)[0]!;
    const fixed = rescaleDayCalories(s, [dev]);
    expect(dayTotal(fixed)).toBeCloseTo(TARGET, -2);
  });

  it("is not asked to scale when the carried meals already meet the target", () => {
    // Carried alone is 4000 against a 3865 target: no factor on the remaining
    // meals can fix that, and target-minus-carried is negative. The caller must
    // recognise it rather than scale to a nonsense number — pinned here as the
    // arithmetic that makes the guard necessary.
    const c = carried(4000, 300);
    const dev = dayCalorieDeviations(
      slice([meal("عشاء", 400, 30)]),
      skeleton,
      context,
      undefined,
      undefined,
      c,
    )[0]!;
    expect(dev.target - c.get("dad")!.calories).toBeLessThan(0);
  });
});
