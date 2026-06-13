import type { Meal } from "@fitlife/plan-engine";

// Canonical daily order. The `slot` enum can't tell a morning snack from an evening
// one (both are "snack"), so snacks are bucketed by their position relative to that
// member's lunch: before → morning, after → evening.
const BREAKFAST = 0;
const MORNING_SNACK = 1;
const LUNCH = 2;
const EVENING_SNACK = 3;
const DINNER = 4;
const OTHER = 5;

function lunchIndex(meals: Meal[]): number {
  return meals.findIndex((m) => m.slot === "lunch");
}

/** Morning if the snack is emitted before this member's lunch, else evening. */
function snackBucketFor(meals: Meal[], mealIndex: number): number {
  const li = lunchIndex(meals);
  if (li === -1) return MORNING_SNACK; // no lunch that day → keep snack before dinner
  return mealIndex < li ? MORNING_SNACK : EVENING_SNACK;
}

/**
 * Decide ONE bucket per SHARED snack across the whole family, so a dish cooked once
 * and eaten together lands in the same place for every member who shares it. Shared
 * meals already carry the same canonical `recipe_name_ar` across members, so that's
 * the group key. Majority of sharers wins; a tie resolves to evening.
 */
function sharedSnackBuckets(familyDayMeals: Meal[][]): Map<string, number> {
  const tally = new Map<string, { morning: number; evening: number }>();
  for (const meals of familyDayMeals) {
    meals.forEach((m, i) => {
      if (m.slot !== "snack" || !m.shared_recipe) return;
      const key = m.recipe_name_ar.trim();
      const t = tally.get(key) ?? { morning: 0, evening: 0 };
      if (snackBucketFor(meals, i) === MORNING_SNACK) t.morning += 1;
      else t.evening += 1;
      tally.set(key, t);
    });
  }
  const out = new Map<string, number>();
  for (const [key, t] of tally) {
    out.set(key, t.morning > t.evening ? MORNING_SNACK : EVENING_SNACK);
  }
  return out;
}

function bucketOf(
  meal: Meal,
  meals: Meal[],
  mealIndex: number,
  sharedBuckets: Map<string, number>,
): number {
  switch (meal.slot) {
    case "breakfast":
      return BREAKFAST;
    case "lunch":
      return LUNCH;
    case "dinner":
      return DINNER;
    case "snack": {
      if (meal.shared_recipe) {
        const b = sharedBuckets.get(meal.recipe_name_ar.trim());
        if (b != null) return b;
      }
      return snackBucketFor(meals, mealIndex);
    }
    default:
      return OTHER;
  }
}

/**
 * Order one member's meals for a day into the canonical daily sequence:
 * breakfast → morning snack → lunch → evening snack → dinner.
 *
 * `familyDayMeals` is every member's meals for the SAME day, so a shared snack is
 * bucketed once for the whole family and sits in the same position for everyone who
 * shares it (without it, callers that only know one member degrade to per-member
 * ordering, which is still internally consistent). Stable: meals in the same bucket
 * keep their original order. Pure — returns reordered references, never mutates.
 */
export function orderDayMeals(
  memberMeals: Meal[],
  familyDayMeals: Meal[][] = [memberMeals],
): Meal[] {
  const sharedBuckets = sharedSnackBuckets(familyDayMeals);
  return memberMeals
    .map((meal, i) => ({ meal, i, order: bucketOf(meal, memberMeals, i, sharedBuckets) }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((x) => x.meal);
}
