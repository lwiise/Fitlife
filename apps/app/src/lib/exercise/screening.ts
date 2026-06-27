// §4 screening — resolves the appended exercise answers + reused meal-wizard fields
// into three safety values the (future) plan skeleton consumes. Pure: the caller
// passes `age` (computed from birth_year) so this stays Date-free and unit-testable.
// Grounded in ACSM Guidelines for Exercise Testing and Prescription (11th ed., Ch. 2).

import { hasGateCondition } from "@/lib/plans/medicalConditions";
import { RPE_AGE_THRESHOLD } from "./constants";
import type { ExerciseScreening } from "./types";

export interface ScreeningInput {
  member_type: "adult" | "child" | "pregnant" | "lactating";
  age: number;
  activity_level: string | null | undefined;
  conditions: string[];
  hr_meds?: boolean | null;
  resting_hr?: number | null;
  symptoms?: string[]; // empty / ["none"] selection = cleared
}

// Sedentary or lightly-active members start conservatively (ACSM's ~2–3 month
// progressive transitional phase) — never straight to vigorous.
const LOW_ACTIVITY = new Set(["sedentary", "light"]);

export function computeExerciseScreening(input: ScreeningInput): ExerciseScreening {
  const { member_type, age, activity_level, conditions, hr_meds, resting_hr } = input;
  const symptoms = (input.symptoms ?? []).filter((s) => s && s !== "none");

  const isPregLact = member_type === "pregnant" || member_type === "lactating";
  const hasSymptom = symptoms.length > 0;

  // Pregnant/postpartum and any gate condition or symptom require clearance — we
  // reuse the existing doctor-consult step as the clearance mechanism.
  const clearance_required =
    hasGateCondition(conditions) || hasSymptom || isPregLact;

  const lowActivity = LOW_ACTIVITY.has(activity_level ?? "");

  // Vigorous only for the asymptomatic, already-active, no-clearance case.
  const intensity_ceiling: ExerciseScreening["intensity_ceiling"] =
    clearance_required || lowActivity ? "light_moderate" : "can_progress_to_vigorous";

  // Rate-limiting meds invalidate %HRmax targets; so does an unknown resting HR at
  // higher ages. Either → prescribe by RPE.
  const intensity_mode: ExerciseScreening["intensity_mode"] =
    hr_meds === true || (resting_hr == null && age >= RPE_AGE_THRESHOLD)
      ? "rpe"
      : "hr_zones";

  return { intensity_ceiling, clearance_required, intensity_mode };
}
