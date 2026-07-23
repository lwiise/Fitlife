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
  isWeighInEligibleMom,
} from "./eligibility";
import { hasReachedWeightGoal } from "./goalMilestone";
import { dayHasNonSkippedMark } from "./seasonMath";
import { genderPick } from "@/lib/copy/gender";

type Profile = NonNullable<Awaited<ReturnType<typeof getCurrentUserProfile>>>;
type FamilyMembers = Awaited<ReturnType<typeof getCurrentUserFamilyMembers>>;
type LatestPlan = Awaited<ReturnType<typeof getCurrentUserLatestPlan>>;
type WorkoutPlan = Awaited<ReturnType<typeof getLatestWorkoutPlan>>;

/** Everything the «موسم بيتنا» leaderboard (`FamilySeasonCard`) needs. */
export interface FamilySeasonProps {
  members: Array<{ id: string; name: string; sex?: string | null }>;
  checkins: Array<{
    day_index: number;
    slot: string;
    status: string;
    member_id?: string | null;
  }>;
  verdicts: Array<{
    day_index: number;
    slot: string;
    member_id?: string | null;
    verdict: string;
  }>;
  workoutCheckins: Array<{
    day_index: number;
    member_id: string;
    status: string;
    /** Server-stamped session date — scopes the weekday-anchored mark to the
     * meal plan's week (the leaderboard drops rows without it). */
    local_date: string | null;
  }>;
  goalReached: Array<{ id: string; name: string }>;
  weekStartDate?: string;
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
 * owner directive), this week's meal check-ins/verdicts + workout marks, and the
 * adults-only goal-milestone celebrations. Returns null when there is no board
 * to show (no ready plan, or a solo household with fewer than two members).
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

  const supabase = await createClient();

  // The week window is the MEAL plan's own week — meal day_index is anchored
  // to week_start_date, and workout marks (weekday-anchored to their own plan)
  // are scoped into it by local_date so a stale prior week can never buy rank.
  const weekStartDate = latestPlan.plan_data.week_start_date;
  const weekEndDate = ISO_DATE_RE.test(weekStartDate)
    ? addDaysISO(weekStartDate, 6)
    : null;

  // All four reads are independent — one parallel batch, not three stages.
  // Meal check-ins + verdicts: select("*") on purpose — member_id is a 00019
  // column; naming it would fail the whole read on a pre-apply prod, while *
  // degrades to rows without it (house tolerance pattern). workout_checkins
  // (00020) isn't in the generated Database types yet, hence the untyped cast;
  // select("*") degrades to [] on a pre-apply prod. Ordered oldest-first so the
  // limit, if ever hit, truncates deterministically.
  const workoutQuery = () => {
    if (workoutPlan?.status !== "ready") {
      return Promise.resolve({ data: null, error: null });
    }
    let q = (supabase as unknown as SupabaseClient)
      .from("workout_checkins")
      .select("*")
      .eq("workout_plan_id", workoutPlan.id);
    if (weekEndDate) {
      q = q.gte("local_date", weekStartDate).lte("local_date", weekEndDate);
    }
    return q.order("created_at", { ascending: true }).limit(400);
  };
  const [checkinRes, verdictRes, workoutRes, { data: logs, error: logsError }] =
    await Promise.all([
      supabase
        .from("meal_checkins")
        .select("*")
        .eq("meal_plan_id", latestPlan.id)
        .order("created_at", { ascending: true })
        .limit(400),
      supabase
        .from("meal_verdicts")
        .select("*")
        .eq("meal_plan_id", latestPlan.id)
        .order("created_at", { ascending: true })
        .limit(400),
      workoutQuery(),
      supabase
        .from("body_logs")
        .select("member_id, weight_kg, recorded_on")
        .eq("user_id", profile.id)
        .order("recorded_on", { ascending: true }),
    ]);
  reportSeasonReadError("checkins", checkinRes.error);
  reportSeasonReadError("verdicts", verdictRes.error);
  reportSeasonReadError("workouts", workoutRes.error);
  reportSeasonReadError("body-logs", logsError);
  const checkins = ((checkinRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    day_index: r.day_index as number,
    slot: r.slot as string,
    status: r.status as string,
    member_id: (r.member_id ?? null) as string | null,
  }));
  const verdicts = ((verdictRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    day_index: r.day_index as number,
    slot: r.slot as string,
    member_id: (r.member_id ?? null) as string | null,
    verdict: r.verdict as string,
  }));
  const workoutCheckins: FamilySeasonProps["workoutCheckins"] = (
    (workoutRes.data ?? []) as Array<Record<string, unknown>>
  ).map((r) => ({
    day_index: r.day_index as number,
    member_id: (r.member_id ?? "") as string,
    status: r.status as string,
    local_date: (r.local_date ?? null) as string | null,
  }));

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
  if (
    !profile.is_pregnant &&
    isWeighInEligibleMom(profile.birth_year ?? null) &&
    hasReachedWeightGoal(seriesByMember.get("mom") ?? [], profile.target_weight_kg)
  ) {
    goalReached.push({ id: "mom", name: momName });
  }
  for (const m of familyMembers) {
    // ADULTS ONLY on this SHARED surface — children keep private records but a
    // child's weight goal is never celebrated on the family «موسم بيتنا» card.
    if (!isGoalCelebrationEligibleMember(m)) continue;
    if (m.member_type === "pregnant" || m.member_type === "lactating") continue;
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
        // Same definition as the strip cell: a skipped-only day is not lit.
        alreadyLit: dayHasNonSkippedMark(checkins, todayIndex),
      };
    }
  }

  return {
    members,
    checkins,
    verdicts,
    workoutCheckins,
    goalReached,
    weekStartDate,
    todayIndex,
    today,
    ownerSex: profile.sex ?? null,
  };
}
