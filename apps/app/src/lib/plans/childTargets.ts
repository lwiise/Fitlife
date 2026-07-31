import {
  reconcileChildTargets,
  isChildByBirthYear,
  type MealPlan,
} from "@fitlife/plan-engine";

/**
 * The engine's child rule (plan-engine/childRule), applied at READ time so the
 * display path classifies people exactly as generation did — previously a
 * hand-kept mirror of it.
 */
const isChildMember = isChildByBirthYear;

/**
 * Present each CHILD member's calorie/macro figures as the average of their real
 * days, not the skeleton's throwaway estimate — the same reconciliation the engine
 * now applies at write time, re-applied at READ so plans generated before the fix
 * (whose stored header still carries the bogus estimate, e.g. 2730 kcal against
 * ~1000-kcal portion days) also display consistently, without a regenerate. Adults
 * are returned by reference; the operation is idempotent for already-reconciled
 * plans (recomputing the mean of unchanged day totals yields the same number).
 */
export function applyChildDisplayTargets(
  plan: MealPlan,
  roster: {
    mom: { member_type?: string | null; birth_year?: number | null };
    members: Array<{ id: string; member_type?: string | null; birth_year?: number | null }>;
  },
): MealPlan {
  const childById = new Map<string, boolean>();
  childById.set("mom", isChildMember(roster.mom.member_type, roster.mom.birth_year));
  for (const m of roster.members)
    childById.set(m.id, isChildMember(m.member_type, m.birth_year));

  let changed = false;
  const members = plan.members.map((m) => {
    if (!(childById.get(m.member_id) ?? m.is_child ?? false)) return m;
    const display = reconcileChildTargets(m.days, {
      daily_calories_target: m.daily_calories_target,
      macros_target: m.macros_target,
    });
    if (
      m.is_child === true &&
      m.daily_calories_target === display.daily_calories_target &&
      m.macros_target.protein_g === display.macros_target.protein_g &&
      m.macros_target.carbs_g === display.macros_target.carbs_g &&
      m.macros_target.fat_g === display.macros_target.fat_g
    ) {
      return m; // already reconciled by the engine — leave untouched
    }
    changed = true;
    return {
      ...m,
      is_child: true,
      daily_calories_target: display.daily_calories_target,
      macros_target: display.macros_target,
    };
  });
  return changed ? { ...plan, members } : plan;
}
