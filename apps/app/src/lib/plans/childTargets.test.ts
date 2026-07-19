import { describe, it, expect } from "vitest";
import type { MealPlan, MemberPlan, Day } from "@fitlife/plan-engine";
import { applyChildDisplayTargets } from "./childTargets";

const thisYear = new Date().getFullYear();

function day(di: number, calories: number, protein: number, carbs: number, fat: number): Day {
  return {
    day_index: di,
    day_name_ar: `اليوم ${di + 1}`,
    meals: [
      {
        slot: "breakfast",
        slot_name_ar: "الفطور",
        recipe_name_ar: `d${di}`,
        ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
        prep_steps_ar: ["اخفقي"],
        calories,
        macros: { protein_g: protein, carbs_g: carbs, fat_g: fat },
      },
    ],
    day_total: { calories, protein_g: protein, carbs_g: carbs, fat_g: fat },
  };
}

function member(id: string, target: number, days: Day[]): MemberPlan {
  return {
    member_id: id,
    member_name_ar: id,
    primary_goal: "muscle_gain",
    daily_calories_target: target,
    macros_target: { protein_g: 205, carbs_g: 273, fat_g: 91 },
    days,
  };
}

function planWith(members: MemberPlan[]): MealPlan {
  return { week_start_date: "2026-07-17", members };
}

describe("applyChildDisplayTargets", () => {
  const childDays = [day(0, 900, 54, 110, 20), day(1, 1100, 70, 130, 24)]; // mean 1000/62/120/22

  it("replaces a child's bogus stored estimate with the mean of their real days (member_type)", () => {
    const plan = planWith([member("member-2", 2730, childDays)]);
    const out = applyChildDisplayTargets(plan, {
      mom: { member_type: "adult", birth_year: 1990 },
      members: [{ id: "member-2", member_type: "child", birth_year: 2016 }],
    });
    const m = out.members[0]!;
    expect(m.is_child).toBe(true);
    expect(m.daily_calories_target).toBe(1000);
    expect(m.macros_target).toEqual({ protein_g: 62, carbs_g: 120, fat_g: 22 });
  });

  it("treats an under-18 member entered as 'adult' as a child (age rule)", () => {
    const plan = planWith([member("teen", 2730, childDays)]);
    const out = applyChildDisplayTargets(plan, {
      mom: { member_type: "adult", birth_year: 1990 },
      members: [{ id: "teen", member_type: "adult", birth_year: thisYear - 16 }],
    });
    expect(out.members[0]!.is_child).toBe(true);
    expect(out.members[0]!.daily_calories_target).toBe(1000);
  });

  it("leaves a real adult's target untouched (same reference)", () => {
    const adult = member("mom", 2730, [day(0, 2700, 200, 270, 90)]);
    const plan = planWith([adult]);
    const out = applyChildDisplayTargets(plan, {
      mom: { member_type: "adult", birth_year: 1990 },
      members: [],
    });
    expect(out).toBe(plan); // nothing changed → same reference
    expect(out.members[0]!.daily_calories_target).toBe(2730);
    expect(out.members[0]!.is_child).toBeUndefined();
  });

  it("is idempotent for a plan the engine already reconciled", () => {
    // Header already equals the mean → no change, same member reference kept.
    const reconciled: MemberPlan = { ...member("member-2", 1000, childDays), is_child: true };
    reconciled.macros_target = { protein_g: 62, carbs_g: 120, fat_g: 22 };
    const plan = planWith([reconciled]);
    const out = applyChildDisplayTargets(plan, {
      mom: { member_type: "adult", birth_year: 1990 },
      members: [{ id: "member-2", member_type: "child", birth_year: 2016 }],
    });
    expect(out).toBe(plan);
    expect(out.members[0]!).toBe(reconciled);
  });
});
