import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  computeEngagementDigest,
  type EngagementCheckinRow,
  type EngagementDigest,
  type EngagementVerdictRow,
} from "@fitlife/plan-engine";

// Recent-window aggregation source for «خطة تشبهك». Two weeks covers the
// current plan plus the tail of the previous one across regen boundaries.
const WINDOW_DAYS = 14;
const ROW_CAP = 400;

/**
 * Fetch and aggregate the household's recent check-ins/verdicts into the
 * generation digest. BEST-EFFORT BY CONTRACT: any failure — 00017 not yet
 * applied to prod, RLS hiccup, network — returns undefined and generation
 * proceeds exactly as before the engagement layer existed.
 */
export async function fetchEngagementDigest(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<EngagementDigest | undefined> {
  try {
    const client = supabase;
    const since = new Date(
      Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [checkins, verdicts] = await Promise.all([
      client
        .from("meal_checkins")
        .select("slot,status,reason")
        .eq("user_id", userId)
        .gte("created_at", since)
        .limit(ROW_CAP),
      client
        .from("meal_verdicts")
        .select("recipe_name_ar,canonical_key,verdict")
        .eq("user_id", userId)
        .gte("created_at", since)
        .limit(ROW_CAP),
    ]);
    if (checkins.error || verdicts.error) return undefined;

    return computeEngagementDigest(
      (checkins.data ?? []) as EngagementCheckinRow[],
      (verdicts.data ?? []) as EngagementVerdictRow[],
    );
  } catch {
    return undefined;
  }
}
