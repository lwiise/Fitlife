// 2d (deterministic layer): turn the skeleton's emitted training sessions into a
// full WorkoutPlan — per session, code attaches the intensity prescription
// (HR zones via Karvonen, or Borg RPE) + estimated kcal (MET table), and the
// non-training days become rest. Pure + Zod-validated (WorkoutPlanSchema.parse).
// No model involvement here — the model proposes WHICH sessions (skeleton); code
// owns the prescription math. AI exercise CONTENT (specific moves/sets) is a later
// enrichment layer. The energy budget is passed in (2e reconciles it against the
// actually-emitted sessions); withheld / no-sessions → null (no program).

import type { SkeletonTraining } from "../schema";
import { computeHrZones, rpeForBand } from "./energyBudget";
import { selectMet } from "./metTable";
import { MODALITIES } from "./types";
import type {
  IntensityCeiling,
  IntensityMode,
  Modality,
} from "./types";
import {
  WorkoutPlanSchema,
  type EnergyBudget,
  type WorkoutDay,
  type WorkoutPlan,
  type WorkoutSession,
} from "./schema";

export interface WorkoutAssemblyParams {
  weight_kg: number | null;
  age: number;
  resting_hr: number | null;
  intensity_mode: IntensityMode;
  intensity_ceiling: IntensityCeiling;
  budget: EnergyBudget;
}

const isModality = (s: string): s is Modality =>
  (MODALITIES as readonly string[]).includes(s);

export function assembleWorkoutPlan(
  member_id: string,
  training: SkeletonTraining | null | undefined,
  params: WorkoutAssemblyParams,
): WorkoutPlan | null {
  // Clearance-withheld or no prescribed sessions → no program.
  if (!training || training.withheld || !training.sessions?.length) return null;

  const weight = params.weight_kg ?? 0;
  const zones =
    params.resting_hr != null
      ? computeHrZones(params.resting_hr, params.age)
      : null;
  // Fall back to RPE if HR mode was chosen but we have no resting HR to anchor zones.
  const useHr = params.intensity_mode === "hr_zones" && zones != null;

  const sessionByDay = new Map(training.sessions.map((s) => [s.day_index, s]));

  const days: WorkoutDay[] = [];
  for (let d = 0; d < 7; d++) {
    const s = sessionByDay.get(d);
    if (!s) {
      days.push({ day_index: d, entry: { kind: "rest" } });
      continue;
    }
    const modality: Modality = isModality(s.modality) ? s.modality : "walking";
    const met = selectMet(modality, s.band, params.intensity_ceiling);
    const est_kcal =
      weight > 0 ? Math.round(met * weight * (s.duration_min / 60)) : 0;

    const intensity = useHr
      ? { hr_zone: zones!.find((z) => z.band === s.band) }
      : (() => {
          const r = rpeForBand(s.band);
          return { rpe_low: r.low, rpe_high: r.high };
        })();

    const session: WorkoutSession = {
      kind: "session",
      exercise_type: modality,
      band: s.band,
      duration_min: s.duration_min,
      est_kcal,
      ...intensity,
    };
    days.push({ day_index: d, entry: session });
  }

  // Validate the assembled shape — a malformed session throws loudly rather than
  // silently persisting bad data downstream.
  return WorkoutPlanSchema.parse({ member_id, budget: params.budget, days });
}
