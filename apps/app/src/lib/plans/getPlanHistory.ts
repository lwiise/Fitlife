import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MealPlanSchema, type MealPlan } from "@fitlife/plan-engine";
import {
  applyMemberDisplayNames,
  type MemberNameRoster,
} from "./memberNames";

/** Current roster names (mom + family members) to overlay onto a stored plan
 *  snapshot, so history shows the member's CURRENT name after a rename. */
async function fetchNameRoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<MemberNameRoster> {
  const [prof, members] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle<{ display_name: string | null }>(),
    supabase
      .from("family_members")
      .select("id, name")
      .eq("user_id", userId)
      .returns<Array<{ id: string; name: string | null }>>(),
  ]);
  return {
    mom: { display_name: prof.data?.display_name ?? null },
    members: members.data ?? [],
  };
}

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
  // member_id → stable hash of THAT member's slice of plan_data, so the
  // per-member view can hide carry-over rows identical to the member's current
  // plan (a "phantom old plan" created by generating for someone else).
  membersHash: Record<string, string>;
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

  const roster = await fetchNameRoster(supabase, userId);

  const items: PlanHistoryItem[] = [];
  for (const row of data) {
    const parsed = MealPlanSchema.safeParse(row.plan_data);
    if (!parsed.success) continue;
    // Display the CURRENT roster names; the membersHash below stays on the RAW
    // snapshot so the per-member "phantom old plan" dedup is unaffected.
    const named = applyMemberDisplayNames(parsed.data, roster);
    items.push({
      id: row.id,
      weekStartDate: parsed.data.week_start_date,
      generatedAt: row.generated_at,
      createdAt: row.created_at,
      memberCount: parsed.data.members.length,
      memberIds: parsed.data.members.map((m) => m.member_id),
      memberNames: named.members.map((m) => m.member_name_ar),
      hiddenForMemberIds: parsed.data.hidden_for_member_ids ?? [],
      membersHash: Object.fromEntries(
        parsed.data.members.map((m) => [m.member_id, JSON.stringify(m)]),
      ),
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

  // Overlay current roster names so a rename shows in the read-only view too.
  const roster = await fetchNameRoster(supabase, userId);
  const plan = applyMemberDisplayNames(parsed.data, roster);

  return { id: data.id, plan, isCurrent: newest?.id === data.id };
}
