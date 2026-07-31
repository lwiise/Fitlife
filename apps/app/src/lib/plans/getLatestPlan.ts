import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MealPlanSchema, type MealPlan } from "@fitlife/plan-engine";

import { resolveStaleness, STALE_GENERATION_MIN } from "./staleness";
import { workerAckedFromPlanData } from "./generationTiming";

export { STALE_GENERATION_MIN };

export interface LatestPlanSummary {
  id: string;
  status: "generating" | "ready" | "failed";
  plan_data: MealPlan | null;
  week_start_date: string | null;
  member_count: number;
  member_ids: string[];
  in_progress: boolean; // still generating later days (progressive rendering)
  /**
   * Whether the background worker ever acknowledged the invocation for this row.
   * False on a 'generating' row means we have no evidence the worker ran at all
   * — the state a rejected shared secret or a missing key produces, which the
   * dispatcher cannot see because Netlify answers a background function with 202
   * before the handler runs.
   */
  worker_acked: boolean;
  error_message: string | null;
  updated_at: string;
}

/**
 * Get the user's most recent plan (any status). Returns null if none exists.
 *
 * If status is 'ready' but `plan_data` fails Zod validation (e.g. the AI returned
 * a shape that's slightly off), we surface it as 'failed' with `plan_data: null`
 * — the UI's failed branch will let the user retry rather than rendering broken
 * content.
 */
type MealPlanRow = {
  id: string;
  status: string;
  plan_data: unknown;
  generated_at: string | null;
  error_message: string | null;
  updated_at: string;
};

export async function getLatestPlan(userId: string): Promise<LatestPlanSummary | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, status, plan_data, generated_at, error_message, updated_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<MealPlanRow[]>();

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  if (!row) return null;

  const rawStatus = row.status as "generating" | "ready" | "failed" | "archived";
  if (rawStatus === "archived") return null;

  let validatedPlanData: MealPlan | null = null;
  let finalStatus: "generating" | "ready" | "failed" = rawStatus;

  if (rawStatus === "ready") {
    const result = MealPlanSchema.safeParse(row.plan_data);
    if (result.success) {
      validatedPlanData = result.data;
      finalStatus = "ready";
    } else {
      console.warn("[getLatestPlan] plan_data failed Zod validation; surfacing as failed", {
        planId: row.id,
        issues: result.error.issues.slice(0, 5),
      });
      finalStatus = "failed";
    }
  }

  // Dead-man's switch: if the background function was hard-killed at its 15-min
  // budget, its catch never ran, so the row sits in 'generating' (or in a
  // 'ready' shell still flagged generating, or a 'ready' shell with no meals at
  // all) forever and the viewer shows a perpetual loader. (Read-time only — the
  // DB row is left as-is.) Staleness is measured off updated_at: an actively-
  // progressing shell rewrites plan_data every day, so it stays fresh; only a
  // dead one goes stale. The rule — and, crucially, that a partial week is KEPT
  // rather than discarded — lives in resolveStaleness so it can be tested.
  //
  // Second, sharper question: did the worker ever acknowledge the invocation at
  // all? It stamps `worker_ack_at` into plan_data before any model call, so on a
  // 'generating' row the ABSENCE of any write means the run never started — the
  // state a rejected shared secret or a missing key produces, and one the
  // dispatcher cannot see because Netlify answers a background function with 202
  // before the handler runs. "Nothing ever wrote" is exactly "plan_data is still
  // the empty object createPlanRows inserted"; any key at all — the ACK, or a
  // real snapshot — means the worker reached the DB. Anything unreadable counts
  // as ACKed, so a degraded read can only ever be too patient, never falsely
  // fail a live run.
  const workerAcked = workerAckedFromPlanData(row.plan_data);

  const resolved = resolveStaleness({
    status: finalStatus,
    planData: validatedPlanData,
    updatedAt: row.updated_at,
    errorMessage: row.error_message ?? null,
    workerAcked,
  });

  return {
    id: row.id,
    status: resolved.status,
    plan_data: resolved.planData,
    week_start_date: resolved.planData?.week_start_date ?? null,
    member_count: resolved.planData?.members.length ?? 0,
    member_ids: resolved.planData?.members.map((m) => m.member_id) ?? [],
    in_progress: resolved.inProgress,
    worker_acked: workerAcked,
    error_message: resolved.errorMessage,
    updated_at: row.updated_at,
  };
}
