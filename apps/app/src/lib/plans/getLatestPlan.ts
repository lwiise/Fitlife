import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MealPlanSchema, type MealPlan } from "@fitlife/plan-engine";

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

  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, status, plan_data, generated_at, error_message, updated_at")
    .eq("user_id", userId)
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

  return {
    id: row.id,
    status: finalStatus,
    plan_data: validatedPlanData,
    week_start_date: validatedPlanData?.week_start_date ?? null,
    member_count: validatedPlanData?.members.length ?? 0,
    member_ids: validatedPlanData?.members.map((m) => m.member_id) ?? [],
    in_progress: validatedPlanData?.generating === true,
    error_message: row.error_message ?? null,
    updated_at: row.updated_at,
  };
}
