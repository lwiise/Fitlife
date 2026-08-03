import { describe, it, expect } from "vitest";
import { absenceScaleFactor, scaleIngredients, adjustedBatchWeight } from "./sharedMealAbsence";
import { LOCALE_CODES_ORDERED, getPlanStrings } from "./locales";
import type { PerMemberPortion, Ingredient } from "@fitlife/plan-engine";

/**
 * The cook was the only reader NOT shown the adjusted quantities.
 *
 * When a sharer is marked out of one occurrence, the batch scales down to the
 * remaining sharers — deterministic display math, the stored plan untouched.
 * `MealCard` applies it only when it receives `absentMemberIds`, and the
 * housekeeper page never read `meal_absences`, so /plan showed mom the adjusted
 * amounts while the kitchen went on cooking for the full household. The
 * explanation line beneath the numbers was gated on `!translated` — excluding
 * the one person actually measuring the ingredients, with a comment saying it
 * existed "so the cook never wonders why today's amounts differ".
 *
 * This pins the arithmetic her view now runs, and that both readers get told.
 */

const portions = (spec: Array<[string, number]>): PerMemberPortion[] =>
  spec.map(([member_id, portion_percentage]) => ({
    member_id,
    portion_percentage,
    portion_grams: portion_percentage * 18, // an 1800 g batch
  }));

const HOUSEHOLD = portions([
  ["mom", 25],
  ["dad", 35],
  ["saud", 30],
  ["lama", 10],
]);

describe("what the kitchen actually cooks", () => {
  it("drops the absent sharer's share out of the batch", () => {
    const factor = absenceScaleFactor(HOUSEHOLD, new Set(["saud"]));
    expect(factor).toBeCloseTo(0.7, 5);
  });

  it("scales the ingredients the cook measures", () => {
    const ings: Ingredient[] = [
      { name_ar: "دجاج", amount: 1000, unit: "g" },
      { name_ar: "أرز", amount: 500, unit: "g" },
    ];
    const out = scaleIngredients(ings, absenceScaleFactor(HOUSEHOLD, new Set(["saud"])));
    expect(out[0]!.amount).toBe(700);
    expect(out[1]!.amount).toBe(350);
  });

  it("scales the finished batch weight", () => {
    expect(
      adjustedBatchWeight(1800, HOUSEHOLD, new Set(["saud"]), 0.7),
    ).toBeCloseTo(1260, 0);
  });

  it("changes nothing when everyone is present — her view is unaffected by default", () => {
    expect(absenceScaleFactor(HOUSEHOLD, new Set())).toBe(1);
    const ings: Ingredient[] = [{ name_ar: "دجاج", amount: 1000, unit: "g" }];
    expect(scaleIngredients(ings, 1)[0]!.amount).toBe(1000);
  });

  it("refuses to cook nothing", () => {
    // Data says everyone is out (the UI prevents removing the last sharer).
    // Showing the original recipe is the safe answer — a factor of 0 would tell
    // her to measure out zero grams.
    expect(absenceScaleFactor(HOUSEHOLD, new Set(["mom", "dad", "saud", "lama"]))).toBe(1);
  });
});

describe("and she is told why the numbers moved", () => {
  it("has the line in every language she can pick", () => {
    for (const code of LOCALE_CODES_ORDERED) {
      const t = getPlanStrings(code);
      expect(t.meal_adjusted_for, code).toBeTruthy();
      // It introduces a list of names, so it must not read as a whole sentence
      // that ends before them.
      expect(t.meal_adjusted_for.trim().endsWith(":"), code).toBe(true);
    }
  });
});

/**
 * The printed sheet goes to the kitchen too. Its per-meal ingredient amounts are
 * already the member's OWN portion, so those are right either way — but the
 * batch total and the list of who is sharing were rendered straight from the
 * stored plan, which overstates the amount and names someone who is not eating.
 */
describe("the printed sheet", () => {
  const dayIndex = 2;
  const absentKeys = new Set([`${dayIndex}|lunch|saud`]);

  /** Mirrors MemberPlanPDF: absentees for THIS occurrence only. */
  const absentFor = (slot: string) =>
    new Set(
      HOUSEHOLD.map((p) => p.member_id).filter((id) =>
        absentKeys.has(`${dayIndex}|${slot}|${id}`),
      ),
    );

  it("scales the printed batch to the people still eating it", () => {
    const absent = absentFor("lunch");
    expect(absent.size).toBe(1);
    const batch = adjustedBatchWeight(
      1800,
      HOUSEHOLD,
      absent,
      absenceScaleFactor(HOUSEHOLD, absent),
    );
    expect(batch).toBeCloseTo(1260, 0);
  });

  it("leaves a different slot on the same day untouched", () => {
    // The absence is keyed to one occurrence, not the whole day.
    expect(absentFor("dinner").size).toBe(0);
    expect(absenceScaleFactor(HOUSEHOLD, absentFor("dinner"))).toBe(1);
  });

  it("drops the absent sharer from the participant list", () => {
    const absent = absentFor("lunch");
    const present = HOUSEHOLD.filter((p) => !absent.has(p.member_id)).map(
      (p) => p.member_id,
    );
    expect(present).not.toContain("saud");
    expect(present).toHaveLength(3);
  });
});
