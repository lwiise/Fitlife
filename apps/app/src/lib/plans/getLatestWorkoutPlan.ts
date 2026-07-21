import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  WorkoutPlanSchema,
  workoutPlanHasContent,
  type WorkoutPlan,
} from "@fitlife/plan-engine";
import { STALE_GENERATION_MIN } from "@/lib/plans/getLatestPlan";

export interface LatestWorkoutPlanSummary {
  id: string;
  status: "generating" | "ready" | "failed";
  plan_data: WorkoutPlan | null;
  member_ids: string[];
  in_progress: boolean;
  error_message: string | null;
  updated_at: string;
}

type WorkoutPlanRow = {
  id: string;
  status: string;
  plan_data: unknown;
  error_message: string | null;
  updated_at: string;
};

/**
 * The user's most recent workout plan (any status; archived excluded).
 * Mirrors getLatestPlan's discipline: Zod re-validation downgrades a broken
 * 'ready' row to failed, and the read-time dead-man's switch reclassifies a
 * stale in-flight row so the UI's retry branch fires.
 */
export async function getLatestWorkoutPlan(
  userId: string,
): Promise<LatestWorkoutPlanSummary | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workout_plans")
    .select("id, status, plan_data, error_message, updated_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<WorkoutPlanRow[]>();

  if (error || !data || data.length === 0) return null;
  const row = data[0];
  if (!row) return null;

  const rawStatus = row.status as "generating" | "ready" | "failed" | "archived";
  if (rawStatus === "archived") return null;

  let validated: WorkoutPlan | null = null;
  let finalStatus: "generating" | "ready" | "failed" = rawStatus;

  if (rawStatus === "ready") {
    const result = WorkoutPlanSchema.safeParse(row.plan_data);
    if (result.success) {
      validated = result.data;
    } else {
      console.warn(
        "[getLatestWorkoutPlan] plan_data failed Zod validation; surfacing as failed",
        { planId: row.id, issues: result.error.issues.slice(0, 5) },
      );
      finalStatus = "failed";
    }
  }

  const updatedMs = Date.parse(row.updated_at);
  const ageMin = Number.isNaN(updatedMs) ? Infinity : (Date.now() - updatedMs) / 60_000;
  const planEmpty =
    finalStatus === "ready" && (!validated || !workoutPlanHasContent(validated));
  const stillInFlight =
    finalStatus === "generating" ||
    (finalStatus === "ready" && validated?.generating === true) ||
    planEmpty;
  let errorMessage = row.error_message ?? null;
  if (stillInFlight && ageMin >= STALE_GENERATION_MIN) {
    console.warn("[getLatestWorkoutPlan] stale in-flight plan; surfacing as failed", {
      planId: row.id,
      ageMin: Math.round(ageMin),
    });
    finalStatus = "failed";
    validated = null;
    errorMessage = errorMessage ?? "تعذّر إكمال إنشاء خطة التمارين. يرجى المحاولة مرة أخرى.";
  }

  return {
    id: row.id,
    status: finalStatus,
    plan_data: validated,
    member_ids: validated?.members.map((m) => m.member_id) ?? [],
    in_progress: validated?.generating === true,
    error_message: errorMessage,
    updated_at: row.updated_at,
  };
}
