import type { z } from "zod";

import { ACTIVITY_LEVEL_LABELS, type ActivityLevel } from "@/lib/plans/activityLevel";
import type { step1Schema, step2Schema } from "../schema";

type Identity = z.infer<typeof step1Schema>;
type Physical = z.infer<typeof step2Schema>;

/**
 * The subset of `profiles` the mom wizard's first three steps already persist
 * via saveProfileStep, read back so a returning user is not re-asked.
 *
 * Those progressive saves were effectively WRITE-ONLY before this: the wizard
 * was mounted with no props, so abandoning at step 8 of 11 and coming back
 * meant retyping the name, birth year, height, weight, waist, target weight
 * and activity level that were already on her row. Onboarding is the biggest
 * drop-off surface in the funnel, so re-asking is expensive.
 *
 * The goal and the health answers are deliberately absent — `primary_goal`
 * stores the SARA-mapped value and the mapping needs the medical answers from
 * later steps, so they only land at final submit. There is nothing to restore.
 */
export interface SavedMomAnswers {
  sex: string | null;
  display_name: string | null;
  birth_year: number | null;
  phone: string | null;
  height_cm: number | string | null;
  weight_kg: number | string | null;
  waist_cm: number | string | null;
  hip_cm: number | string | null;
  target_weight_kg: number | string | null;
  activity_level: string | null;
}

/**
 * Postgres returns `numeric` columns as strings; the schemas want numbers.
 *
 * The empty-string guard is load-bearing: `Number("")` is 0, not NaN, so
 * without it a blank stored value seeds the height field with 0 — a form that
 * looks answered and fails validation on a value the user never typed.
 */
function num(v: number | string | null): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Seed the identity step only when every REQUIRED field is present. A
 * half-filled seed would render the form as answered while the schema still
 * rejects it — worse than an empty form, because the missing field is the one
 * thing not drawing attention to itself.
 */
export function restoreIdentity(saved?: SavedMomAnswers): Identity | undefined {
  if (!saved) return undefined;
  const { sex, display_name, birth_year } = saved;
  if ((sex !== "female" && sex !== "male") || !display_name || !birth_year) {
    return undefined;
  }
  return {
    sex,
    display_name,
    birth_year,
    phone: saved.phone ?? undefined,
  } as Identity;
}

/** Same all-or-nothing rule; height and weight are the required pair. */
export function restorePhysical(saved?: SavedMomAnswers): Physical | undefined {
  if (!saved) return undefined;
  const height_cm = num(saved.height_cm);
  const weight_kg = num(saved.weight_kg);
  if (height_cm === undefined || weight_kg === undefined) return undefined;
  return {
    height_cm,
    weight_kg,
    waist_cm: num(saved.waist_cm) ?? null,
    hip_cm: num(saved.hip_cm) ?? null,
    target_weight_kg: num(saved.target_weight_kg) ?? null,
  } as Physical;
}

/** Never trust a stored string to be one of the five levels. */
export function restoreActivityLevel(
  saved?: SavedMomAnswers,
): ActivityLevel | null {
  const level = saved?.activity_level;
  if (!level || !(level in ACTIVITY_LEVEL_LABELS)) return null;
  return level as ActivityLevel;
}
