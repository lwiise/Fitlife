// Re-derive a STORED exercise profile's safety screening from the member's CURRENT
// health inputs. computeExerciseScreening runs only in the client wizard, so a later
// server-side health/personal edit (a new gating condition, a changed activity level,
// a corrected age) would otherwise leave the persisted clearance/intensity verdict
// stale — and generation (computeEnergyBudget / buildWorkoutsFromSkeleton) trusts that
// stored verdict. The exercise ANSWERS (hr_meds / resting_hr / symptoms) are unchanged
// by a health edit, so they're preserved from the profile; only the health-derived
// inputs are refreshed. Pure — no DB, Date-free (caller passes age).

import { computeExerciseScreening } from "./screening";
import type { ExerciseProfile } from "./types";

export interface RescreenHealth {
  member_type: "adult" | "child" | "pregnant" | "lactating";
  age: number;
  activity_level: string | null | undefined;
  conditions: string[];
}

/**
 * Returns the profile with a freshly-recomputed `screening`. No-op (returns the input
 * unchanged) for a null profile, a child profile, or a meals-only/non-prescription
 * profile (no `availability_days`, so no screening to keep current) — callers can pass
 * the result straight through to the DB update.
 */
export function rescreenExerciseProfile(
  profile: ExerciseProfile | null | undefined,
  health: RescreenHealth,
): ExerciseProfile | null | undefined {
  if (!profile || !profile.availability_days || health.member_type === "child") {
    return profile;
  }
  const screening = computeExerciseScreening({
    member_type: health.member_type,
    age: health.age,
    activity_level: health.activity_level,
    conditions: health.conditions,
    hr_meds: profile.hr_meds,
    resting_hr: profile.resting_hr,
    symptoms: profile.symptoms ?? [],
  });
  return { ...profile, screening };
}
