// Canonical exercise types (Phase 2 centralization). These were authored app-side
// in Phase 1 (apps/app/src/lib/exercise/types.ts); they now live in the engine so
// the plan engine can read the persisted `exercise_profile` jsonb with types, and
// the app re-exports them so Phase-1 imports keep working unchanged. Pure types,
// no deps — safe to import from client wizards, server actions, and the engine.

export type ExerciseFocus = "strength" | "mobility" | "endurance" | "general";
export type ExerciseSetting = "home" | "gym" | "outdoor";
export type Equipment = "none" | "weights" | "bands" | "treadmill";
export type ExerciseType = "walking" | "strength" | "yoga_pilates" | "cardio";
export type MskRegion =
  | "back"
  | "knee"
  | "shoulder"
  | "neck"
  | "hip"
  | "wrist"
  | "ankle";
export type AvailabilityDays = "1-2" | "3-4" | "5+";
export type SessionMinutes = 15 | 30 | 45; // 45 = "45+"
export type DeliveryType = "vaginal" | "c_section";

// Computed safety verdict — derived in Phase-1 screening, persisted in the jsonb.
export type IntensityCeiling = "light_moderate" | "can_progress_to_vigorous";
export type IntensityMode = "hr_zones" | "rpe";

export interface ExerciseScreening {
  intensity_ceiling: IntensityCeiling;
  clearance_required: boolean;
  intensity_mode: IntensityMode;
}

// Stored only when a member opts in. Meals-only members keep exercise_profile NULL.
// Adult/mom/pregnant/lactating carry the prescription inputs + a `screening`
// verdict; children store ONLY `child_activities` (context, no load prescription,
// no screening — never prescribe intensity/load to a child).
export interface ExerciseProfile {
  focus?: ExerciseFocus | null;
  msk_regions?: MskRegion[];
  msk_notes?: string | null;
  availability_days?: AvailabilityDays | null;
  session_minutes?: SessionMinutes | null;
  preferred_types?: ExerciseType[];
  disliked_types?: ExerciseType[];
  setting?: ExerciseSetting | null;
  equipment?: Equipment[];
  hr_meds?: boolean | null;
  resting_hr?: number | null;
  symptoms?: string[];
  delivery_type?: DeliveryType | null;
  pelvic_floor_issues?: boolean | null;
  child_activities?: string | null;
  screening?: ExerciseScreening | null;
}

// ─── Phase 2 energy/intensity inputs ─────────────────────────────────────

export type MemberType = "adult" | "child" | "pregnant" | "lactating";

// FITT intensity band used to key the MET table + map HR zones / RPE.
export type IntensityBand = "light" | "moderate" | "vigorous";

// The richer modality vocabulary the MET table is keyed by (Compendium of Physical
// Activities). Distinct from ExerciseType — that's the 4 onboarding preferences; a
// member's preferred ExerciseType maps to a representative Modality for budgeting.
export const MODALITIES = [
  "walking",
  "cycling",
  "swimming",
  "aquafit",
  "low_impact_aerobics",
  "high_impact_aerobics",
  "dance",
  "calisthenics",
  "resistance",
  "yoga",
  "pilates",
  "mobility",
  "step",
] as const;
export type Modality = (typeof MODALITIES)[number];

// The reused meal-profile fields computeEnergyBudget needs. Pure input (no DB row
// type) so the function stays unit-testable; `age` is precomputed (Date-free).
export interface EnergyBudgetMember {
  member_type: MemberType;
  sex: "male" | "female" | null;
  age: number;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null; // sedentary | light | moderate | active | very_active
  primary_goal: string | null; // Sara goal slug (fat_loss, muscle_gain, …)
  trimester?: number | null; // pregnant → increment
  months_postpartum?: number | null; // lactating → increment
}
