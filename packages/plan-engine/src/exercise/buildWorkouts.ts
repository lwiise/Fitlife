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

// Shape the meal-profile fields computeEnergyBudget needs from the plan context for
// one member ("mom" or a family_members.id). The SINGLE source of this shaping — the
// workout build below AND any caller that recomputes a member's budget to compare it
// against the stored one (dispatch's promotion check) must go through here, or the
// two budgets drift on a field mismatch (e.g. mom's `pregnancy_trimester` vs a
// member's `trimester`) and report spurious changes. Returns null for an unknown id.
export function energyBudgetMemberFromContext(
  context: PlanPromptContext,
  memberId: string,
): EnergyBudgetMember | null {
  if (memberId === "mom") {
    const mom = context.mom;
    return {
      member_type: toMemberType(mom.member_type),
      sex: toSex(mom.sex),
      age: mom.age ?? 0,
      weight_kg: mom.weight_kg,
      height_cm: mom.height_cm,
      activity_level: mom.activity_level,
      primary_goal: mom.primary_goal,
      trimester: mom.pregnancy_trimester,
      months_postpartum: mom.months_postpartum,
    };
  }
  const m = context.family_members.find((fm) => fm.id === memberId);
  if (!m) return null;
  return {
    member_type: toMemberType(m.member_type),
    sex: toSex(m.sex),
    age: m.age ?? 0,
    weight_kg: m.weight_kg,
    height_cm: m.height_cm,
    activity_level: m.activity_level,
    primary_goal: m.primary_goal,
    trimester: m.trimester,
    months_postpartum: m.months_postpartum,
  };
}

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
  existingWorkouts?: WorkoutPlan[] | null,
  forceRecomputeMemberIds?: readonly string[] | null,
): WorkoutPlan[] {
  const byId = new Map(skeleton.members.map((m) => [m.member_id, m]));
  // Members to recompute even though they're NOT in this run's skeleton — the
  // exercise-only regen path passes the target here with an empty skeleton, so the
  // target is rebuilt (from her edited profile) while everyone else is carried.
  const force = new Set(forceRecomputeMemberIds ?? []);
  // Workouts already on the plan, keyed by member. A single-member add/regen/drain
  // only re-skeletons the targeted member; every other opted-in member is "carried"
  // and must keep their PRIOR (possibly model-tailored) workout rather than be
  // recomputed into a generic default.
  const existingById = new Map(
    (existingWorkouts ?? []).map((w) => [w.member_id, w]),
  );
  const out: WorkoutPlan[] = [];

  const build = (
    member_id: string,
    member: EnergyBudgetMember,
    profile: ExerciseProfile | null | undefined,
  ) => {
    if (!profile || !profile.availability_days || member.member_type === "child") return;

    // Carry verbatim: this run didn't re-skeleton this member, they're not force-
    // recomputed, and they already have a workout. Recomputing here would overwrite
    // their model-tailored sessions with a deterministic default. Only members IN
    // this run's skeleton, force-recomputed targets, or first-timers with no workout
    // yet get (re)computed below.
    if (!byId.has(member_id) && !force.has(member_id)) {
      const prior = existingById.get(member_id);
      if (prior) {
        out.push(prior);
        return;
      }
    }

    // Exercise is non-critical: one member's bad computation (NaN MET, malformed
    // session) must never throw out of generateMealPlan and fail the meal plan. On
    // failure, fall back to any prior workout for this member, else skip them.
    try {
      const budget = computeEnergyBudget(member, profile, profile.screening);
      const emitted = byId.get(member_id)?.training ?? null;

      // The model proposes WHICH sessions. Respect a real `withheld` (clearance unmet).
      // But if it emitted no sessions for an opted-in, non-clearance member, synthesize
      // a deterministic schedule so she always gets a plan (this also covers a carried-
      // over member who wasn't re-skeletoned this run and has no prior workout).
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
    } catch (e) {
      console.warn("[plan-generate] workout build failed for", member_id, e);
      const prior = existingById.get(member_id);
      if (prior) out.push(prior);
    }
  };

  build("mom", energyBudgetMemberFromContext(context, "mom")!, context.mom.exercise_profile);

  for (const m of context.family_members) {
    if (m.role === "housekeeper") continue;
    build(m.id, energyBudgetMemberFromContext(context, m.id)!, m.exercise_profile);
  }
  return out;
}
