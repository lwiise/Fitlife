import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MealPlanSchema, planHasContent, type MealPlan } from "@fitlife/plan-engine";

import { resolveStaleness, STALE_GENERATION_MIN } from "./staleness";

export { STALE_GENERATION_MIN };

export interface LatestPlanSummary {
  id: string;
  status: "generating" | "ready" | "failed";
  plan_data: MealPlan | null;
  week_start_date: string | null;
  member_count: number;
  member_ids: string[];
  in_progress: boolean; // still generating later days (progressive rendering)
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

  // Two rows, not one: a regeneration that produces NOTHING must not be allowed
  // to hide the week the household already has. Adding a third member triggers a
  // full shared-group rebuild, and when that run came back empty (see the
  // skeleton budget clamp in plan-engine/generate.ts) the failed row — being
  // newest — replaced a complete 7/7 plan with an error screen on every surface.
  // The good plan was never deleted, only shadowed. Falling back to it costs
  // nothing when the newest row is healthy, because then it is never consulted.
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, status, plan_data, generated_at, error_message, updated_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(2)
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
  const resolved = resolveStaleness({
    status: finalStatus,
    planData: validatedPlanData,
    updatedAt: row.updated_at,
    errorMessage: row.error_message ?? null,
  });

  // The newest run died with nothing to show. If the previous plan is still
  // usable, serve THAT — a stale week beats an error screen, and it keeps the
  // drain's `status === "ready"` precondition satisfiable so the household can
  // recover without the customer doing anything.
  if (resolved.status === "failed" && !resolved.planData && data.length > 1) {
    const prev = data[1];
    if (prev && prev.status === "ready") {
      const prevParsed = MealPlanSchema.safeParse(prev.plan_data);
      if (prevParsed.success && planHasContent(prevParsed.data)) {
        const prevResolved = resolveStaleness({
          status: "ready",
          planData: prevParsed.data,
          updatedAt: prev.updated_at,
          errorMessage: null,
        });
        if (prevResolved.planData) {
          console.warn(
            "[getLatestPlan] newest plan failed with no content; serving the previous ready plan",
            { failedId: row.id, servingId: prev.id },
          );
          return {
            id: prev.id,
            status: prevResolved.status,
            plan_data: prevResolved.planData,
            week_start_date: prevResolved.planData.week_start_date ?? null,
            member_count: prevResolved.planData.members.length,
            member_ids: prevResolved.planData.members.map((m) => m.member_id),
            in_progress: prevResolved.inProgress,
            error_message: prevResolved.errorMessage,
            updated_at: prev.updated_at,
          };
        }
      }
    }
  }

  return {
    id: row.id,
    status: resolved.status,
    plan_data: resolved.planData,
    week_start_date: resolved.planData?.week_start_date ?? null,
    member_count: resolved.planData?.members.length ?? 0,
    member_ids: resolved.planData?.members.map((m) => m.member_id) ?? [],
    in_progress: resolved.inProgress,
    error_message: resolved.errorMessage,
    updated_at: row.updated_at,
  };
}
