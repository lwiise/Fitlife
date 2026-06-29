"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import {
  buildPlanContext,
  buildWorkoutsFromSkeleton,
  type MealPlan,
} from "@fitlife/plan-engine";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Self-heal the exercise plan: fill in any opted-in member's WorkoutPlan that's
 * missing from the latest ready plan. Deterministic + model-free — uses
 * `defaultTrainingFromProfile` via `buildWorkoutsFromSkeleton` with an EMPTY skeleton,
 * so it never calls the model. NON-destructive: only adds workouts for members who
 * have none, never overwrites an existing (possibly model-tailored) one, and only for
 * members actually present in the meal plan.
 *
 * Covers: plans generated before the workout-attach shipped, and the post-generation
 * `/plan` banner opt-in (which saves the profile but does not regenerate). Idempotent —
 * once every eligible member has a workout it returns `{ changed: false }` cheaply.
 */
export async function ensurePlanWorkouts(): Promise<{ changed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { changed: false };

  const { data: row } = await supabase
    .from("meal_plans")
    .select("id, status, plan_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || row.status !== "ready" || !row.plan_data) return { changed: false };

  const planData = row.plan_data as unknown as MealPlan;
  const existing = planData.workouts ?? [];
  const haveIds = new Set(existing.map((w) => w.member_id));
  // Only attach for members who are actually in this plan (skip tier-deferred ones).
  const planMemberIds = new Set((planData.members ?? []).map((m) => m.member_id));

  let context;
  try {
    context = await buildPlanContext(supabase, user.id);
  } catch {
    return { changed: false }; // gated / onboarding incomplete → nothing to do
  }

  // Empty skeleton → the deterministic fallback fires for each eligible (opted-in,
  // non-clearance, non-child) member; clearance-withheld members yield nothing.
  const computed = buildWorkoutsFromSkeleton(context, { members: [] });
  const missing = computed.filter(
    (w) => !haveIds.has(w.member_id) && planMemberIds.has(w.member_id),
  );
  if (missing.length === 0) return { changed: false };

  const nextPlan: MealPlan = { ...planData, workouts: [...existing, ...missing] };
  const { error } = await supabase
    .from("meal_plans")
    .update({ plan_data: nextPlan as unknown as Json })
    .eq("id", row.id);
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "plan", step: "ensurePlanWorkouts", userId: user.id },
    });
    return { changed: false };
  }

  revalidatePath("/plan");
  return { changed: true };
}
