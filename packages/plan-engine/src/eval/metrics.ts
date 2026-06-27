import type { MealPlan } from "../schema";
import { normalizeDishKey } from "../generate";

// Refined-flour / refined-sugar flags. Kept in sync with the cookbook-style guard
// in generate.ts (WS3 lifts that to a single shared const; until then this mirrors it).
export const EVAL_REFINED_FLAGS = ["سكر أبيض", "دقيق أبيض", "طحين أبيض"];

export interface MacroAccuracyRow {
  member_id: string;
  day_index: number;
  target: number;
  actual: number;
  driftPct: number; // |actual - target| / target * 100
}

/** Per member/day: how far the day's total calories drifted from the member's target. */
export function macroAccuracy(plan: MealPlan): MacroAccuracyRow[] {
  const rows: MacroAccuracyRow[] = [];
  for (const member of plan.members) {
    const target = member.daily_calories_target;
    if (!target || target <= 0) continue;
    for (const day of member.days) {
      const actual = day.day_total?.calories ?? 0;
      rows.push({
        member_id: member.member_id,
        day_index: day.day_index,
        target,
        actual,
        driftPct: (Math.abs(actual - target) / target) * 100,
      });
    }
  }
  return rows;
}

export function maxDriftPct(rows: MacroAccuracyRow[]): number {
  return rows.reduce((max, r) => Math.max(max, r.driftPct), 0);
}

export function meanDriftPct(rows: MacroAccuracyRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, r) => sum + r.driftPct, 0) / rows.length;
}

export interface RepeatRow {
  member_id: string;
  totalMeals: number;
  distinctDishes: number;
  repeatPct: number; // (totalMeals - distinct) / totalMeals * 100
}

/**
 * In-week repetition per member: how often the SAME dish (normalized recipe name)
 * recurs across the member's 7 days. 0% = every meal is a distinct dish.
 */
export function inWeekRepeatRate(plan: MealPlan): RepeatRow[] {
  return plan.members.map((member) => {
    const keys: string[] = [];
    for (const day of member.days) {
      for (const meal of day.meals) {
        keys.push(normalizeDishKey(meal.recipe_name_ar));
      }
    }
    const distinct = new Set(keys).size;
    const total = keys.length;
    return {
      member_id: member.member_id,
      totalMeals: total,
      distinctDishes: distinct,
      repeatPct: total > 0 ? ((total - distinct) / total) * 100 : 0,
    };
  });
}

/** Count meals whose ingredients name a refined-flour / refined-sugar flag. */
export function refinedFlourViolations(plan: MealPlan): number {
  let count = 0;
  for (const member of plan.members) {
    for (const day of member.days) {
      for (const meal of day.meals) {
        const text = meal.ingredients.map((i) => i.name_ar).join(" ");
        if (EVAL_REFINED_FLAGS.some((flag) => text.includes(flag))) count++;
      }
    }
  }
  return count;
}

export interface PlanQualityReport {
  macro: { meanDriftPct: number; maxDriftPct: number; rows: MacroAccuracyRow[] };
  repeat: { worstRepeatPct: number; rows: RepeatRow[] };
  refinedFlourViolations: number;
}

export function scorePlan(plan: MealPlan): PlanQualityReport {
  const macroRows = macroAccuracy(plan);
  const repeatRows = inWeekRepeatRate(plan);
  return {
    macro: {
      meanDriftPct: meanDriftPct(macroRows),
      maxDriftPct: maxDriftPct(macroRows),
      rows: macroRows,
    },
    repeat: {
      worstRepeatPct: repeatRows.reduce((m, r) => Math.max(m, r.repeatPct), 0),
      rows: repeatRows,
    },
    refinedFlourViolations: refinedFlourViolations(plan),
  };
}
