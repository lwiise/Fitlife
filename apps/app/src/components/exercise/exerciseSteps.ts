// Pure step-ordering for the appended exercise flow — the progressive-disclosure
// logic. Safety steps (hr-meds, resting-HR, symptom screen) appear ONLY when an
// age threshold or a condition flag fires, so a healthy young member sees just the
// opt-in + ~4 prescription taps. Shared by MemberWizard and the Mom exercise screen.

import { SYMPTOM_SCREEN_AGE } from "@/lib/exercise/constants";
import type { ExerciseState } from "./useExerciseProfile";

export type ExerciseStepKey =
  | "exerciseOptIn"
  | "exFocus"
  | "exMsk"
  | "exAvailability"
  | "exTypes"
  | "exSetting"
  | "exHrMeds"
  | "exRestingHr"
  | "exSymptoms"
  | "exChildActivities"
  | "exDelivery"
  | "exPelvicFloor";

export const EXERCISE_OPT_IN: ExerciseStepKey = "exerciseOptIn";

const EXERCISE_KEYS = new Set<string>([
  "exerciseOptIn",
  "exFocus",
  "exMsk",
  "exAvailability",
  "exTypes",
  "exSetting",
  "exHrMeds",
  "exRestingHr",
  "exSymptoms",
  "exChildActivities",
  "exDelivery",
  "exPelvicFloor",
]);

export const isExerciseStep = (key: string): key is ExerciseStepKey =>
  EXERCISE_KEYS.has(key);

export interface ExerciseStepContext {
  member_type: "adult" | "child" | "pregnant" | "lactating";
  goalIsSpecific: boolean; // goal already implies focus (build_muscle / athletic)
  age: number;
  hasCardioCondition: boolean; // any heart/HTN flag → ask about rate-limiting meds
  hasAnyCondition: boolean;
}

// Ordered prescription steps AFTER the opt-in. Empty when not opted in.
export function exercisePrescriptionSteps(
  ctx: ExerciseStepContext,
  state: ExerciseState,
): ExerciseStepKey[] {
  if (!state.optedIn) return [];

  // Child: play-based, context only — no load/intensity, no screening.
  if (ctx.member_type === "child") return ["exChildActivities"];

  if (ctx.member_type === "pregnant") {
    return ["exMsk", "exAvailability", "exTypes", "exSetting"];
  }

  if (ctx.member_type === "lactating") {
    return [
      "exDelivery",
      "exPelvicFloor",
      "exMsk",
      "exAvailability",
      "exTypes",
      "exSetting",
    ];
  }

  // adult / mom
  const steps: ExerciseStepKey[] = [];
  if (!ctx.goalIsSpecific) steps.push("exFocus");
  steps.push("exMsk", "exAvailability", "exTypes", "exSetting");
  if (ctx.hasCardioCondition) steps.push("exHrMeds");
  // Resting HR + symptom screen surface together, only in "safety mode".
  if (ctx.age >= SYMPTOM_SCREEN_AGE || ctx.hasAnyCondition) {
    steps.push("exRestingHr", "exSymptoms");
  }
  return steps;
}
