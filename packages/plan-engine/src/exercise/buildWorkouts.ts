// 2e orchestration (pure): from the parsed skeleton (which carries each opted-in
// member's emitted `training`) + the plan context, compute each member's
// EnergyBudget and assemble their WorkoutPlan. Deterministic — no model call, no
// tokens. Meals-only / not-opted-in / clearance-withheld members yield nothing.
// generateMealPlan attaches the result to MealPlan.workouts (rides in plan_data).
//
// NOTE: meal targets are NOT changed here — meal generation stays byte-identical.
// The meal↔budget coupling (intake follows the budget) is the deferred final step.

import type { PlanPromptContext } from "../buildContext";
import type { PlanSkeleton, SkeletonTraining } from "../schema";
import { computeEnergyBudget } from "./energyBudget";
import { assembleWorkoutPlan } from "./assembleWorkout";
import type { EnergyBudgetMember, MemberType } from "./types";
import type { ExerciseProfile, ExerciseType, Modality } from "./types";
import type { WorkoutPlan } from "./schema";

const toMemberType = (s: string): MemberType =>
  s === "child" || s === "pregnant" || s === "lactating" ? (s as MemberType) : "adult";
const toSex = (s: string | null): "male" | "female" | null =>
  s === "male" || s === "female" ? s : null;

// Map a member's top onboarding preference to a representative budgeting modality.
const PREFERRED_MODALITY: Record<ExerciseType, Modality> = {
  walking: "walking",
  strength: "resistance",
  yoga_pilates: "yoga",
  cardio: "low_impact_aerobics",
};

// Deterministic fallback schedule for an opted-in, NON-clearance member when the
// model omitted `training` (model variance) — so an opted-in member always gets a
// real plan instead of silently nothing. Sessions/week from availability, modality
// from her top preference, a safe "moderate" band (within both intensity ceilings),
// her chosen duration, days spread across the week (the rest become rest days).
export function defaultTrainingFromProfile(
  profile: ExerciseProfile,
): SkeletonTraining {
  const count =
    profile.availability_days === "5+"
      ? 4
      : profile.availability_days === "3-4"
        ? 3
        : 2;
  const pref = profile.preferred_types?.[0];
  const modality = (pref && PREFERRED_MODALITY[pref]) || "walking";
  const duration = profile.session_minutes ?? 30;
  const days = new Set<number>();
  for (let i = 0; i < count; i++) days.add(Math.min(6, Math.round((i * 7) / count)));
  return {
    sessions: [...days].map((day_index) => ({
      day_index,
      modality,
      band: "moderate" as const,
      duration_min: duration,
    })),
  };
}

export function buildWorkoutsFromSkeleton(
  context: PlanPromptContext,
  skeleton: PlanSkeleton,
): WorkoutPlan[] {
  const byId = new Map(skeleton.members.map((m) => [m.member_id, m]));
  const out: WorkoutPlan[] = [];

  const build = (
    member_id: string,
    member: EnergyBudgetMember,
    profile: ExerciseProfile | null | undefined,
  ) => {
    if (!profile || !profile.availability_days || member.member_type === "child") return;
    const budget = computeEnergyBudget(member, profile, profile.screening);
    const emitted = byId.get(member_id)?.training ?? null;

    // The model proposes WHICH sessions. Respect a real `withheld` (clearance unmet).
    // But if it emitted no sessions for an opted-in, non-clearance member, synthesize
    // a deterministic schedule so she always gets a plan (this also covers a carried-
    // over member who wasn't re-skeletoned this run).
    const emittedHasSessions =
      !!emitted && !emitted.withheld && (emitted.sessions?.length ?? 0) > 0;
    const training: SkeletonTraining | null = emitted?.withheld
      ? emitted
      : emittedHasSessions
        ? emitted
        : budget.clearance_required
          ? null // needs clearance but model didn't withhold → still no program
          : defaultTrainingFromProfile(profile);

    const wp = assembleWorkoutPlan(member_id, training, {
      weight_kg: member.weight_kg,
      age: member.age,
      resting_hr: profile.resting_hr ?? null,
      intensity_mode: budget.intensity_mode,
      intensity_ceiling: budget.intensity_ceiling,
      budget,
    });
    if (wp) out.push(wp); // null = withheld / no sessions
  };

  const mom = context.mom;
  build(
    "mom",
    {
      member_type: toMemberType(mom.member_type),
      sex: toSex(mom.sex),
      age: mom.age ?? 0,
      weight_kg: mom.weight_kg,
      height_cm: mom.height_cm,
      activity_level: mom.activity_level,
      primary_goal: mom.primary_goal,
      trimester: mom.pregnancy_trimester,
      months_postpartum: mom.months_postpartum,
    },
    mom.exercise_profile,
  );

  for (const m of context.family_members) {
    if (m.role === "housekeeper") continue;
    build(
      m.id,
      {
        member_type: toMemberType(m.member_type),
        sex: toSex(m.sex),
        age: m.age ?? 0,
        weight_kg: m.weight_kg,
        height_cm: m.height_cm,
        activity_level: m.activity_level,
        primary_goal: m.primary_goal,
        trimester: m.trimester,
        months_postpartum: m.months_postpartum,
      },
      m.exercise_profile,
    );
  }
  return out;
}
