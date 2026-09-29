import type { Meal, MemberPlan } from "@fitlife/plan-engine";
import { orderDayMeals } from "./mealOrder";

/**
 * One day's dishes for the WHOLE household, as a cook reads them — the /plan
 * bar's «الوصفات» sheet (09/2026). Pure, so the dedupe is testable.
 *
 * A shared dish is one pot: it lives in every sharer's day, so it is listed
 * ONCE (keyed slot + recipe name, the same identity orderDayMeals groups shared
 * snacks by). An individual dish is its own plate and always listed, even when
 * two people happen to have the same recipe — two plates are two plates.
 *
 * Ordered by the time of day (breakfast → morning snack → lunch → evening snack
 * → dinner), then roster order, so the sheet reads like the kitchen's day rather
 * than one person's column after another.
 */
export interface HouseholdDish {
  meal: Meal;
  /** Whose day the dish was found on first — the eater of an individual dish,
   * the first sharer (in roster order) of a shared one. */
  memberId: string;
  /** The pot's sharers, or null for an individual dish. */
  sharerIds: string[] | null;
}

// The canonical buckets of mealOrder.ts. A snack's bucket is read back from
// where orderDayMeals put it (before this member's lunch = morning), so a
// shared snack lands in the family-wide position that module already decided.
const SLOT_BUCKET: Partial<Record<Meal["slot"], number>> = {
  breakfast: 0,
  lunch: 2,
  dinner: 4,
};
const MORNING_SNACK = 1;
const EVENING_SNACK = 3;
const OTHER = 5;

function bucketsOf(ordered: Meal[]): number[] {
  const lunch = ordered.findIndex((m) => m.slot === "lunch");
  return ordered.map((m, i) =>
    m.slot === "snack"
      ? lunch === -1 || i < lunch
        ? MORNING_SNACK
        : EVENING_SNACK
      : (SLOT_BUCKET[m.slot] ?? OTHER),
  );
}

export function sharedDishKey(meal: Pick<Meal, "slot" | "recipe_name_ar">): string {
  return `${meal.slot}|${meal.recipe_name_ar.trim()}`;
}

export function householdDayDishes(
  members: ReadonlyArray<Pick<MemberPlan, "member_id" | "days">>,
  dayIndex: number,
): HouseholdDish[] {
  const familyDay = members.map(
    (m) => m.days.find((d) => d.day_index === dayIndex)?.meals ?? [],
  );
  const seenShared = new Set<string>();
  const found: Array<HouseholdDish & { bucket: number }> = [];

  members.forEach((member, mi) => {
    const ordered = orderDayMeals(familyDay[mi] ?? [], familyDay);
    const buckets = bucketsOf(ordered);
    ordered.forEach((meal, i) => {
      const shared = meal.shared_recipe === true;
      if (shared) {
        const key = sharedDishKey(meal);
        if (seenShared.has(key)) return;
        seenShared.add(key);
      }
      found.push({
        meal,
        memberId: member.member_id,
        sharerIds:
          shared && meal.per_member_portions?.length
            ? meal.per_member_portions.map((p) => p.member_id)
            : null,
        bucket: buckets[i] ?? OTHER,
      });
    });
  });

  // Array.prototype.sort is stable, so within a bucket the roster order (and
  // each member's own order) is kept.
  return found
    .sort((a, b) => a.bucket - b.bucket)
    .map(({ meal, memberId, sharerIds }) => ({ meal, memberId, sharerIds }));
}
