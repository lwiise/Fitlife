// Derives the canonical 5-level activity_level (the value the calorie
// methodology multiplies BMR by — Saudi MOH scale: خامل ×1.2، نشاط خفيف ×1.375،
// متوسط ×1.55، عالي ×1.725، مجهد ×1.9) from Coach Sara's two concrete
// questions: طبيعة اليوم and أيام الرياضة. Asking the abstract level directly
// made users guess and left the multiplier match to AI inference; deriving it
// keeps the equation deterministic. Raw answers are stored alongside the
// derived level. Pure; shared by the wizards, edit forms, and server actions.

export type DayNature = "desk" | "moderate_movement" | "physical_work";
export type ExerciseDays = "none" | "d1_2" | "d3_5" | "d6_plus";
export type ExerciseType = "resistance" | "cardio" | "mixed";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

const DAY_SCORE: Record<DayNature, number> = {
  desk: 0,
  moderate_movement: 1,
  physical_work: 2,
};

const EXERCISE_SCORE: Record<ExerciseDays, number> = {
  none: 0,
  d1_2: 1,
  d3_5: 2,
  d6_plus: 3,
};

const LEVEL_BY_SCORE: ActivityLevel[] = [
  "sedentary", // 0
  "light", // 1
  "moderate", // 2
  "active", // 3
  "very_active", // 4+
];

/**
 * Full mapping (rows = طبيعة اليوم, columns = أيام الرياضة):
 *
 * |                  | لا أمارس   | 1-2 أيام  | 3-5 أيام    | 6+ أيام     |
 * | مكتبي/جلوس       | sedentary  | light     | moderate    | active      |
 * | حركة متوسطة      | light      | moderate  | active      | very_active |
 * | عمل بدني         | moderate   | active    | very_active | very_active |
 *
 * ×1.2 / ×1.375 / ×1.55 / ×1.725 / ×1.9 — matches the MOH descriptors
 * (خامل، نشاط خفيف 1-3 أيام، متوسط 3-5، عالي 6-7، مجهد للغاية) and the
 * multipliers already written into SARA_METHODOLOGY (untouched, cached).
 *
 * exerciseType intentionally does NOT shift the level — it flavors the plan
 * (protein timing for resistance, carbs for cardio) and feeds the future
 * workout feature; accepted as an optional arg to keep the signature stable.
 */
export function activityLevelFrom(
  dayNature: DayNature,
  exerciseDays: ExerciseDays,
  _exerciseType?: ExerciseType | null,
): ActivityLevel {
  const score = DAY_SCORE[dayNature] + EXERCISE_SCORE[exerciseDays];
  return LEVEL_BY_SCORE[Math.min(score, LEVEL_BY_SCORE.length - 1)]!;
}

// ── Option constants (فصحى) — single source for all forms ──────────────────

export const DAY_NATURE_OPTIONS: Array<{
  value: DayNature;
  label: string;
  sublabel: string;
}> = [
  { value: "desk", label: "مكتبية", sublabel: "جلوس معظم اليوم" },
  { value: "moderate_movement", label: "حركة متوسطة", sublabel: "وقوف وتنقّل خلال اليوم" },
  { value: "physical_work", label: "عمل بدني", sublabel: "مجهود جسدي معظم اليوم" },
];

export const EXERCISE_DAYS_OPTIONS: Array<{
  value: ExerciseDays;
  label: string;
}> = [
  { value: "none", label: "لا أمارس الرياضة" },
  { value: "d1_2", label: "يوم إلى يومين أسبوعياً" },
  { value: "d3_5", label: "ثلاثة إلى خمسة أيام أسبوعياً" },
  { value: "d6_plus", label: "ستة أيام أو أكثر" },
];

export const EXERCISE_TYPE_OPTIONS: Array<{
  value: ExerciseType;
  label: string;
}> = [
  { value: "resistance", label: "مقاومة" },
  { value: "cardio", label: "كارديو" },
  { value: "mixed", label: "مختلط" },
];

/** MOH-aligned display labels for the derived level (UI + prompt parity). */
export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: "خامل (كثير الجلوس)",
  light: "نشاط خفيف (1-3 أيام أسبوعياً)",
  moderate: "نشاط متوسط (3-5 أيام أسبوعياً)",
  active: "نشاط عالي (6-7 أيام أسبوعياً)",
  very_active: "نشاط عالي جداً (تدريب مكثف أو عمل بدني)",
};
