// computeEnergyBudget — the deterministic heart of exercise↔meal coupling. No model
// involvement (same "don't trust the model with the math" reason shared-meal assembly
// is deterministic in code). Pure + Date-free (caller passes precomputed age).
//
// Energy math: BMR (Mifflin–St Jeor) → baselineMaintenance → +weekly exercise
// expenditure (EEE) → TDEE → targetIntake under four hard safety rules. The four
// rules are enforced HERE in code (+ tests), never as prompt suggestions.
//
// Grounded in ACSM 11th ed. (energy/intensity) + standard nutrition practice.

import { selectMet } from "./metTable";
import type {
  AvailabilityDays,
  EnergyBudgetMember,
  ExerciseProfile,
  ExerciseScreening,
  ExerciseType,
  IntensityBand,
  Modality,
  SessionMinutes,
} from "./types";
import type { EnergyBudget, HrZone } from "./schema";

// ── Tunable constants — clinician sign-off before production. ────────────────
// The SHAPE of the math is locked; these numbers are seeds to validate clinically.
const ACTIVITY_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};
const BASELINE_PAL = 1.3; // non-workout daily living for opted-in members
const FAT_LOSS_DEFICIT = 400; // kcal/day off TDEE for weight loss
const MUSCLE_GAIN_SURPLUS = 250; // kcal/day over TDEE for lean gain
const MEDICAL_MIN_INTAKE = 1200; // absolute intake floor
const SESSIONS_PER_WEEK: Record<AvailabilityDays, number> = { "1-2": 2, "3-4": 4, "5+": 5 };
const SESSION_HOURS: Record<SessionMinutes, number> = { 15: 0.25, 30: 0.5, 45: 0.75 };
// The member's onboarding preference (ExerciseType) → a representative Modality for
// the budget estimate. The model later prescribes exact modalities within the envelope.
const EXERCISE_TYPE_TO_MODALITY: Record<ExerciseType, Modality> = {
  walking: "walking",
  cardio: "cycling",
  strength: "resistance",
  yoga_pilates: "yoga",
};
const pregnancyIncrement = (tri: number | null | undefined): number =>
  tri === 2 ? 340 : tri === 3 ? 452 : 0; // 1st trimester ≈ no increment
const lactationIncrement = (months: number | null | undefined): number =>
  (months ?? 0) <= 6 ? 500 : 400; // higher in the first 6 months
// ─────────────────────────────────────────────────────────────────────────────

const round = (n: number): number => Math.round(n);

function mifflinStJeor(
  sex: "male" | "female" | null,
  weight: number,
  height: number,
  age: number,
): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  // Unknown sex → female constant (conservative: lower BMR → tighter budget).
  return sex === "male" ? base + 5 : base - 161;
}

const activityFactor = (level: string | null): number =>
  ACTIVITY_FACTORS[level ?? "sedentary"] ?? 1.2;

// Deterministic weekly EEE estimate from the member's availability + session length
// + a representative MET (preferred type × the band their ceiling allows). The model
// later proposes the exact sessions WITHIN this envelope; code owns the energy.
function estimateWeeklyEEE(
  member: EnergyBudgetMember,
  profile: ExerciseProfile,
  ceiling: ExerciseScreening["intensity_ceiling"],
): number {
  const weight = member.weight_kg ?? 0;
  if (weight <= 0) return 0;
  const sessions = SESSIONS_PER_WEEK[profile.availability_days ?? "3-4"] ?? 4;
  const hours = SESSION_HOURS[profile.session_minutes ?? 30] ?? 0.5;
  const prefType: ExerciseType = profile.preferred_types?.[0] ?? "walking";
  const modality = EXERCISE_TYPE_TO_MODALITY[prefType] ?? "walking";
  // Request the top tier the ceiling allows; selectMet gates it (can never return a
  // vigorous MET for a capped member).
  const tier: IntensityBand =
    ceiling === "can_progress_to_vigorous" ? "vigorous" : "moderate";
  const met = selectMet(modality, tier, ceiling);
  return sessions * met * weight * hours;
}

function computeTargetIntake(
  member: EnergyBudgetMember,
  bmr: number,
  tdee: number,
  weeklyEEE: number,
  intensityCeiling: ExerciseScreening["intensity_ceiling"],
  notes: string[],
): number {
  // Rule 2: gross hard floor — never below max(BMR, medical minimum).
  let floor = Math.max(bmr, MEDICAL_MIN_INTAKE);
  // Rule 3 (decided): energy-availability floor — for can-progress-to-vigorous
  // members, net intake after weekly-averaged EEE must stay ≥ BMR (catches the
  // active member whose NET intake goes too low even though gross clears the BMR
  // floor). Both floors apply; the higher binds.
  if (intensityCeiling === "can_progress_to_vigorous" && weeklyEEE > 0) {
    const eaFloor = bmr + weeklyEEE / 7;
    if (eaFloor > floor) {
      floor = eaFloor;
      notes.push(
        `energy-availability floor active: net intake kept ≥ BMR (${round(floor)} kcal)`,
      );
    }
  }

  // Rule 4: pregnant / lactating → NO deficit ever, regardless of stated goal.
  if (member.member_type === "pregnant") {
    const inc = pregnancyIncrement(member.trimester);
    notes.push(`pregnant — no deficit; +${inc} kcal (trimester ${member.trimester ?? "?"})`);
    return Math.max(tdee + inc, floor);
  }
  if (member.member_type === "lactating") {
    const inc = lactationIncrement(member.months_postpartum);
    notes.push(`lactating — no deficit; +${inc} kcal increment`);
    return Math.max(tdee + inc, floor);
  }

  // Adult: direction from the Sara goal slug.
  let intake: number;
  switch (member.primary_goal) {
    case "fat_loss":
      intake = tdee - FAT_LOSS_DEFICIT;
      if (intake < floor) {
        notes.push(`deficit clamped to floor (${round(floor)} kcal)`);
        intake = floor; // Rule 2/3: never below the binding floor
      }
      break;
    case "muscle_gain":
      intake = tdee + MUSCLE_GAIN_SURPLUS;
      break;
    default:
      intake = tdee; // maintain / recomp / metabolic / digestive / posture
  }
  return Math.max(intake, floor);
}

export function computeEnergyBudget(
  member: EnergyBudgetMember,
  exerciseProfile?: ExerciseProfile | null,
  screening?: ExerciseScreening | null,
): EnergyBudget {
  const notes: string[] = [];
  const verdict = screening ?? exerciseProfile?.screening ?? null;
  const intensity_mode = verdict?.intensity_mode ?? "hr_zones";
  const intensity_ceiling = verdict?.intensity_ceiling ?? "light_moderate";
  // Surfaced so 2c can WITHHOLD the exercise plan for a flagged member.
  const clearance_required = verdict?.clearance_required ?? false;

  const bmr = mifflinStJeor(
    member.sex,
    member.weight_kg ?? 0,
    member.height_cm ?? 0,
    member.age,
  );

  // Rule 5: children are portion-based — no calorie target, no EEE coupling.
  if (member.member_type === "child") {
    notes.push("child — portion-based, no calorie target; exercise is play");
    return {
      bmr: round(bmr),
      baseline_maintenance: round(bmr),
      weekly_eee: 0,
      tdee: round(bmr),
      target_intake: null,
      intensity_mode,
      intensity_ceiling,
      clearance_required,
      notes,
    };
  }

  const optedIn = !!exerciseProfile && !!exerciseProfile.availability_days;

  let baselineMaintenance: number;
  let weeklyEEE: number;
  if (optedIn) {
    // Explicit EEE on a fixed non-workout PAL — avoids double-counting the
    // self-reported activity factor together with the prescribed sessions.
    baselineMaintenance = bmr * BASELINE_PAL;
    weeklyEEE = estimateWeeklyEEE(member, exerciseProfile!, intensity_ceiling);
  } else {
    // Meals-only (null profile) → today's path exactly: TDEE = BMR × activity factor.
    baselineMaintenance = bmr * activityFactor(member.activity_level);
    weeklyEEE = 0;
  }
  // Rule 1 (decided): "fueling, not a ledger". EEE is averaged into the weekly TDEE
  // (additive, not a coarse PAL bump → re-sync recomputes transparently), and the
  // deficit is taken off that EEE-inclusive TDEE — so more prescribed activity raises
  // the target (the member is fueled accordingly). targetIntake is ONE weekly-stable
  // value: it never spikes on a training day, and there is no daily burn/eat ledger.
  // (The companion "no burn/eat math shown in the UI" rule lives in the Phase-3 UI.)
  const tdee = baselineMaintenance + weeklyEEE / 7;
  const targetIntake = computeTargetIntake(
    member,
    bmr,
    tdee,
    weeklyEEE,
    intensity_ceiling,
    notes,
  );

  return {
    bmr: round(bmr),
    baseline_maintenance: round(baselineMaintenance),
    weekly_eee: round(weeklyEEE),
    tdee: round(tdee),
    target_intake: round(targetIntake),
    intensity_mode,
    intensity_ceiling,
    clearance_required,
    notes,
  };
}

// ── Intensity prescription helpers (pure; consumed by the 2d workout expander) ──

// Karvonen %HRR zones from resting HR + age-derived HRmax (220 − age). bpm.
export function computeHrZones(restingHr: number, age: number): HrZone[] {
  const hrMax = 220 - age;
  const hrr = hrMax - restingHr;
  const zone = (band: IntensityBand, lo: number, hi: number): HrZone => ({
    band,
    low_bpm: round(restingHr + lo * hrr),
    high_bpm: round(restingHr + hi * hrr),
  });
  return [
    zone("light", 0.3, 0.39),
    zone("moderate", 0.4, 0.59),
    zone("vigorous", 0.6, 0.89),
  ];
}

// Borg RPE (6–20) band targets — used when intensity_mode is "rpe".
export function rpeForBand(band: IntensityBand): { low: number; high: number } {
  switch (band) {
    case "light":
      return { low: 9, high: 11 };
    case "moderate":
      return { low: 12, high: 13 };
    case "vigorous":
      return { low: 14, high: 17 };
  }
}
