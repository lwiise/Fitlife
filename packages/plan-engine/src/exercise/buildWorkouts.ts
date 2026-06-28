// 2e orchestration (pure): from the parsed skeleton (which carries each opted-in
// member's emitted `training`) + the plan context, compute each member's
// EnergyBudget and assemble their WorkoutPlan. Deterministic — no model call, no
// tokens. Meals-only / not-opted-in / clearance-withheld members yield nothing.
// generateMealPlan attaches the result to MealPlan.workouts (rides in plan_data).
//
// NOTE: meal targets are NOT changed here — meal generation stays byte-identical.
// The meal↔budget coupling (intake follows the budget) is the deferred final step.

import type { PlanPromptContext } from "../buildContext";
import type { PlanSkeleton } from "../schema";
import { computeEnergyBudget } from "./energyBudget";
import { assembleWorkoutPlan } from "./assembleWorkout";
import type { EnergyBudgetMember, MemberType } from "./types";
import type { ExerciseProfile } from "./types";
import type { WorkoutPlan } from "./schema";

const toMemberType = (s: string): MemberType =>
  s === "child" || s === "pregnant" || s === "lactating" ? (s as MemberType) : "adult";
const toSex = (s: string | null): "male" | "female" | null =>
  s === "male" || s === "female" ? s : null;

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
    const sm = byId.get(member_id);
    if (!sm?.training) return; // this member wasn't (re)skeletoned this run
    const budget = computeEnergyBudget(member, profile, profile.screening);
    const wp = assembleWorkoutPlan(member_id, sm.training, {
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
