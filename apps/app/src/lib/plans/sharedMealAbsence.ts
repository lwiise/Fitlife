import type { Ingredient, PerMemberPortion } from "@fitlife/plan-engine";

/**
 * Deterministic shared-meal adjustment for absent members (owner directive
 * 07/2026): when someone is not part of a shared meal, the dish is NEVER
 * changed or regenerated — only its batch quantities are scaled down to the
 * remaining sharers. Pure display math over `per_member_portions`; the stored
 * plan JSON is untouched, so restoring the member restores the original
 * numbers exactly.
 */

/**
 * The fraction of the batch that still gets cooked when `absentIds` sit out.
 *
 * Preference order mirrors how reliable each signal is in the plan JSON:
 *  1. portion_percentage (the engine's own split of the batch, sums to ~100)
 *  2. portion_grams (share of the finished batch weight)
 *  3. headcount (equal shares — the honest fallback when portions carry no
 *     numbers at all)
 * A signal is only used when EVERY portion carries it — a mixed list would
 * misattribute the missing member's share.
 *
 * Returns 1 when nobody is absent, and never returns 0 (a meal with no one
 * present isn't scaled — the UI prevents removing the last member; if data
 * ever says "everyone absent", showing the original recipe is the safe lie).
 */
export function absenceScaleFactor(
  portions: PerMemberPortion[],
  absentIds: ReadonlySet<string>,
): number {
  if (portions.length === 0) return 1;
  const present = portions.filter((p) => !absentIds.has(p.member_id));
  if (present.length === portions.length) return 1;
  if (present.length === 0) return 1;

  const byPercentage = portions.every(
    (p) => typeof p.portion_percentage === "number" && p.portion_percentage > 0,
  );
  if (byPercentage) {
    const total = portions.reduce((s, p) => s + p.portion_percentage!, 0);
    const kept = present.reduce((s, p) => s + p.portion_percentage!, 0);
    return total > 0 ? kept / total : present.length / portions.length;
  }

  const byGrams = portions.every(
    (p) => typeof p.portion_grams === "number" && p.portion_grams > 0,
  );
  if (byGrams) {
    const total = portions.reduce((s, p) => s + p.portion_grams!, 0);
    const kept = present.reduce((s, p) => s + p.portion_grams!, 0);
    return total > 0 ? kept / total : present.length / portions.length;
  }

  return present.length / portions.length;
}

/** Kitchen-sensible rounding per unit: whole grams/ml (one decimal under 10),
 * two decimals for kg/l, quarter steps for spoons/cups/pieces/servings. */
export function roundAmountForUnit(value: number, unit: Ingredient["unit"]): number {
  if (unit === "g" || unit === "ml") {
    return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  }
  if (unit === "kg" || unit === "l") {
    return Math.round(value * 100) / 100;
  }
  // tbsp / tsp / cup / piece / serving — quarter steps read naturally in a
  // recipe («٣/٤ كوب»), and a scaled-down amount never rounds to zero.
  const quarter = Math.round(value * 4) / 4;
  return quarter > 0 ? quarter : 0.25;
}

/**
 * Scale a batch ingredient list by `factor` (unit-aware rounding; "unlimited"
 * amounts pass through untouched). factor 1 returns the input array as-is so
 * the common no-absence render allocates nothing.
 */
export function scaleIngredients(
  ingredients: Ingredient[],
  factor: number,
): Ingredient[] {
  if (factor === 1) return ingredients;
  return ingredients.map((ing) => {
    if (ing.unit === "unlimited") return ing;
    const scaled: Ingredient = { ...ing };
    if (typeof ing.amount === "number") {
      scaled.amount = roundAmountForUnit(ing.amount * factor, ing.unit);
    }
    if (typeof ing.amount_min === "number") {
      scaled.amount_min = roundAmountForUnit(ing.amount_min * factor, ing.unit);
    }
    if (typeof ing.amount_max === "number") {
      scaled.amount_max = roundAmountForUnit(ing.amount_max * factor, ing.unit);
    }
    return scaled;
  });
}

/**
 * The adjusted finished-batch weight once absentees are excluded: the sum of
 * the PRESENT members' portion grams when every portion carries one (exact —
 * their servings are unchanged), otherwise the original weight scaled by
 * `factor`. Null in → null out.
 */
export function adjustedBatchWeight(
  batchWeightG: number | null | undefined,
  portions: PerMemberPortion[],
  absentIds: ReadonlySet<string>,
  factor: number,
): number | null {
  if (batchWeightG == null) return null;
  const present = portions.filter((p) => !absentIds.has(p.member_id));
  if (present.length === portions.length) return batchWeightG;
  if (
    portions.length > 0 &&
    portions.every((p) => typeof p.portion_grams === "number" && p.portion_grams > 0)
  ) {
    return Math.round(present.reduce((s, p) => s + p.portion_grams!, 0));
  }
  return Math.round(batchWeightG * factor);
}
