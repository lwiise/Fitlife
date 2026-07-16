import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * ذاكرة مائدتكم — the household's accumulated, factual record. Used at the
 * two moments where sunk value honestly matters: the renewal-week recap card
 * and the cancel dialog. Counts only; no drama, no invented SAR math.
 */
export interface FamilyLedger {
  /** Weekly plans ever generated for this house (incl. archived history). */
  planWeeks: number;
  /** Mom + beneficiaries (housekeeper excluded — she's the cook). */
  membersServed: number;
  /** ISO date of the first plan, for «منذ …» framing. Null pre-first-plan. */
  since: string | null;
}

/** True within the last `days` before a period end — the renewal window. */
export function isWithinRenewalWindow(
  currentPeriodEnd: string,
  days = 7,
): boolean {
  const remainingMs = new Date(currentPeriodEnd).getTime() - Date.now();
  return remainingMs > 0 && remainingMs <= days * 24 * 60 * 60 * 1000;
}

export async function loadFamilyLedger(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<FamilyLedger> {
  const [plans, firstPlan, members] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("meal_plans")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("family_members")
      .select("id,role")
      .eq("user_id", userId),
  ]);

  const beneficiaries = (members.data ?? []).filter(
    (m) => m.role !== "housekeeper",
  ).length;

  return {
    planWeeks: plans.count ?? 0,
    membersServed: beneficiaries + 1,
    since: firstPlan.data?.created_at?.slice(0, 10) ?? null,
  };
}
