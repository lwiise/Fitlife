// Scoped-regeneration domain logic (pure, Date-free, model-free). Two orthogonal
// axes exist: `regenScope` (individual|shared|both) is the MEAL-AREA axis — whose
// dishes — and predates this. `RegenDomain` (meals|exercise|both) is the DOMAIN
// axis — meals vs the workout. They never overload one another.
//
// Product rule (locked): an "exercise only" regen AUTO-PROMOTES to "both" whenever
// the edit moved the energy math (a changed calorie target or clearance state makes
// the existing meals stale). True exercise-only runs only when the budget is
// unchanged. The promotion authority lives in dispatch; this module owns the rule.

import type { EnergyBudget } from "./schema";

export type RegenDomain = "meals" | "exercise" | "both";

/**
 * Did an exercise-profile edit move the MEAL math? Meals depend only on the calorie
 * target and on whether exercise is withheld (clearance) — so we compare exactly
 * those two outputs of `computeEnergyBudget`, not the whole budget.
 *
 * - `target_intake` captures every energy-relevant input (availability, session
 *   minutes, top preferred type → per-modality MET, intensity ceiling, goal). It's
 *   rounded to an integer in the engine, so an exact `!==` is float-safe.
 * - `clearance_required` flips meals indirectly: a withheld member loses her workout,
 *   but the meal plan itself is unaffected; we still treat a clearance change as a
 *   reason to refresh so the plan view and any downstream coupling stay consistent.
 * - `intensity_mode` (hr_zones ↔ rpe) never enters the energy math → correctly false.
 * - Children carry `target_intake: null` (portion-based) and never get a workout, so
 *   `null !== null` is false → they never trigger a promotion.
 */
export function mealBudgetChanged(prev: EnergyBudget, next: EnergyBudget): boolean {
  return (
    prev.target_intake !== next.target_intake ||
    prev.clearance_required !== next.clearance_required
  );
}

/**
 * Resolve the effective regeneration domain, applying the auto-promote rule.
 * `exercise` + a changed budget → `both` (with `promoted: true` so the UI can show
 * the one-line note); every other case passes the request through unchanged.
 */
export function resolveRegenDomain(
  requested: RegenDomain,
  budgetChanged: boolean,
): { domain: RegenDomain; promoted: boolean } {
  if (requested === "exercise" && budgetChanged) {
    return { domain: "both", promoted: true };
  }
  return { domain: requested, promoted: false };
}
