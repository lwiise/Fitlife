// Canonical exercise types now live in @fitlife/plan-engine (Phase 2 centralization)
// so the plan engine can read the persisted `exercise_profile` jsonb with types.
// Re-exported here so existing app imports (`@/lib/exercise/types`) keep working
// unchanged — this is a pure type re-export (erased at build, no runtime import).
export type {
  ExerciseFocus,
  ExerciseSetting,
  Equipment,
  ExerciseType,
  MskRegion,
  AvailabilityDays,
  SessionMinutes,
  DeliveryType,
  IntensityCeiling,
  IntensityMode,
  ExerciseScreening,
  ExerciseProfile,
} from "@fitlife/plan-engine";
