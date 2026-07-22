import { cache } from "react";
import { createClient, getAuthUser } from "./server";
import type { Database } from "./database.types";
import { getLatestPlan, type LatestPlanSummary } from "@/lib/plans/getLatestPlan";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type FamilyMember = Database["public"]["Tables"]["family_members"]["Row"];

// These getters are React.cache-memoized: a page, its layout, and shared
// helpers can all ask for the same data in one request without repeating the
// Supabase query. The auth round-trip is deduped further down via getAuthUser.

/**
 * Get the current authenticated user's profile.
 * Returns null if not authenticated or profile not found.
 */
export const getCurrentUserProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;
  return profile;
});

/**
 * Get the current user's family members, ordered by display_order.
 */
export const getCurrentUserFamilyMembers = cache(
  async (): Promise<FamilyMember[]> => {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .eq("user_id", user.id)
      .order("display_order", { ascending: true });

    if (error) return [];
    return data;
  },
);

/**
 * Get the current user's most recent plan regardless of status.
 * Returns null if no plan exists.
 */
export const getCurrentUserLatestPlan = cache(
  async (): Promise<LatestPlanSummary | null> => {
    const user = await getAuthUser();
    if (!user) return null;
    return getLatestPlan(user.id);
  },
);

/**
 * Check if user has hit the weekly plan generation rate limit.
 * Returns true if they can generate, false if rate-limited.
 */
export async function canGeneratePlan(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Count DISTINCT meal_plan_id, not raw rows: a plan can have more than one
  // 'completed' plan_generations row (e.g. a housekeeper-translation audit row
  // shares the plan's meal_plan_id), and those must not consume generation
  // slots. One generated plan === one slot regardless of translation passes.
  const { data, error } = await supabase
    .from("plan_generations")
    .select("meal_plan_id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("created_at", oneWeekAgo.toISOString());

  if (error) return false;
  const distinctPlans = new Set(
    (data ?? [])
      .map((r) => (r as { meal_plan_id: string | null }).meal_plan_id)
      .filter((id): id is string => id != null),
  );

  // Per-member regenerations have their OWN weekly quota (see
  // countMemberRegensThisWeek) and must NOT consume the shared new-plan pool.
  // Subtract any plan in this window that was a manual per-member regenerate
  // (plan_data.regenerated_for set). meal_plans.id === plan_generations.meal_plan_id.
  const { data: regenRows, error: regenError } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", oneWeekAgo.toISOString())
    .not("plan_data->>regenerated_for", "is", null);
  if (!regenError && regenRows) {
    for (const r of regenRows as { id: string }[]) distinctPlans.delete(r.id);
  }

  return distinctPlans.size < 3;
}

/**
 * Count this member's MANUAL regenerations in the last 7 days. Each regenerate
 * creates a new meal_plan tagged with plan_data.regenerated_for = member_id, so a
 * rolling-window count of non-failed plans carrying that tag is the per-member
 * regen usage. Drives the per-member weekly regen quota (3). Best-effort: returns
 * 0 on error so a transient read never blocks the user.
 */
export async function countMemberRegensThisWeek(
  userId: string,
  memberId: string,
): Promise<number> {
  const supabase = await createClient();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { count, error } = await supabase
    .from("meal_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneWeekAgo.toISOString())
    .neq("status", "failed")
    .filter("plan_data->>regenerated_for", "eq", memberId);

  if (error) return 0;
  return count ?? 0;
}
