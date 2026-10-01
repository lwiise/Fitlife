import "server-only";

import { unstable_cache } from "next/cache";
import {
  ADMIN_DATASET_TTL_SECONDS,
  ADMIN_ENGAGEMENT_TAG,
  readWithinMaxAge,
} from "./freshness";
import { adminDb } from "./db";

/**
 * Engagement-layer observability (Sprint 4). The layer's success metric is
 * renewal-1 retention; these counters tell the operator whether the loop that
 * should move it is actually being used.
 *
 * Pre-00017 prod (the engagement tables not created yet) reports zeros with
 * `eventsAvailable: false` rather than erroring the admin overview. Any OTHER
 * failed read throws: a blip is not a missing migration, and the overview
 * shows «—» for figures it could not read rather than zeros it would have to
 * pass off as real.
 */
export interface EngagementStats {
  /** False until migration 00017 exists in prod. */
  eventsAvailable: boolean;
  /** Distinct MEALS checked in (user, local_date, slot) — rows are per person
   * since 00019, so a raw row count would scale with household size. */
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

/**
 * The codes PostgREST answers a table that does not exist with: Postgres's
 * undefined_table, and PostgREST's own "not in the schema cache" (12+).
 */
const MISSING_TABLE_CODES: ReadonlySet<string> = new Set(["42P01", "PGRST205"]);

interface ReadError {
  message: string;
  code?: string;
}

/** The engagement table is not there yet (pre-00017) — the one error that is a state, not a failure. */
export function isMissingTable(error: ReadError | null | undefined): boolean {
  return !!error && MISSING_TABLE_CODES.has(error.code ?? "");
}

/**
 * Throws on a failed read, unless `tolerateMissingTable` and the table does
 * not exist yet. A thrown error is never cached (unstable_cache stores only
 * what the function returns), so the next load reads again instead of
 * serving the blip as data for a minute or more.
 */
function check(label: string, error: ReadError | null, tolerateMissingTable: boolean): void {
  if (!error) return;
  if (tolerateMissingTable && isMissingTable(error)) return;
  throw new Error(`admin engagement ${label}: ${error.message}`);
}

async function fetchEngagementStats(): Promise<EngagementStats> {
  const db = adminDb();
  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [checkinRows, verdicts, weighIns, plans, subs] =
    await Promise.all([
      // One fetch feeds both counters. Rows are per person since 00019, so
      // the meal counter dedupes on (user, local_date, slot) — 2000 rows
      // covers well past the current scale; revisit when it doesn't.
      db
        .from("meal_checkins")
        .select("user_id,local_date,slot")
        .gte("created_at", sinceIso)
        .limit(2000),
      // Counts are HEAD requests: a table that does not exist answers 404 with
      // no body, which supabase-js reports as no error and a null count.
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

  check("meal_checkins", checkinRows.error, true);
  check("meal_verdicts", verdicts.error, true);
  check("body_logs", weighIns.error, true);
  check("meal_plans", plans.error, false);
  check("subscriptions", subs.error, false);

  const eventsAvailable = !checkinRows.error;

  const rows = (checkinRows.data ?? []) as Array<{
    user_id: string;
    local_date: string;
    slot: string;
  }>;
  const distinctUsers = new Set(rows.map((r) => r.user_id));
  const distinctMeals = new Set(
    rows.map((r) => `${r.user_id}|${r.local_date}|${r.slot}`),
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
    checkins7d: distinctMeals.size,
    activeCheckinHouseholds7d: distinctUsers.size,
    verdicts7d: verdicts.count ?? 0,
    weighIns7d: weighIns.count ?? 0,
    plansWithChangesPct,
    paidTotal: subRows.length,
    renewedOnce,
  };
}

/**
 * Cached like the admin dataset: request-independent (service-role client), so
 * one read a minute serves every overview load instead of five queries per
 * navigation, and like it never served once more than two TTLs old. The value
 * is plain JSON. `revalidateTag("admin-engagement")` force-refreshes; erasing
 * an account expires it (ADMIN_HOUSEHOLD_CACHE_TAGS).
 */
interface CachedEngagement {
  stats: EngagementStats;
  /** When the counters were read (ISO). */
  loadedAt: string;
}

async function fetchCachedEngagement(): Promise<CachedEngagement> {
  const loadedAt = new Date().toISOString();
  return { stats: await fetchEngagementStats(), loadedAt };
}

const cachedEngagement = unstable_cache(fetchCachedEngagement, ["admin-engagement", "v2"], {
  revalidate: ADMIN_DATASET_TTL_SECONDS,
  tags: [ADMIN_ENGAGEMENT_TAG],
});

export async function loadEngagementStats(): Promise<EngagementStats> {
  const read = await readWithinMaxAge(
    cachedEngagement,
    fetchCachedEngagement,
    ADMIN_DATASET_TTL_SECONDS,
  );
  return read.stats;
}
