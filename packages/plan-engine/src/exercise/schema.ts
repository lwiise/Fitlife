// Phase 2 Zod contracts — EnergyBudget (the shared meal↔training contract) and the
// WorkoutPlan shape (consumed by the workout day-expander in 2d). Contracts only:
// nothing emits a WorkoutPlan yet. Mirrors the meal schema's Zod-infer style.

import { z } from "zod";
import { MODALITIES } from "./types";

export const ModalitySchema = z.enum(MODALITIES);

export const IntensityBandSchema = z.enum(["light", "moderate", "vigorous"]);
export const IntensityModeSchema = z.enum(["hr_zones", "rpe"]);
export const IntensityCeilingSchema = z.enum([
  "light_moderate",
  "can_progress_to_vigorous",
]);

// A heart-rate training zone (Karvonen %HRR), in bpm.
export const HrZoneSchema = z.object({
  band: IntensityBandSchema,
  low_bpm: z.number().int(),
  high_bpm: z.number().int(),
});
export type HrZone = z.infer<typeof HrZoneSchema>;

// The deterministic per-member energy contract. targetIntake is null for children
// (portion-based, no calorie target). Computed once per plan; weekly-stable.
export const EnergyBudgetSchema = z.object({
  bmr: z.number(),
  baseline_maintenance: z.number(),
  weekly_eee: z.number(),
  tdee: z.number(),
  target_intake: z.number().nullable(),
  intensity_mode: IntensityModeSchema,
  intensity_ceiling: IntensityCeilingSchema,
  // Decided: a raised clearance flag WITHHOLDS the exercise plan (2c reads this) —
  // a "needs doctor sign-off" state, not a warning. The meal plan is unaffected.
  clearance_required: z.boolean(),
  notes: z.array(z.string()),
});
export type EnergyBudget = z.infer<typeof EnergyBudgetSchema>;

// ─── WorkoutPlan (contract for 2d; nothing emits it yet) ─────────────────

export const WorkoutSessionSchema = z.object({
  kind: z.literal("session"),
  exercise_type: ModalitySchema,
  band: IntensityBandSchema,
  duration_min: z.number().int().positive(),
  // Prescription target — one of these, per the member's intensity_mode.
  hr_zone: HrZoneSchema.optional(),
  rpe_low: z.number().int().optional(),
  rpe_high: z.number().int().optional(),
  est_kcal: z.number().optional(), // deterministic EEE for this session
  notes_ar: z.string().optional(),
});
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

export const WorkoutRestSchema = z.object({
  kind: z.literal("rest"),
  notes_ar: z.string().optional(), // e.g. active recovery suggestion
});
export type WorkoutRest = z.infer<typeof WorkoutRestSchema>;

export const WorkoutDaySchema = z.object({
  day_index: z.number().int().min(0).max(6),
  entry: z.discriminatedUnion("kind", [WorkoutSessionSchema, WorkoutRestSchema]),
});
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;

export const WorkoutPlanSchema = z.object({
  member_id: z.string().min(1),
  budget: EnergyBudgetSchema,
  days: z.array(WorkoutDaySchema).min(1).max(7),
});
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
