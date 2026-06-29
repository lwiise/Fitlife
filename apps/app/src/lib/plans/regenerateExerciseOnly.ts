import "server-only";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import {
  buildWorkoutsFromSkeleton,
  type MealPlan,
  type PlanPromptContext,
} from "@fitlife/plan-engine";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * TRUE exercise-only regen: rebuild ONE member's WorkoutPlan in place and leave
 * every other member's workout — and ALL meals — exactly as they were. Deterministic,
 * model-free, sub-millisecond, runs inline (prod-safe, no background function).
 *
 * Called only when the edit did NOT move the meal math; a budget change auto-promotes
 * to a full "both" regen upstream (in dispatch), so this never has to touch meals.
 *
 * Mirrors `ensurePlanWorkouts`, but where that NON-destructively fills only missing
 * workouts, this REPLACES the target's workout wholesale via `forceRecomputeMemberIds`:
 * empty meal-skeleton + force [memberId] → the target is recomputed from her edited
 * profile while everyone else carries verbatim (the bug-#2 carry guard). A raised-
 * clearance edit yields no workout for the target → her stale prior is dropped, not
 * carried.
 */
export async function regenerateExerciseOnly(args: {
  supabase: ServerClient;
  userId: string;
  memberId: string;
  context: PlanPromptContext;
  priorPlanId: string;
  priorPlan: MealPlan;
}): Promise<{ ok: true; mealPlanId: string } | { ok: false }> {
  const { supabase, userId, memberId, context, priorPlanId, priorPlan } = args;

  const existing = priorPlan.workouts ?? [];
  // Only members actually in this plan get a workout. buildWorkoutsFromSkeleton
  // iterates the WHOLE family context (no tier cap here), so a non-target opted-in
  // member with no prior workout — e.g. a tier-DEFERRED member who isn't in the meal
  // plan — would otherwise get a synthesized default attached. Guard on plan members,
  // same as ensurePlanWorkouts, so the patch never adds an orphan workout.
  const planMemberIds = new Set((priorPlan.members ?? []).map((m) => m.member_id));
  const rebuilt = buildWorkoutsFromSkeleton(context, { members: [] }, existing, [
    memberId,
  ]).filter((w) => planMemberIds.has(w.member_id));
  // Replace wholesale: `rebuilt` carries every in-plan non-target member verbatim and
  // either re-derives or drops the target. Setting it directly (vs. the attach's "omit
  // when empty") is what lets a now-withheld member's workout actually disappear.
  const nextPlan: MealPlan = { ...priorPlan, workouts: rebuilt };

  const { error } = await supabase
    .from("meal_plans")
    .update({ plan_data: nextPlan as unknown as Json })
    .eq("id", priorPlanId);
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "plan", step: "regenerateExerciseOnly", userId },
    });
    return { ok: false };
  }

  revalidatePath("/plan");
  return { ok: true, mealPlanId: priorPlanId };
}
