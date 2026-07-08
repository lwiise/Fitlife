/**
 * Approved exercise catalog — the fixed list the AI must pick from so every
 * exercise in a generated program maps to a bundled Lottie form animation
 * (apps/app/public/lottie/exercises/<id>.json, files named by these ids).
 *
 * The catalog constrains `exercise_id` ONLY: the model still writes its own
 * name_ar/notes_ar phrasing, sets/reps/RIR per the methodology. Unknown ids
 * survive validation (nulled + logged) so a drifting model never fails a run.
 *
 * pregnancy_safe here is a UI/animation-level flag (conservative), NOT the
 * medical source of truth — WORKOUT_METHODOLOGY's pregnancy rules govern what
 * the model actually programs.
 */

export type ExercisePattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "push"
  | "pull"
  | "core"
  | "isolation"
  | "mobility"
  | "stretch"
  | "cardio";

export interface CatalogExercise {
  id: string;
  name_ar: string;
  name_en: string;
  target_muscles_ar: string;
  pattern: ExercisePattern;
  /** Gear needed; empty = bodyweight only. */
  equipment: Array<"dumbbell" | "band" | "bench" | "machine" | "barbell" | "wall" | "box">;
  home_ok: boolean;
  pregnancy_safe: boolean;
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // ── Squat / legs ──────────────────────────────────────────────────────────
  { id: "squat", name_ar: "سكوات بوزن الجسم", name_en: "Bodyweight Squat", target_muscles_ar: "الفخذان والمؤخرة", pattern: "squat", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "goblet_squat", name_ar: "سكوات جوبلت بالدمبل", name_en: "Goblet Squat", target_muscles_ar: "الفخذان والمؤخرة", pattern: "squat", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "wall_sit", name_ar: "الجلوس على الحائط", name_en: "Wall Sit", target_muscles_ar: "الفخذان", pattern: "squat", equipment: ["wall"], home_ok: true, pregnancy_safe: false },
  { id: "leg_press", name_ar: "دفع الأرجل بالجهاز", name_en: "Leg Press", target_muscles_ar: "الفخذان والمؤخرة", pattern: "squat", equipment: ["machine"], home_ok: false, pregnancy_safe: false },
  { id: "split_squat", name_ar: "سكوات سبليت", name_en: "Split Squat", target_muscles_ar: "الفخذان والمؤخرة مع التوازن", pattern: "lunge", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "lunge", name_ar: "الطعنات الأمامية", name_en: "Forward Lunge", target_muscles_ar: "الفخذان والمؤخرة مع التوازن", pattern: "lunge", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "step_up", name_ar: "الصعود على الدرجة", name_en: "Step-up", target_muscles_ar: "الفخذان والمؤخرة", pattern: "lunge", equipment: ["box"], home_ok: true, pregnancy_safe: true },
  { id: "romanian_deadlift", name_ar: "الرفعة الرومانية بالدمبل", name_en: "Romanian Deadlift", target_muscles_ar: "أوتار الفخذ والمؤخرة", pattern: "hinge", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "glute_bridge", name_ar: "جسر المؤخرة", name_en: "Glute Bridge", target_muscles_ar: "المؤخرة وأوتار الفخذ", pattern: "hinge", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "hip_thrust", name_ar: "دفع الورك على المقعد", name_en: "Hip Thrust", target_muscles_ar: "المؤخرة", pattern: "hinge", equipment: ["bench"], home_ok: true, pregnancy_safe: false },
  { id: "leg_extension", name_ar: "مد الأرجل بالجهاز", name_en: "Leg Extension", target_muscles_ar: "الفخذ الأمامي", pattern: "isolation", equipment: ["machine"], home_ok: false, pregnancy_safe: true },
  { id: "leg_curl", name_ar: "ثني الأرجل بالجهاز", name_en: "Leg Curl", target_muscles_ar: "أوتار الفخذ", pattern: "isolation", equipment: ["machine"], home_ok: false, pregnancy_safe: true },
  { id: "calf_raise", name_ar: "رفعات السمانة واقفة", name_en: "Standing Calf Raise", target_muscles_ar: "السمانة", pattern: "isolation", equipment: [], home_ok: true, pregnancy_safe: true },

  // ── Push ──────────────────────────────────────────────────────────────────
  { id: "pushup", name_ar: "تمرين الضغط", name_en: "Push-up", target_muscles_ar: "الصدر والترايسبس", pattern: "push", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "knee_pushup", name_ar: "الضغط على الركبتين", name_en: "Knee Push-up", target_muscles_ar: "الصدر والترايسبس", pattern: "push", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "wall_pushup", name_ar: "الضغط على الحائط", name_en: "Wall Push-up", target_muscles_ar: "الصدر والترايسبس", pattern: "push", equipment: ["wall"], home_ok: true, pregnancy_safe: true },
  { id: "db_bench_press", name_ar: "ضغط الصدر بالدمبل", name_en: "Dumbbell Bench Press", target_muscles_ar: "الصدر والترايسبس", pattern: "push", equipment: ["dumbbell", "bench"], home_ok: true, pregnancy_safe: false },
  { id: "barbell_bench_press", name_ar: "ضغط الصدر بالبار", name_en: "Barbell Bench Press", target_muscles_ar: "الصدر والترايسبس", pattern: "push", equipment: ["barbell", "bench"], home_ok: false, pregnancy_safe: false },
  { id: "overhead_press", name_ar: "ضغط الكتف بالدمبل واقفة", name_en: "Overhead Press", target_muscles_ar: "الكتفان والترايسبس", pattern: "push", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "lateral_raise", name_ar: "الرفرفة الجانبية", name_en: "Lateral Raise", target_muscles_ar: "الكتفان", pattern: "isolation", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "triceps_extension", name_ar: "مد الترايسبس فوق الرأس", name_en: "Overhead Triceps Extension", target_muscles_ar: "الترايسبس", pattern: "isolation", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "triceps_pushdown", name_ar: "دفع الترايسبس بالكابل", name_en: "Triceps Pushdown", target_muscles_ar: "الترايسبس", pattern: "isolation", equipment: ["machine"], home_ok: false, pregnancy_safe: true },
  { id: "bench_dips", name_ar: "الغطس على المقعد", name_en: "Bench Dips", target_muscles_ar: "الترايسبس والصدر", pattern: "push", equipment: ["bench"], home_ok: true, pregnancy_safe: false },

  // ── Pull ──────────────────────────────────────────────────────────────────
  { id: "one_arm_db_row", name_ar: "التجديف بالدمبل بذراع واحدة", name_en: "One-arm Dumbbell Row", target_muscles_ar: "الظهر والبايسبس", pattern: "pull", equipment: ["dumbbell", "bench"], home_ok: true, pregnancy_safe: true },
  { id: "bent_over_row", name_ar: "التجديف بالانحناء بالدمبل", name_en: "Bent-over Row", target_muscles_ar: "الظهر والبايسبس", pattern: "pull", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "seated_cable_row", name_ar: "التجديف بالكابل جالسة", name_en: "Seated Cable Row", target_muscles_ar: "الظهر والبايسبس", pattern: "pull", equipment: ["machine"], home_ok: false, pregnancy_safe: true },
  { id: "lat_pulldown", name_ar: "السحب العلوي بالجهاز", name_en: "Lat Pulldown", target_muscles_ar: "الظهر العريض والبايسبس", pattern: "pull", equipment: ["machine"], home_ok: false, pregnancy_safe: true },
  { id: "assisted_pullup", name_ar: "العقلة بالمساعدة", name_en: "Assisted Pull-up", target_muscles_ar: "الظهر العريض والبايسبس", pattern: "pull", equipment: ["machine"], home_ok: false, pregnancy_safe: false },
  { id: "band_row", name_ar: "التجديف بحبل المقاومة", name_en: "Band Row", target_muscles_ar: "الظهر والبايسبس", pattern: "pull", equipment: ["band"], home_ok: true, pregnancy_safe: true },
  { id: "face_pull", name_ar: "السحب نحو الوجه", name_en: "Face Pull", target_muscles_ar: "الكتف الخلفي وأعلى الظهر", pattern: "pull", equipment: ["band"], home_ok: true, pregnancy_safe: true },
  { id: "rear_delt_fly", name_ar: "الرفرفة الخلفية بالانحناء", name_en: "Rear Delt Fly", target_muscles_ar: "الكتف الخلفي", pattern: "isolation", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "biceps_curl", name_ar: "ثني البايسبس", name_en: "Biceps Curl", target_muscles_ar: "البايسبس", pattern: "isolation", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },
  { id: "hammer_curl", name_ar: "ثني المطرقة", name_en: "Hammer Curl", target_muscles_ar: "البايسبس والساعد", pattern: "isolation", equipment: ["dumbbell"], home_ok: true, pregnancy_safe: true },

  // ── Core ──────────────────────────────────────────────────────────────────
  { id: "plank", name_ar: "بلانك على الساعدين", name_en: "Forearm Plank", target_muscles_ar: "عضلات الجذع", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "side_plank", name_ar: "البلانك الجانبي", name_en: "Side Plank", target_muscles_ar: "الجذع الجانبي", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "dead_bug", name_ar: "دِد بَق — تبديل الأطراف مستلقية", name_en: "Dead Bug", target_muscles_ar: "عضلات الجذع العميقة", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "bird_dog", name_ar: "بيرد دوق — التوازن الرباعي", name_en: "Bird Dog", target_muscles_ar: "الجذع وأسفل الظهر", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "crunch", name_ar: "الطحن (كرانش)", name_en: "Crunch", target_muscles_ar: "البطن", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "reverse_crunch", name_ar: "الطحن العكسي", name_en: "Reverse Crunch", target_muscles_ar: "أسفل البطن", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "leg_raises", name_ar: "رفع الأرجل مستلقية", name_en: "Lying Leg Raise", target_muscles_ar: "أسفل البطن ومثنية الورك", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: false },

  // ── Warm-up / mobility ───────────────────────────────────────────────────
  { id: "march_in_place", name_ar: "المشي في المكان", name_en: "March in Place", target_muscles_ar: "الجسم كاملاً — إحماء", pattern: "cardio", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "jumping_jacks", name_ar: "القفز الفراشي", name_en: "Jumping Jacks", target_muscles_ar: "الجسم كاملاً — إحماء", pattern: "cardio", equipment: [], home_ok: true, pregnancy_safe: false },
  { id: "arm_circles", name_ar: "دوائر الذراعين", name_en: "Arm Circles", target_muscles_ar: "الكتفان — إحماء", pattern: "mobility", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "cat_cow", name_ar: "القطة والجمل", name_en: "Cat-Cow", target_muscles_ar: "العمود الفقري — إحماء", pattern: "mobility", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "hip_circles", name_ar: "دوائر الورك", name_en: "Hip Circles", target_muscles_ar: "الورك — إحماء", pattern: "mobility", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "leg_swings", name_ar: "أرجحة الساق", name_en: "Leg Swings", target_muscles_ar: "الورك وأوتار الفخذ — إحماء", pattern: "mobility", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "band_pull_apart", name_ar: "فتح حبل المقاومة", name_en: "Band Pull-apart", target_muscles_ar: "أعلى الظهر — إحماء", pattern: "mobility", equipment: ["band"], home_ok: true, pregnancy_safe: true },

  // ── Cool-down stretches ──────────────────────────────────────────────────
  { id: "hamstring_stretch", name_ar: "إطالة أوتار الفخذ", name_en: "Hamstring Stretch", target_muscles_ar: "أوتار الفخذ", pattern: "stretch", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "quad_stretch", name_ar: "إطالة الفخذ الأمامي واقفة", name_en: "Standing Quad Stretch", target_muscles_ar: "الفخذ الأمامي", pattern: "stretch", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "chest_stretch", name_ar: "إطالة الصدر", name_en: "Chest Stretch", target_muscles_ar: "الصدر والكتف الأمامي", pattern: "stretch", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "child_pose", name_ar: "وضعية الطفل", name_en: "Child's Pose", target_muscles_ar: "الظهر والوركان", pattern: "stretch", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "hip_flexor_stretch", name_ar: "إطالة مثنية الورك", name_en: "Hip Flexor Stretch", target_muscles_ar: "مثنية الورك", pattern: "stretch", equipment: [], home_ok: true, pregnancy_safe: true },

  // ── Cardio ───────────────────────────────────────────────────────────────
  { id: "brisk_walk", name_ar: "المشي السريع", name_en: "Brisk Walk", target_muscles_ar: "القلب والأوعية", pattern: "cardio", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "incline_walk", name_ar: "المشي المائل على السير", name_en: "Incline Treadmill Walk", target_muscles_ar: "القلب والأرجل", pattern: "cardio", equipment: ["machine"], home_ok: false, pregnancy_safe: true },
  { id: "stationary_bike", name_ar: "الدراجة الثابتة", name_en: "Stationary Bike", target_muscles_ar: "القلب والأرجل", pattern: "cardio", equipment: ["machine"], home_ok: false, pregnancy_safe: true },

  // ── Pregnancy / postpartum specific ──────────────────────────────────────
  { id: "pelvic_tilt", name_ar: "إمالة الحوض واقفة", name_en: "Standing Pelvic Tilt", target_muscles_ar: "الحوض وأسفل الظهر", pattern: "mobility", equipment: [], home_ok: true, pregnancy_safe: true },
  { id: "kegel", name_ar: "تمارين قاع الحوض (كيقل)", name_en: "Pelvic Floor Exercise", target_muscles_ar: "قاع الحوض", pattern: "core", equipment: [], home_ok: true, pregnancy_safe: true },
];

export const EXERCISE_BY_ID: ReadonlyMap<string, CatalogExercise> = new Map(
  EXERCISE_CATALOG.map((e) => [e.id, e]),
);

/**
 * Representative animation per movement pattern — used by the viewer when an
 * exercise arrives with a pattern-consistent but unknown id (should be rare;
 * the prompt pins the catalog). Every value must be a catalog id.
 */
export const FALLBACK_BY_PATTERN: Readonly<Record<ExercisePattern, string>> = {
  squat: "squat",
  hinge: "romanian_deadlift",
  lunge: "lunge",
  push: "pushup",
  pull: "band_row",
  core: "plank",
  isolation: "biceps_curl",
  mobility: "arm_circles",
  stretch: "hamstring_stretch",
  cardio: "march_in_place",
};

/**
 * Compact roster block for the (cached) static system prompt: one line per
 * exercise so the model can pick `exercise_id` values exactly.
 */
export function exerciseCatalogPromptBlock(): string {
  const lines = EXERCISE_CATALOG.map((e) => {
    const gear = e.equipment.length > 0 ? e.equipment.join("+") : "بدون أدوات";
    const home = e.home_ok ? "منزل+نادٍ" : "نادٍ فقط";
    return `- ${e.id} — ${e.name_ar} (${gear}؛ ${home})`;
  });
  return `# كتالوج التمارين المعتمد (قيم exercise_id المسموحة حصراً)
اختاري لكل تمرين exercise_id من هذه القائمة فقط — الاسم والوصف يبقيان بصياغتك، لكن المعرّف يجب أن يطابق القائمة حرفياً. اختاري ما يناسب مكان التدريب وأدوات المتدربة وحالتها الصحية.
${lines.join("\n")}`;
}
