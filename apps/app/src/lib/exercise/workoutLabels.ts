// Arabic labels for the GENERATED workout plan (distinct from the onboarding
// option lists in constants.ts). WorkoutSession.exercise_type uses the richer
// 13-value `Modality` vocabulary (MET-table keyed), not the 4 onboarding
// `ExerciseType`s — so it needs its own label map. Draft Gulf Arabic: run the
// arabic-copy-checker before ship.

import type { IntensityBand, Modality } from "@fitlife/plan-engine";

export const MODALITY_LABEL_AR: Record<Modality, string> = {
  walking: "مشي",
  cycling: "ركوب الدراجة",
  swimming: "سباحة",
  aquafit: "تمارين مائية",
  low_impact_aerobics: "أيروبيك خفيف",
  high_impact_aerobics: "أيروبيك مكثّف",
  dance: "تمارين إيقاعية",
  calisthenics: "تمارين الجسم",
  resistance: "تمارين مقاومة",
  yoga: "يوغا",
  pilates: "بيلاتس",
  mobility: "تمارين مرونة",
  step: "ستيب إيروبيك",
};

export const BAND_LABEL_AR: Record<IntensityBand, string> = {
  light: "خفيف",
  moderate: "متوسط",
  vigorous: "قوي",
};

// Band → accent treatment, reusing the meal-card pill palette for visual continuity.
export const BAND_STYLE: Record<IntensityBand, { bg: string; text: string }> = {
  light: { bg: "bg-brand-lavender/40", text: "text-brand-purple-900" },
  moderate: { bg: "bg-brand-yellow/25", text: "text-brand-ink" },
  vigorous: { bg: "bg-brand-pink-light", text: "text-brand-ink" },
};
