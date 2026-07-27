import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO } from "@/lib/plans/dayMapping";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
  getCurrentUserLatestPlan,
} from "@/lib/supabase/queries";
import { getLatestWorkoutPlan } from "@/lib/plans/getLatestWorkoutPlan";
import {
  isGoalCelebrationEligibleMember,
  isGoalCelebrationEligibleOwner,
} from "./eligibility";
import { hasReachedWeightGoal } from "./goalMilestone";
import {
  collapseMealMarks,
  collapseWorkoutMarks,
  dayHasCookedMark,
  isISODate,
  workoutMarkingWindow,
  type PlannedTotals,
  type RawSeasonMealRow,
  type RawSeasonWorkoutRow,
} from "./seasonMath";
import { genderPick } from "@/lib/copy/gender";

type Profile = NonNullable<Awaited<ReturnType<typeof getCurrentUserProfile>>>;
type FamilyMembers = Awaited<ReturnType<typeof getCurrentUserFamilyMembers>>;
type LatestPlan = Awaited<ReturnType<typeof getCurrentUserLatestPlan>>;
type WorkoutPlan = Awaited<ReturnType<typeof getLatestWorkoutPlan>>;

/** Everything the «موسم بيتنا» leaderboard (`FamilySeasonCard`) needs. */
export interface FamilySeasonProps {
  members: Array<{ id: string; name: string; sex?: string | null }>;
  /** Calendar-collapsed meal marks (one row per date+slot+member, day_index
   * re-derived from local_date — survives same-week plan re-mints). */
  checkins: Array<{
    day_index: number;
    slot: string;
    status?: string;
    member_id?: string | null;
  }>;
  workoutCheckins: Array<{
    day_index?: number;
    member_id?: string | null;
    status: string;
    /** Server-stamped session date — scopes the weekday-anchored mark to the
     * current marking week (the leaderboard drops rows without it). */
    local_date?: string | null;
  }>;
  goalReached: Array<{ id: string; name: string }>;
  /** Per-member weekly plan totals — the % denominators (owner directive: the
   * % measures completion of the member's OWN plan; 50/50 meals/exercise when
   * the member has a workout plan, meals-only otherwise). `sessions` present
   * ONLY when the member is in the ready workout plan. */
  planned: Record<string, PlannedTotals>;
  /** Distinct meal slots planned for each day of the plan week (indexed by
   * day_index, length 7) — the strip's star denominators, so a day shows three
   * stars only when ALL of its meals were cooked as written. */
  plannedMealSlotsPerDay: number[];
  weekStartDate?: string;
  /** The workout marking window (YYYY-MM-DD, inclusive) — the CURRENT
   * Sunday-anchored week the workout UI writes into. Scopes workout marks on the
   * board independently of the meal plan's week (which is anchored to the meal
   * generation day and may be stale). */
  workoutWeekStart?: string;
  workoutWeekEnd?: string;
  /** Plan day_index of TODAY (Riyadh calendar), or null when the plan week
   * doesn't contain today — drives the strip's «اليوم» marker. */
  todayIndex?: number | null;
  /** The «اليوم» action panel (today's dish + the invitation to mark it).
   * Absent when today isn't in the plan week or has no meals yet. */
  today?: {
    dateLabel: string;
    slotLabel: string;
    dishName: string;
    alreadyLit: boolean;
  } | null;
  /** Account owner's sex → gendered فصحى in the today panel («علّمي/علّم»). */
  ownerSex?: string | null;
}

const SLOT_LABELS_AR: Record<string, string> = {
  breakfast: "فطور",
  lunch: "غداء",
  dinner: "عشاء",
  snack: "وجبة خفيفة",
};

/** Today's date in Riyadh as YYYY-MM-DD (the plan week is Riyadh-anchored). */
function riyadhTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(
    new Date(),
  );
}

// undefined_table (Postgres) / schema-cache miss (PostgREST) — the shape a
// pre-migration prod returns. A warning, not an error: the board is built to
// degrade until the migration is applied.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

/** The board degrades gracefully on a failed read, but never SILENTLY — a
 * transient error used to render "no activity" with no signal, which reads as
 * marks vanishing. */
function reportSeasonReadError(
  step: string,
  error: { code?: string; message?: string } | null | undefined,
) {
  if (!error) return;
  if (MISSING_TABLE_CODES.has(error.code ?? "")) {
    Sentry.captureMessage(
      `family season ${step} read degraded — table missing, apply pending migrations`,
      { level: "warning", tags: { area: "engagement", step: `season-${step}` } },
    );
  } else {
    Sentry.captureException(
      new Error(`family season ${step} read failed: ${error.message ?? "unknown"}`),
      { tags: { area: "engagement", step: `season-${step}` } },
    );
  }
}

/**
 * Assemble the «موسم بيتنا» leaderboard props for a household with a ready plan:
 * the whole-household roster (mom + adults + CHILDREN, never the housekeeper —
 * owner directive), this week's meal check-ins + workout marks (calendar-keyed
 * so they survive plan re-mints; verdicts don't score — owner formula), the
 * per-member plan totals, and the adults-only goal-milestone celebrations.
 * Returns null when there is no board to show (no ready plan, or a solo
 * household with fewer than two members).
 *
 * This mirrors the fetch that used to live inline in /plan/page.tsx; the season
 * now surfaces on the dashboard, so the logic lives here to be shared/testable.
 */
export async function getFamilySeasonProps(
  profile: Profile | null,
  familyMembers: FamilyMembers,
  latestPlan: LatestPlan,
  workoutPlan: WorkoutPlan,
): Promise<FamilySeasonProps | null> {
  if (!profile || latestPlan?.status !== "ready" || !latestPlan.plan_data) {
    return null;
  }

  // Whole-household roster, limited to members actually in the current plan.
  const inPlan = new Set(latestPlan.plan_data.members.map((m) => m.member_id));
  const momName =
    profile.display_name ?? genderPick(profile.sex)("أنتِ", "أنتَ");
  const members = [
    { id: "mom", name: momName, sex: profile.sex ?? null },
    ...familyMembers
      .filter((m) => m.role !== "housekeeper" && m.member_type !== "housekeeper")
      .map((m) => ({
        id: m.id,
        name: m.name,
        sex: (m.sex as string | null) ?? null,
      })),
  ].filter((m) => inPlan.has(m.id));
  // A solo household never sees a family board.
  if (members.length < 2) return null;

  // Per-member weekly plan totals — the % denominators (owner directive: the %
  // measures completion of the member's OWN plan). Meals from the meal plan;
  // the `sessions` key exists ONLY when the member is in the ready workout plan
  // — its presence is what switches that member to the 50/50 formula.
  // DISTINCT SLOTS per day, not raw meal count. `meal_checkins` is keyed
  // (day_index, slot, member), so a day carrying two snack-slot meals — which
  // mealOrder.ts exists to bucket, and which «4-5 وجبات» plans produce routinely
  // — can only ever yield ONE mark for that slot. Counting both in the
  // denominator made 100% unreachable: a member on a 5-meal day who cooked every
  // single planned dish as written scored 28/35 = 80% and her card printed a
  // 7-meal deficit she never had, while a sibling on a 4-meal plan hit 100% for
  // the same behaviour — so the «فائز هذا الأسبوع» crown turned on snack count
  // rather than adherence. This mirrors plannedSlotSets below; meal identity is
  // (day, slot) everywhere else in this layer.
  const plannedMealsById = new Map(
    latestPlan.plan_data.members.map((pm) => [
      pm.member_id,
      pm.days.reduce((n, d) => n + new Set(d.meals.map((m) => m.slot)).size, 0),
    ]),
  );
  const plannedSessionsById = new Map<string, number>(
    workoutPlan?.status === "ready" && workoutPlan.plan_data
      ? workoutPlan.plan_data.members.map((wm) => [
          wm.member_id,
          wm.weekly_sessions.length,
        ])
      : [],
  );
  const planned: Record<string, PlannedTotals> = {};
  for (const m of members) {
    planned[m.id] = {
      meals: plannedMealsById.get(m.id) ?? 0,
      ...(plannedSessionsById.has(m.id)
        ? { sessions: plannedSessionsById.get(m.id) }
        : {}),
    };
  }

  // Per-day star denominators — «كل وجبات اليوم» (owner directive 07/2026: the
  // strip's third star is earned only by a fully cooked day). Meal identity is
  // (day, slot) everywhere in the engagement layer — a shared lunch is ONE meal
  // however many members eat it — so a day's plan is its DISTINCT slots, taken
  // across the SEASON ROSTER only. The housekeeper is deliberately excluded
  // (she is never in `members`, is never marked, and a slot only she carries
  // would put a complete day out of the family's reach).
  const rosterIds = new Set(members.map((m) => m.id));
  const plannedSlotSets = Array.from({ length: 7 }, () => new Set<string>());
  for (const pm of latestPlan.plan_data.members) {
    if (!rosterIds.has(pm.member_id)) continue;
    for (const d of pm.days) {
      const set = plannedSlotSets[d.day_index];
      if (!set) continue; // day_index outside [0,6] — never expected
      for (const meal of d.meals) set.add(meal.slot);
    }
  }
  const plannedMealSlotsPerDay = plannedSlotSets.map((s) => s.size);

  const supabase = await createClient();

  // The MEAL week anchors meal day_index and the strip labels.
  const weekStartDate = latestPlan.plan_data.week_start_date;

  // Workout marks are scoped to the CURRENT (Sunday-anchored) marking window —
  // DELIBERATELY decoupled from the meal plan's week_start_date (an arbitrary
  // generation-day anchor that may even be a stale prior week). The ONE shared
  // definition lives in seasonMath.workoutMarkingWindow and is used by both
  // this board and the /plan viewer read, so the surfaces always agree.
  const { start: workoutWeekStart, end: workoutWeekEnd } = workoutMarkingWindow(
    riyadhTodayISO(),
  );

  // All three reads are independent — one parallel batch. Reads are keyed by
  // USER + CALENDAR WINDOW (local_date), not plan id: a mid-week regenerate /
  // add-member / subscribe-sync mints a NEW plan row for the same week, and
  // plan-id-keyed reads stranded every earlier mark (the board froze). Both
  // check-in tables carry a server-stamped NOT NULL local_date with a
  // (user_id, local_date) index, and same-week re-mints preserve
  // week_start_date, so calendar keys line up across plan versions; the
  // collapse helpers dedupe the multi-version fan-in (last write wins).
  // select("*") + untyped cast: house tolerance pattern (pre-migration prod
  // degrades instead of failing). Ordered oldest-first so the limit truncates
  // deterministically; 800 covers several plan versions' rows.
  const mealWeekValid = isISODate(weekStartDate);
  const mealQuery = () => {
    const base = supabase.from("meal_checkins").select("*");
    // Malformed week anchor (never expected) — degrade to the legacy
    // plan-id-keyed read rather than an unbounded scan.
    const scoped = mealWeekValid
      ? base
          .eq("user_id", profile.id)
          .gte("local_date", weekStartDate)
          .lte("local_date", addDaysISO(weekStartDate, 6))
      : base.eq("meal_plan_id", latestPlan.id);
    return scoped.order("created_at", { ascending: true }).limit(800);
  };
  const workoutQuery = () => {
    if (workoutPlan?.status !== "ready") {
      return Promise.resolve({ data: null, error: null });
    }
    return (supabase as unknown as SupabaseClient)
      .from("workout_checkins")
      .select("*")
      .eq("user_id", profile.id)
      .gte("local_date", workoutWeekStart)
      .lte("local_date", workoutWeekEnd)
      .order("created_at", { ascending: true })
      .limit(800);
  };
  const [checkinRes, workoutRes, { data: logs, error: logsError }] =
    await Promise.all([
      mealQuery(),
      workoutQuery(),
      supabase
        .from("body_logs")
        .select("member_id, weight_kg, recorded_on")
        .eq("user_id", profile.id)
        .order("recorded_on", { ascending: true }),
    ]);
  reportSeasonReadError("checkins", checkinRes.error);
  reportSeasonReadError("workouts", workoutRes.error);
  reportSeasonReadError("body-logs", logsError);
  const rawCheckins: RawSeasonMealRow[] = (
    (checkinRes.data ?? []) as Array<Record<string, unknown>>
  ).map((r) => ({
    local_date: (r.local_date ?? null) as string | null,
    day_index: r.day_index as number,
    slot: r.slot as string,
    status: r.status as string,
    member_id: (r.member_id ?? null) as string | null,
  }));
  const checkins = collapseMealMarks(
    rawCheckins,
    mealWeekValid ? weekStartDate : undefined,
  );
  const rawWorkouts: RawSeasonWorkoutRow[] = (
    (workoutRes.data ?? []) as Array<Record<string, unknown>>
  ).map((r) => ({
    local_date: (r.local_date ?? null) as string | null,
    day_index: r.day_index as number,
    member_id: (r.member_id ?? null) as string | null,
    status: r.status as string,
  }));
  const workoutCheckins = collapseWorkoutMarks(rawWorkouts);

  // Goal milestones — eligible ADULTS whose latest weigh-in reached their target
  // (loss-framing, so pregnant/lactating are never celebrated on weight; children
  // have no target and are excluded by eligibility). The number never leaves this
  // computation — the board shows only the achievement.
  const goalReached: Array<{ id: string; name: string }> = [];
  const seriesByMember = new Map<string, number[]>();
  for (const r of (logs ?? []) as Array<{ member_id: string; weight_kg: number | null }>) {
    if (r.weight_kg == null) continue;
    const arr = seriesByMember.get(r.member_id) ?? [];
    arr.push(Number(r.weight_kg));
    seriesByMember.set(r.member_id, arr);
  }
  // One predicate per side, both built on isInNoLossFramingState, so the owner
  // and member rules cannot drift apart again — they already had: this branch
  // checked only is_pregnant, so a LACTATING owner was celebrated while an
  // identical family member was skipped.
  if (
    isGoalCelebrationEligibleOwner({
      member_type: profile.member_type ?? null,
      is_pregnant: profile.is_pregnant,
      birth_year: profile.birth_year ?? null,
    }) &&
    hasReachedWeightGoal(seriesByMember.get("mom") ?? [], profile.target_weight_kg)
  ) {
    goalReached.push({ id: "mom", name: momName });
  }
  for (const m of familyMembers) {
    // ADULTS ONLY on this SHARED surface — children keep private records but a
    // child's weight goal is never celebrated on the family «موسم بيتنا» card.
    // The pregnant/lactating exclusion now lives inside the predicate.
    if (!isGoalCelebrationEligibleMember(m)) continue;
    if (hasReachedWeightGoal(seriesByMember.get(m.id) ?? [], m.target_weight_kg)) {
      goalReached.push({ id: m.id, name: m.name });
    }
  }

  // «اليوم» — which plan day is today (Riyadh), and today's headline dish for
  // the action panel. Both degrade to null/undefined when the plan week doesn't
  // contain today (stale plan) or today's meals haven't generated yet.
  let todayIndex: number | null = null;
  const startMs = Date.parse(weekStartDate);
  if (!Number.isNaN(startMs)) {
    const diff = Math.round((Date.parse(riyadhTodayISO()) - startMs) / 86_400_000);
    if (diff >= 0 && diff <= 6) todayIndex = diff;
  }
  let today: FamilySeasonProps["today"] = null;
  if (todayIndex !== null) {
    const momPlan =
      latestPlan.plan_data.members.find((m) => m.member_id === "mom") ??
      latestPlan.plan_data.members[0];
    const day = momPlan?.days.find((d) => d.day_index === todayIndex);
    const meals = day?.meals ?? [];
    if (meals.length > 0) {
      const pick = meals.find((m) => m.slot === "lunch") ?? meals[0]!;
      today = {
        dateLabel: new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
          timeZone: "Asia/Riyadh",
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date()),
        slotLabel: SLOT_LABELS_AR[pick.slot] ?? "وجبة",
        dishName: pick.recipe_name_ar,
        // Same definition as the strip cell: only «طبختها كما هي» lights a day.
        alreadyLit: dayHasCookedMark(checkins, todayIndex),
      };
    }
  }

  return {
    members,
    checkins,
    workoutCheckins,
    goalReached,
    planned,
    plannedMealSlotsPerDay,
    weekStartDate,
    workoutWeekStart,
    workoutWeekEnd,
    todayIndex,
    today,
    ownerSex: profile.sex ?? null,
  };
}
