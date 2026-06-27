// Opt-in exercise feature — Phase 1 data shapes. Persisted as the `exercise_profile`
// jsonb blob on profiles (mom) and family_members (everyone else); see migration
// 00012. A later phase normalizes this into typed columns + reads it in the plan
// engine. Pure types — safe to import from client wizards and server actions.

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

// §4 computed safety verdict — derived, never asked. See computeExerciseScreening.
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
  msk_notes?: string | null; // prior surgeries / limited range of motion
  availability_days?: AvailabilityDays | null;
  session_minutes?: SessionMinutes | null;
  preferred_types?: ExerciseType[];
  disliked_types?: ExerciseType[];
  setting?: ExerciseSetting | null;
  equipment?: Equipment[];
  hr_meds?: boolean | null; // beta-blockers / rate-limiting BP-cardiac meds
  resting_hr?: number | null;
  symptoms?: string[]; // ACSM Table 2.1 slugs; empty = "ولا واحد منهم" (cleared)
  // Lactating-only refinements (safe postpartum loading).
  delivery_type?: DeliveryType | null;
  pelvic_floor_issues?: boolean | null;
  // Child-only context.
  child_activities?: string | null;
  // Computed safety verdict (null for child).
  screening?: ExerciseScreening | null;
}
