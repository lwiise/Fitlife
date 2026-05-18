import { createClient } from "./server";
import type { Database } from "./database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type FamilyMember = Database["public"]["Tables"]["family_members"]["Row"];
type MealPlan = Database["public"]["Tables"]["meal_plans"]["Row"];
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

/**
 * Get the current authenticated user's profile.
 * Returns null if not authenticated or profile not found.
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;
  return profile;
}

/**
 * Get the current user's family members, ordered by display_order.
 */
export async function getCurrentUserFamilyMembers(): Promise<FamilyMember[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true });

  if (error) return [];
  return data;
}

/**
 * Get the current user's active meal plan (most recent ready plan).
 */
export async function getCurrentUserMealPlan(): Promise<MealPlan | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get the current user's active subscription.
 * Returns null if no active subscription (free trial counts as active).
 */
export async function getCurrentUserSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["on_trial", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Check if user has hit the weekly plan generation rate limit.
 * Returns true if they can generate, false if rate-limited.
 */
export async function canGeneratePlan(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { count, error } = await supabase
    .from("plan_generations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "success")
    .gte("created_at", oneWeekAgo.toISOString());

  if (error) return false;
  return (count ?? 0) < 3;
}
