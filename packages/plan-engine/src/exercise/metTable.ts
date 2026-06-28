// MET (metabolic equivalent) lookup for the energy budget: per session,
// kcal = MET(modality, tier) × weight_kg × duration_hr (GROSS energy — no
// net-of-rest subtraction, standard for budgeting). weeklyEEE = Σ sessions.
//
// Sourcing: the per-activity MET VALUES are standard *Compendium of Physical
// Activities* figures (Ainsworth 2011) — the reference ACSM's Guidelines itself
// defers to for activity METs. The TIER BANDS are from ACSM Table 1.1
// (light 1.6–2.9 · moderate 3.0–5.9 · vigorous ≥6.0). Representative tier figures —
// clinician sign-off before production, alongside the calorie constants.

import type { IntensityBand, IntensityCeiling, Modality } from "./types";

const MET_TABLE: Record<Modality, Partial<Record<IntensityBand, number>>> = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 5.0 },
  cycling: { light: 3.5, moderate: 7.0, vigorous: 9.5 }, // stationary
  swimming: { light: 6.0, moderate: 8.0, vigorous: 9.8 },
  aquafit: { moderate: 5.3 },
  low_impact_aerobics: { moderate: 5.0 },
  high_impact_aerobics: { vigorous: 7.3 },
  dance: { moderate: 5.0, vigorous: 7.3 },
  calisthenics: { light: 3.5, moderate: 4.5, vigorous: 8.0 },
  resistance: { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  yoga: { light: 2.5 },
  pilates: { moderate: 3.0 },
  mobility: { light: 2.3 },
  step: { moderate: 4.5, vigorous: 8.0 },
};

// Ceiling-gated MET selection: a member whose screening ceiling is NOT
// `can_progress_to_vigorous` (pregnant / postpartum / symptomatic / sedentary-start)
// can never be handed a vigorous MET — a vigorous request is dropped to moderate.
// Falls back requested → moderate → light to tolerate the table's sparse rows.
export function selectMet(
  m: Modality,
  tier: IntensityBand,
  ceiling: IntensityCeiling,
): number {
  const allowed: IntensityBand[] =
    ceiling === "can_progress_to_vigorous"
      ? ["light", "moderate", "vigorous"]
      : ["light", "moderate"];
  const t = allowed.includes(tier) ? tier : "moderate";
  const row = MET_TABLE[m];
  return row[t] ?? row.moderate ?? row.light!;
}

export { MET_TABLE };
