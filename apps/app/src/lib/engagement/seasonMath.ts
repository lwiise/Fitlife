// «موسم بيتنا» — all season counting in one pure module, shared by the server
// props builder (seasonProps.ts) and the leaderboard card (FamilySeasonCard).
// Extracted so the ranking rules are unit-testable and can never fork between
// the strip, the ring, and the per-member scores.
//
// Owner decisions (07/2026) encoded here:
//   • A skipped meal earns NOTHING — no member credit, no family ring, no strip
//     cell. Marking «تجاوزتها» is honest logging, but the season celebrates
//     meals that happened (cooked/swapped).
//   • The formula stays flat: each act = 1 point (non-skipped meal mark,
//     verdict, workout done/moved), % = acts / WEEKLY_TARGET.
//   • Workout marks count only inside the MEAL plan's week — their day_index is
//     weekday-anchored to the workout plan's own week, so `local_date` is the
//     only key that can scope them to «this week».

import { addDaysISO } from "@/lib/plans/dayMapping";

export const HONOR_DAYS_GOAL = 5; // meal days in a week to "honor" the season
export const CAP = 14; // invisible capacity the family meal ring fills toward
export const WEEKLY_TARGET = 10; // per-member denominator for the leaderboard %

export interface SeasonMember {
  id: string;
  name: string;
  sex?: string | null;
}

export interface SeasonMealMark {
  day_index: number;
  slot: string;
  status?: string;
  member_id?: string | null;
}

export interface SeasonVerdictMark {
  verdict?: string;
  member_id?: string | null;
}

export interface SeasonWorkoutMark {
  day_index?: number;
  member_id?: string | null;
  status: string;
  /** Server-stamped Riyadh date of the session — the only field that can place
   * a weekday-anchored workout mark inside the meal plan's week. */
  local_date?: string | null;
}

export interface RankedMember extends SeasonMember {
  score: number;
  /** min(1, score / WEEKLY_TARGET) — the member's ring fill. */
  pct: number;
  /** Position in the ROSTER (not the ranking) — stable avatar colour. */
  rosterIndex: number;
}

export interface SeasonDayCell {
  dayIndex: number;
  /** The house cooked from the plan this day (non-skipped mark exists). */
  lit: boolean;
  /** Distinct non-skipped meal slots that day, capped at 3 — the star rating. */
  stars: number;
}

export interface SeasonStats {
  /** Distinct non-skipped (day, slot) meals — the ring figure AND its sentence
   * (one number; a shared dinner marked by three people is ONE meal). */
  followedMeals: number;
  /** Distinct days with at least one non-skipped meal mark. */
  activeDays: number;
  honored: boolean;
  /** Distinct (day, member) workout sessions done/moved inside the week. */
  workoutActs: number;
  /** Workout rows done/moved inside the week (rows are unique per member+day). */
  sessionsDone: number;
  fillFrac: number;
  hasActivity: boolean;
  /** The 7-day strip, index 0..6 of the plan week. */
  days: SeasonDayCell[];
  /** Members sorted by rank (deterministic — see the tie-break comment). */
  ranked: RankedMember[];
  hasWinner: boolean;
  leaderName: string | null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A meal mark that actually happened — skipped earns nothing anywhere. */
function isNonSkipped(mark: SeasonMealMark): boolean {
  return mark.status !== "skipped";
}

/** Any non-skipped mark on this plan day (the 'household' sentinel counts —
 * whole-kitchen attestation lights family surfaces). The single definition of
 * «the day lit», shared by the strip cells and the hero's alreadyLit. */
export function dayHasNonSkippedMark(
  checkins: SeasonMealMark[],
  dayIndex: number,
): boolean {
  return checkins.some((c) => c.day_index === dayIndex && isNonSkipped(c));
}

export function computeSeasonStats(input: {
  members: SeasonMember[];
  checkins: SeasonMealMark[];
  verdicts: SeasonVerdictMark[];
  workoutCheckins?: SeasonWorkoutMark[];
  /** Meal plan week anchor (YYYY-MM-DD). When valid, workout marks are scoped
   * to local_date ∈ [weekStartDate, weekStartDate+6] and rows without a
   * local_date are dropped (stale weeks must never buy rank). When absent or
   * malformed, no scoping — degrade open rather than zero the pillar. */
  weekStartDate?: string;
}): SeasonStats {
  const { members, checkins, verdicts } = input;
  const workoutCheckins = input.workoutCheckins ?? [];
  const memberIds = new Set(members.map((m) => m.id));

  // ── Meals: skipped rows are invisible to the season ──────────────────────
  const happened = checkins.filter(isNonSkipped);

  // Meal-true family total: (day, slot) is the meal's identity, so a shared
  // dinner marked by three people is ONE followed meal (household size can
  // never inflate it — mirrors the engagement digest's collapse).
  const followedMeals = new Set(happened.map((c) => `${c.day_index}|${c.slot}`))
    .size;

  // Distinct non-skipped meal slots per plan day → strip cells + stars.
  const slotsPerDay = new Map<number, Set<string>>();
  for (const c of happened) {
    if (!slotsPerDay.has(c.day_index)) slotsPerDay.set(c.day_index, new Set());
    slotsPerDay.get(c.day_index)!.add(c.slot);
  }
  const days: SeasonDayCell[] = Array.from({ length: 7 }, (_, i) => {
    const slots = slotsPerDay.get(i)?.size ?? 0;
    return { dayIndex: i, lit: slots > 0, stars: Math.min(3, slots) };
  });
  const activeDays = slotsPerDay.size;
  const honored = activeDays >= HONOR_DAYS_GOAL;

  // ── Workouts: week-scoped, then done/moved only ─────────────────────────
  const weekStartDate =
    input.weekStartDate && ISO_DATE_RE.test(input.weekStartDate)
      ? input.weekStartDate
      : undefined;
  const weekEnd = weekStartDate ? addDaysISO(weekStartDate, 6) : undefined;
  const effectiveWorkouts = workoutCheckins.filter((w) => {
    if (w.status !== "done" && w.status !== "moved") return false;
    if (!weekStartDate || !weekEnd) return true;
    // ISO dates compare correctly as strings.
    return (
      w.local_date != null &&
      w.local_date >= weekStartDate &&
      w.local_date <= weekEnd
    );
  });
  const workoutActs = new Set(
    effectiveWorkouts
      .filter(
        (w) => w.member_id && memberIds.has(w.member_id) && w.day_index != null,
      )
      .map((w) => `${w.day_index}|${w.member_id}`),
  ).size;
  const sessionsDone = effectiveWorkouts.length;

  const fillFrac = Math.min(
    1,
    CAP > 0 ? (followedMeals + workoutActs) / CAP : 0,
  );
  const hasActivity = followedMeals > 0 || workoutActs > 0;

  // ── Per-member participation → rank + % ─────────────────────────────────
  // 'household' sentinel rows (legacy pre-00019 + ختام اليوم attestations)
  // light the family surfaces above but never buy any member rank.
  const acts: Record<string, number> = {};
  members.forEach((m) => (acts[m.id] = 0));
  const bump = (id: string | null | undefined) => {
    if (id && memberIds.has(id)) acts[id] = (acts[id] ?? 0) + 1;
  };
  for (const c of happened) bump(c.member_id);
  for (const v of verdicts) bump(v.member_id);
  for (const w of effectiveWorkouts) bump(w.member_id);

  // Tie-break: score, then distinct non-skipped meal DAYS (spread beats a
  // one-day burst), then roster order — a true tie keeps the earlier roster
  // member (mom first, then family order) so the crown never flickers.
  const mealDaysByMember = new Map<string, Set<number>>();
  for (const c of happened) {
    if (!c.member_id || !memberIds.has(c.member_id)) continue;
    if (!mealDaysByMember.has(c.member_id)) {
      mealDaysByMember.set(c.member_id, new Set());
    }
    mealDaysByMember.get(c.member_id)!.add(c.day_index);
  }
  const ranked: RankedMember[] = members
    .map((m, rosterIndex) => ({
      ...m,
      rosterIndex,
      score: acts[m.id] ?? 0,
      pct: Math.min(1, (acts[m.id] ?? 0) / WEEKLY_TARGET),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (mealDaysByMember.get(b.id)?.size ?? 0) -
          (mealDaysByMember.get(a.id)?.size ?? 0) ||
        a.rosterIndex - b.rosterIndex,
    );
  const hasWinner = (ranked[0]?.score ?? 0) > 0;
  const leaderName = hasWinner && ranked[0] ? ranked[0].name : null;

  return {
    followedMeals,
    activeDays,
    honored,
    workoutActs,
    sessionsDone,
    fillFrac,
    hasActivity,
    days,
    ranked,
    hasWinner,
    leaderName,
  };
}
