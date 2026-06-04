import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MealPlanSchema, type MealPlan } from "@fitlife/plan-engine";

export interface PlanHistoryItem {
  id: string;
  weekStartDate: string | null;
  generatedAt: string | null;
  createdAt: string;
  memberCount: number;
  memberIds: string[];
  memberNames: string[];
  // member_ids for whom this plan has been de-listed (per-member delete).
  hiddenForMemberIds: string[];
  isCurrent: boolean;
}

type HistoryRow = {
  id: string;
  status: string;
  plan_data: unknown;
  generated_at: string | null;
  created_at: string;
};

/**
 * All of the user's completed plans, newest first. The newest is the "current"
 * one (what getLatestPlan shows). Rows whose plan_data fails validation are
 * skipped. RLS scopes the query to the user; the explicit user_id is belt-and-suspenders.
 */
export async function getPlanHistory(userId: string): Promise<PlanHistoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, status, plan_data, generated_at, created_at")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .returns<HistoryRow[]>();

  if (error || !data) return [];

  const items: PlanHistoryItem[] = [];
  for (const row of data) {
    const parsed = MealPlanSchema.safeParse(row.plan_data);
    if (!parsed.success) continue;
    items.push({
      id: row.id,
      weekStartDate: parsed.data.week_start_date,
      generatedAt: row.generated_at,
      createdAt: row.created_at,
      memberCount: parsed.data.members.length,
      memberIds: parsed.data.members.map((m) => m.member_id),
      memberNames: parsed.data.members.map((m) => m.member_name_ar),
      hiddenForMemberIds: parsed.data.hidden_for_member_ids ?? [],
      isCurrent: false,
    });
  }
  if (items[0]) items[0].isCurrent = true;
  return items;
}

/** A single owned plan, for the read-only history view. */
export async function getPlanById(
  userId: string,
  planId: string,
): Promise<{ id: string; plan: MealPlan; isCurrent: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, status, plan_data")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle<HistoryRow>();

  if (error || !data || data.status !== "ready") return null;
  const parsed = MealPlanSchema.safeParse(data.plan_data);
  if (!parsed.success) return null;

  // Current = the newest ready plan; Restore is hidden for it.
  const { data: newest } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return { id: data.id, plan: parsed.data, isCurrent: newest?.id === data.id };
}
