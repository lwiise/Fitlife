import { describe, it, expect } from "vitest";
import { hasPendingGeneration, MEMBER_GEN_MAX_ATTEMPTS, type MealPlan } from "@fitlife/plan-engine";
import { LOCALE_CODES_ORDERED, getPlanStrings } from "./locales";

/**
 * The housekeeper's page used to render her waiting card INSTEAD of the plan
 * whenever any member of the household was still queued or missing a day. She is
 * the only person who cannot read the Arabic view at all, and she is the one who
 * has to cook — so on a six-member household, where a run yields about two days
 * of seven, four members could have complete translated weeks and she would
 * still be looking at a spinner because a fifth had not been generated.
 *
 * The same predicate now drives a NOTICE above a usable plan. These tests pin
 * the split: `preparing` means nothing is cookable; `partialWeek` means more is
 * coming.
 */

type Member = MealPlan["members"][number];

function member(id: string, filledDays: number): Member {
  return {
    member_id: id,
    member_name_ar: id,
    primary_goal: "fat_loss",
    daily_calories_target: 1600,
    macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
    days: Array.from({ length: 7 }, (_, i) => ({
      day_index: i,
      day_name_ar: `يوم ${i}`,
      day_total: { calories: 600, protein_g: 40, carbs_g: 50, fat_g: 20 },
      meals:
        i < filledDays
          ? [
              {
                slot: "lunch",
                slot_name_ar: "الغداء",
                recipe_name_ar: "دجاج",
                ingredients: [{ name_ar: "دجاج", amount: 200, unit: "g" }],
                prep_steps_ar: ["اطبخي"],
                calories: 600,
                macros: { protein_g: 40, carbs_g: 50, fat_g: 20 },
              },
            ]
          : [],
    })),
  } as unknown as Member;
}

function plan(members: Member[]): MealPlan {
  return {
    week_start_date: "2026-08-01",
    days_total: 7,
    generating: false,
    members,
  } as unknown as MealPlan;
}

/** Mirrors housekeeper/page.tsx: nothing to cook at all. */
const isPreparing = (p: MealPlan) =>
  p.members.every((m) => m.days.every((d) => d.meals.length === 0));

const isPartial = (p: MealPlan, familyMemberIds: string[]) =>
  hasPendingGeneration({ plan: p, familyMemberIds, maxAttempts: MEMBER_GEN_MAX_ATTEMPTS });

describe("what the cook is actually blocked on", () => {
  it("is only blocked when there is nothing cookable at all", () => {
    const empty = plan([member("mom", 0), member("m1", 0)]);
    expect(isPreparing(empty)).toBe(true);
  });

  it("is NOT blocked once someone has real days, even mid-household", () => {
    // The exact live case: four complete weeks, a fifth member absent entirely.
    const p = plan([member("mom", 7), member("m1", 7), member("m2", 7), member("m3", 7)]);
    expect(isPreparing(p)).toBe(false);
    // …and she is still told more is coming, rather than shown a finished week.
    expect(isPartial(p, ["m1", "m2", "m3", "m4"])).toBe(true);
  });

  it("says nothing extra once the household is complete", () => {
    const p = plan([member("mom", 7), member("m1", 7)]);
    expect(isPreparing(p)).toBe(false);
    expect(isPartial(p, ["m1"])).toBe(false);
  });

  it("still shows the partial notice for a member missing only some days", () => {
    const p = plan([member("mom", 7), member("m1", 2)]);
    expect(isPreparing(p)).toBe(false);
    expect(isPartial(p, ["m1"])).toBe(true);
  });
});

describe("both waiting messages exist in every language she can pick", () => {
  it("has a partial-week line for each locale, distinct from the empty one", () => {
    for (const code of LOCALE_CODES_ORDERED) {
      const t = getPlanStrings(code);
      expect(t.partial_week, code).toBeTruthy();
      expect(t.partial_week, code).not.toBe(t.awaiting_family);
    }
  });

  // The old copy promised «translation will begin once they're ready», which
  // stopped being true the moment translation started running on a partial
  // week — it now begins as soon as there is a single meal to translate.
  it("no longer says translation waits for the whole household", () => {
    expect(getPlanStrings("en").awaiting_family).not.toMatch(/once they'?re ready/i);
    expect(getPlanStrings("en").awaiting_family).toMatch(/as soon as/i);
  });
});
