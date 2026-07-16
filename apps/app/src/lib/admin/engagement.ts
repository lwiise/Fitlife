import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { adminDb } from "./db";

/**
 * Engagement-layer observability (Sprint 4). The layer's success metric is
 * renewal-1 retention; these counters tell the operator whether the loop that
 * should move it is actually being used.
 *
 * All 00017-table probes are tolerant: pre-apply prod reports zeros with
 * `eventsAvailable: false` rather than erroring the admin overview.
 */
export interface EngagementStats {
  /** False until migration 00017 exists in prod. */
  eventsAvailable: boolean;
  checkins7d: number;
  activeCheckinHouseholds7d: number;
  verdicts7d: number;
  weighIns7d: number;
  /** Share of recent ready plans carrying week_changes (null = no plans). */
  plansWithChangesPct: number | null;
  /** Renewal-1 proxy: paid subs that crossed ≥1 renewal / all paid subs. */
  paidTotal: number;
  renewedOnce: number;
}

const WINDOW_DAYS = 7;
/** Days after signup before a monthly sub's period start implies a renewal. */
const RENEWAL_PROXY_DAYS = 20;

export async function loadEngagementStats(): Promise<EngagementStats> {
  const db = adminDb() as unknown as SupabaseClient;
  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [checkins, checkinUsers, verdicts, weighIns, plans, subs] =
    await Promise.all([
      db
        .from("meal_checkins")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sinceIso),
      db
        .from("meal_checkins")
        .select("user_id")
        .gte("created_at", sinceIso)
        .limit(2000),
      db
        .from("meal_verdicts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sinceIso),
      db
        .from("body_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sinceIso),
      db
        .from("meal_plans")
        .select("plan_data->week_changes")
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(25),
      db
        .from("subscriptions")
        .select("created_at,current_period_start,lemonsqueezy_subscription_id,status")
        .not("lemonsqueezy_subscription_id", "is", null)
        .limit(2000),
    ]);

  const eventsAvailable = !checkins.error;

  const distinctUsers = new Set(
    ((checkinUsers.data ?? []) as Array<{ user_id: string }>).map(
      (r) => r.user_id,
    ),
  );

  const planRows = (plans.data ?? []) as Array<{ week_changes: unknown }>;
  const plansWithChangesPct =
    planRows.length > 0
      ? Math.round(
          (planRows.filter(
            (p) => Array.isArray(p.week_changes) && p.week_changes.length > 0,
          ).length /
            planRows.length) *
            100,
        )
      : null;

  const subRows = (subs.data ?? []) as Array<{
    created_at: string;
    current_period_start: string | null;
    status: string;
  }>;
  const renewedOnce = subRows.filter((s) => {
    if (!s.current_period_start) return false;
    const created = new Date(s.created_at).getTime();
    const periodStart = new Date(s.current_period_start).getTime();
    return periodStart - created > RENEWAL_PROXY_DAYS * 24 * 60 * 60 * 1000;
  }).length;

  return {
    eventsAvailable,
    checkins7d: checkins.count ?? 0,
    activeCheckinHouseholds7d: distinctUsers.size,
    verdicts7d: verdicts.count ?? 0,
    weighIns7d: weighIns.count ?? 0,
    plansWithChangesPct,
    paidTotal: subRows.length,
    renewedOnce,
  };
}
