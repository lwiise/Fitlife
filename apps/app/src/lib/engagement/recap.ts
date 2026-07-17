import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { planHasContent, type MealPlan } from "@fitlife/plan-engine";
import { riyadhTodayISO } from "@/lib/plans/dayMapping";
import { getLatestPlan } from "@/lib/plans/getLatestPlan";

// رسالتك الأسبوعية — deterministic template-and-numbers recap (v1 has NO model
// call; Sara's prose is a later tier upgrade). Aggregation keys on local_date —
// the universal calendar key — so a mid-week regeneration never splits a week.
//
// Data-honesty contract: unanswered days render as unknown (never "skipped"),
// a zero-event week is an honest BASELINE week (never an empty accusation),
// and weight_delta_kg is PRIVATE — it must never reach the share text builder.

export interface RecapCheckinRow {
  local_date: string;
  slot: string;
  status: string;
  reason: string | null;
}

export interface RecapVerdictRow {
  recipe_name_ar: string;
  canonical_key: string;
  verdict: string;
}

export type DayCellState = "guest" | "cooked" | "logged" | "unknown";

export interface WeeklyRecap {
  week_start: string;
  /** 7 cells, index 0 = week_start. Gold guest days outrank cooked. */
  day_cells: Array<{ local_date: string; state: DayCellState }>;
  logged_days: number;
  cooked_days: number;
  guest_days: number;
  meals_planned: number;
  members_count: number;
  languages_count: number;
  /** Most-loved dish of the window, if any verdict landed. */
  top_dish: { recipe_name_ar: string; loved_count: number } | null;
  /** PRIVATE. Latest minus previous mom weigh-in, kg. Never shared. */
  weight_delta_kg: number | null;
  /** True when no events landed — letter renders the baseline framing. */
  baseline: boolean;
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeWeeklyRecap(input: {
  plan: MealPlan;
  checkins: RecapCheckinRow[];
  verdicts: RecapVerdictRow[];
  /** Mom's recent weigh-ins, newest first. */
  weights: Array<{ recorded_on: string; weight_kg: number | null }>;
}): WeeklyRecap {
  const { plan, checkins, verdicts, weights } = input;
  const weekStart = plan.week_start_date;

  const byDate = new Map<string, RecapCheckinRow[]>();
  for (const c of checkins) {
    const list = byDate.get(c.local_date) ?? [];
    list.push(c);
    byDate.set(c.local_date, list);
  }

  const day_cells = Array.from({ length: 7 }, (_, i) => {
    const local_date = addDaysISO(weekStart, i);
    const rows = byDate.get(local_date);
    let state: DayCellState = "unknown";
    if (rows && rows.length > 0) {
      if (rows.some((r) => r.reason === "guests")) state = "guest";
      else if (rows.some((r) => r.status === "cooked")) state = "cooked";
      else state = "logged";
    }
    return { local_date, state };
  });

  const meals_planned = plan.members.reduce(
    (acc, m) => acc + m.days.reduce((a, d) => a + d.meals.length, 0),
    0,
  );
  const hasTranslations = plan.members.some((m) =>
    m.days.some((d) =>
      d.meals.some(
        (meal) => (meal.prep_steps_translated?.length ?? 0) > 0,
      ),
    ),
  );

  const lovedByKey = new Map<string, { recipe_name_ar: string; loved: number }>();
  for (const v of verdicts) {
    if (v.verdict !== "loved" || !v.canonical_key) continue;
    const e = lovedByKey.get(v.canonical_key) ?? {
      recipe_name_ar: v.recipe_name_ar,
      loved: 0,
    };
    e.loved++;
    lovedByKey.set(v.canonical_key, e);
  }
  const top = [...lovedByKey.values()].sort((a, b) => b.loved - a.loved)[0];

  const weightVals = weights
    .map((w) => w.weight_kg)
    .filter((v): v is number => typeof v === "number");
  const weight_delta_kg =
    weightVals.length >= 2 ? Number((weightVals[0]! - weightVals[1]!).toFixed(1)) : null;

  const logged_days = day_cells.filter((c) => c.state !== "unknown").length;
  return {
    week_start: weekStart,
    day_cells,
    logged_days,
    cooked_days: day_cells.filter((c) => c.state === "cooked" || c.state === "guest")
      .length,
    guest_days: day_cells.filter((c) => c.state === "guest").length,
    meals_planned,
    members_count: plan.members.length,
    languages_count: hasTranslations ? 2 : 1,
    top_dish: top ? { recipe_name_ar: top.recipe_name_ar, loved_count: top.loved } : null,
    weight_delta_kg,
    baseline: checkins.length === 0 && verdicts.length === 0,
  };
}

// buildShareText moved to ./shareText — it is imported by a client component,
// and this module's server-only imports (getLatestPlan → supabase/server)
// must never enter a client bundle. Re-exported for server-side callers.
export { buildShareText } from "./shareText";

/**
 * Fetch + aggregate the latest plan's week. Best-effort on the 00017 tables
 * (pre-apply prod → empty events → honest baseline letter). Returns null when
 * there is no usable plan at all.
 */
export async function fetchWeeklyRecap(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WeeklyRecap | null> {
  const latest = await getLatestPlan(userId);
  const plan = latest?.plan_data;
  if (!plan || !planHasContent(plan)) return null;

  const client = supabase;
  const weekStart = plan.week_start_date;
  const weekEnd = addDaysISO(weekStart, 6);
  // Verdicts carry no local_date; created_at from week start is close enough
  // for the letter's "dish of the week".
  const sinceIso = `${weekStart}T00:00:00Z`;

  const [checkins, verdicts, weights] = await Promise.all([
    client
      .from("meal_checkins")
      .select("local_date,slot,status,reason")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd)
      .limit(200),
    client
      .from("meal_verdicts")
      .select("recipe_name_ar,canonical_key,verdict")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .limit(400),
    client
      .from("body_logs")
      .select("recorded_on,weight_kg")
      .eq("user_id", userId)
      .eq("member_id", "mom")
      .lte("recorded_on", riyadhTodayISO())
      .order("recorded_on", { ascending: false })
      .limit(8),
  ]);

  return computeWeeklyRecap({
    plan,
    checkins: (checkins.data ?? []) as RecapCheckinRow[],
    verdicts: (verdicts.data ?? []) as RecapVerdictRow[],
    weights: (weights.data ?? []) as Array<{
      recorded_on: string;
      weight_kg: number | null;
    }>,
  });
}
