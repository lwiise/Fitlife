/**
 * Absolute lower bound on a member's daily calorie target.
 *
 * This is a SAFETY BACKSTOP, not a prescription. It exists because a live QA
 * run produced a 630 kcal/day plan for a 15-year-old account owner: the engine
 * had correctly identified her as a minor and correctly refused to apply adult
 * BMR/TDEE equations, but nothing downstream checked that the resulting number
 * was survivable. Whatever path computes a target — adult equations, the child
 * pyramid-serving path, a model hallucination, or a future one — it now has to
 * clear this floor or be raised to it.
 *
 * Floors follow conventional clinical guidance for UNSUPERVISED intake:
 *   - adult women            1200 kcal
 *   - adult men              1500 kcal
 *   - anyone under 18        1600 kcal (growth; restriction needs supervision)
 * Pregnancy and lactation raise requirements well above these, so the adult
 * floors stay correct (never binding) for those members.
 *
 * The floor is deliberately BELOW every legitimate target the product produces,
 * so in normal operation it never fires. If it fires, something upstream is
 * wrong and the log line is the signal.
 */

export const ADULT_FEMALE_CALORIE_FLOOR = 1200;
export const ADULT_MALE_CALORIE_FLOOR = 1500;
export const MINOR_CALORIE_FLOOR = 1600;

export interface CalorieFloorSubject {
  /** true when the member is a child/adolescent by member_type or age. */
  is_child?: boolean;
  age?: number | null;
  sex?: string | null;
}

/** The minimum daily calories this member may be planned for. Pure. */
export function minimumDailyCalories(subject: CalorieFloorSubject): number {
  const isMinor = subject.is_child === true || (subject.age != null && subject.age < 18);
  if (isMinor) return MINOR_CALORIE_FLOOR;
  return subject.sex === "male" ? ADULT_MALE_CALORIE_FLOOR : ADULT_FEMALE_CALORIE_FLOOR;
}

export interface FlooredTarget {
  daily_calories_target: number;
  macros_target: { protein_g: number; carbs_g: number; fat_g: number };
  /** Set only when the floor actually raised the target. */
  raisedFrom?: number;
}

/**
 * Clamp a target up to the floor, scaling macros by the SAME factor so the
 * split stays internally coherent — raising calories while leaving macros
 * untouched would ship a day whose macros no longer sum to its own total.
 */
export function applyCalorieFloor(
  target: { daily_calories_target: number; macros_target: { protein_g: number; carbs_g: number; fat_g: number } },
  subject: CalorieFloorSubject,
): FlooredTarget {
  const floor = minimumDailyCalories(subject);
  const current = target.daily_calories_target;
  if (!Number.isFinite(current) || current <= 0) {
    // No usable target at all — hand back the floor with a proportionate split
    // rather than propagating a zero that would silently produce empty days.
    return {
      daily_calories_target: floor,
      macros_target: {
        protein_g: Math.round((floor * 0.3) / 4),
        carbs_g: Math.round((floor * 0.45) / 4),
        fat_g: Math.round((floor * 0.25) / 9),
      },
      raisedFrom: current,
    };
  }
  if (current >= floor) {
    return { daily_calories_target: current, macros_target: target.macros_target };
  }
  const factor = floor / current;
  return {
    daily_calories_target: floor,
    macros_target: {
      protein_g: Math.round(target.macros_target.protein_g * factor),
      carbs_g: Math.round(target.macros_target.carbs_g * factor),
      fat_g: Math.round(target.macros_target.fat_g * factor),
    },
    raisedFrom: current,
  };
}
