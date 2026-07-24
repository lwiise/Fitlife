// «موسم بيتنا» — all season counting in one pure module, shared by the server
// props builder (seasonProps.ts) and the leaderboard card (FamilySeasonCard).
// Extracted so the ranking rules are unit-testable and can never fork between
// the strip, the ring, and the per-member scores.
//
// Owner decisions (07/2026) encoded here:
//   • A skipped meal earns NOTHING — no member credit, no family ring, no strip
//     cell. Marking «تجاوزتها» is honest logging, but the season celebrates
//     meals that happened (cooked/swapped).
//   • The % is PLAN COMPLETION, not an act count (owner directive): a member
//     with meals only is measured purely on meals — each meal worth
//     100% / their planned meals. A member with a workout plan splits 50/50 —
//     half the % from meals (against their planned meals), half from exercise
//     sessions (against their planned sessions). Dish verdicts («كيف كانت؟»)
//     do NOT count toward the % — they feed Sara's adaptation, not the board.
//   • Workout marks count only inside the current marking window — their
//     day_index is weekday-anchored to the workout plan's own week, so
//     `local_date` is the only key that can place them in a calendar week.
//   • Board reads are CALENDAR-keyed (user + local_date window), not plan-id
//     keyed: a mid-week regenerate mints a new plan row for the same week, and
//     marks must survive that. The collapse helpers below dedupe the fan-in
//     from multiple same-week plan versions (last write wins).

import { addDaysISO } from "@/lib/plans/dayMapping";

export const HONOR_DAYS_GOAL = 5; // meal days in a week to "honor" the season
export const CAP = 14; // invisible capacity the family meal ring fills toward

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

export interface SeasonWorkoutMark {
  day_index?: number;
  member_id?: string | null;
  status: string;
  /** Server-stamped Riyadh date of the session — the only field that can place
   * a weekday-anchored workout mark inside a calendar week. */
  local_date?: string | null;
}

/** A raw meal_checkins row from the calendar-keyed read (may span several
 * same-week plan versions). Ordered oldest-first by the query. */
export interface RawSeasonMealRow {
  local_date: string | null;
  day_index: number;
  slot: string;
  status: string;
  member_id: string | null;
}

/** A raw workout_checkins row from the calendar-keyed read. */
export interface RawSeasonWorkoutRow {
  local_date: string | null;
  day_index: number;
  member_id: string | null;
  status: string;
}

/** A member's weekly plan totals — the % denominators. `sessions` is present
 * ONLY when the member is in the ready workout plan (the 50/50 pillar exists);
 * absent means the meals-only formula applies. */
export interface PlannedTotals {
  meals: number;
  sessions?: number;
}

export interface RankedMember extends SeasonMember {
  /** Marks that happened: distinct meals marked + distinct sessions done. */
  score: number;
  /** Plan completion — meals-only: mealsMarked/mealsPlanned; with a workout
   * plan: ½·meals + ½·sessions. Capped at 1; the ring fill and rank metric. */
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
  /** Distinct (date, member) workout sessions done/moved inside the week. */
  workoutActs: number;
  /** Workout rows done/moved inside the week (deduped per member+date). */
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

/** Whole days from `startISO` to `dateISO` (both YYYY-MM-DD; UTC math — the
 * dates are Riyadh-local calendar days, no DST). */
function daysFromStart(startISO: string, dateISO: string): number {
  return Math.round(
    (Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${startISO}T00:00:00Z`)) /
      86_400_000,
  );
}

/**
 * Collapse the calendar-keyed meal_checkins fan-in to one mark per
 * (date, slot, member): rows arrive oldest-first and may repeat across
 * same-week plan versions (a mid-week regenerate mints a new plan row), so the
 * LAST write wins — including a later «تجاوزتها» correction overriding an
 * older «طبختها». The day identity is then re-derived from local_date against
 * the plan week anchor (uniform across plan versions); rows without a
 * resolvable day inside [0,6] are dropped. Skipped-filtering happens later in
 * computeSeasonStats — corrections must win BEFORE statuses are judged.
 */
export function collapseMealMarks(
  rows: RawSeasonMealRow[],
  weekStartDate?: string,
): SeasonMealMark[] {
  const weekStart =
    weekStartDate && ISO_DATE_RE.test(weekStartDate) ? weekStartDate : undefined;
  const latest = new Map<string, SeasonMealMark>();
  for (const r of rows) {
    let dayIndex: number | null = null;
    if (weekStart && r.local_date && ISO_DATE_RE.test(r.local_date)) {
      const diff = daysFromStart(weekStart, r.local_date);
      if (diff >= 0 && diff <= 6) dayIndex = diff;
    } else if (Number.isInteger(r.day_index) && r.day_index >= 0 && r.day_index <= 6) {
      // No calendar anchor (legacy plan-id read / missing date) — trust the
      // row's own plan-week day_index.
      dayIndex = r.day_index;
    }
    if (dayIndex === null) continue;
    const key = `${r.local_date ?? `d${dayIndex}`}|${r.slot}|${r.member_id ?? "household"}`;
    latest.set(key, {
      day_index: dayIndex,
      slot: r.slot,
      status: r.status,
      member_id: r.member_id,
    });
  }
  return [...latest.values()];
}

/**
 * Collapse the calendar-keyed workout_checkins fan-in to one mark per
 * (member, date) — same last-write-wins rule across workout plan re-mints.
 */
export function collapseWorkoutMarks(
  rows: RawSeasonWorkoutRow[],
): SeasonWorkoutMark[] {
  const latest = new Map<string, SeasonWorkoutMark>();
  for (const r of rows) {
    const key = `${r.member_id ?? ""}|${r.local_date ?? `d${r.day_index}`}`;
    latest.set(key, {
      day_index: r.day_index,
      member_id: r.member_id,
      status: r.status,
      local_date: r.local_date,
    });
  }
  return [...latest.values()];
}

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
  workoutCheckins?: SeasonWorkoutMark[];
  /** Meal plan week anchor (YYYY-MM-DD) — drives the strip labels. Also the
   * FALLBACK workout window ([weekStartDate, weekStartDate+6]) for callers that
   * don't pass an explicit one. */
  weekStartDate?: string;
  /** The workout marking window (YYYY-MM-DD, inclusive) — the CURRENT
   * Sunday-anchored week the workout UI actually writes into (see
   * setWorkoutCheckin). PREFERRED over weekStartDate for scoping workout marks:
   * the meal plan's week_start_date is anchored to the meal generation day (an
   * arbitrary weekday) and can even be a stale prior week, so tying workouts to
   * it silently drops legitimate current-week sessions. Rows without a
   * local_date, or outside this window, are dropped (stale weeks must never buy
   * rank). When neither this nor weekStartDate is valid, no scoping — degrade
   * open rather than zero the pillar. */
  workoutWeekStart?: string;
  workoutWeekEnd?: string;
  /** Per-member weekly plan totals (the % denominators — owner directive:
   * the % measures completion of the member's OWN plan). A missing member or
   * zero planned meals yields 0% for that pillar (never a division by zero);
   * the member's raw marks still count toward `score`/«حاضر». */
  planned?: Record<string, PlannedTotals>;
}): SeasonStats {
  const { members, checkins } = input;
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
  // Scope to the WORKOUT marking window (the current Sunday-anchored week the
  // exercise UI writes into), NOT the meal plan's week_start_date. The meal
  // anchor is the meal generation day (arbitrary weekday) and may be a stale
  // prior week, so scoping workouts by it dropped genuine current-week sessions
  // for most users. Prefer an explicit window; fall back to the meal week+6
  // only when a caller supplies no explicit one (keeps older callers/tests).
  const mealWeekStart =
    input.weekStartDate && ISO_DATE_RE.test(input.weekStartDate)
      ? input.weekStartDate
      : undefined;
  const workoutStart =
    input.workoutWeekStart && ISO_DATE_RE.test(input.workoutWeekStart)
      ? input.workoutWeekStart
      : mealWeekStart;
  const workoutEnd =
    input.workoutWeekEnd && ISO_DATE_RE.test(input.workoutWeekEnd)
      ? input.workoutWeekEnd
      : mealWeekStart
        ? addDaysISO(mealWeekStart, 6)
        : undefined;
  const effectiveWorkouts = workoutCheckins.filter((w) => {
    if (w.status !== "done" && w.status !== "moved") return false;
    if (!workoutStart || !workoutEnd) return true;
    // ISO dates compare correctly as strings.
    return (
      w.local_date != null &&
      w.local_date >= workoutStart &&
      w.local_date <= workoutEnd
    );
  });
  // A session's identity is its calendar date (falling back to the
  // weekday-anchored day_index when no date exists — unscoped legacy rows).
  const workoutKey = (w: SeasonWorkoutMark) =>
    `${w.local_date ?? `d${w.day_index}`}|${w.member_id}`;
  const workoutActSet = new Set(
    effectiveWorkouts
      .filter((w) => w.member_id && memberIds.has(w.member_id))
      .map(workoutKey),
  );
  const workoutActs = workoutActSet.size;
  const sessionsDone = new Set(effectiveWorkouts.map(workoutKey)).size;

  const fillFrac = Math.min(
    1,
    CAP > 0 ? (followedMeals + workoutActs) / CAP : 0,
  );
  const hasActivity = followedMeals > 0 || workoutActs > 0;

  // ── Per-member plan completion → rank + % ───────────────────────────────
  // 'household' sentinel rows (legacy pre-00019 + ختام اليوم attestations)
  // light the family surfaces above but never buy any member rank. Verdicts
  // deliberately don't score (owner directive: the % is meals and exercise).
  const mealsMarkedBy = new Map<string, Set<string>>();
  const mealDaysByMember = new Map<string, Set<number>>();
  for (const c of happened) {
    if (!c.member_id || !memberIds.has(c.member_id)) continue;
    if (!mealsMarkedBy.has(c.member_id)) mealsMarkedBy.set(c.member_id, new Set());
    mealsMarkedBy.get(c.member_id)!.add(`${c.day_index}|${c.slot}`);
    if (!mealDaysByMember.has(c.member_id)) {
      mealDaysByMember.set(c.member_id, new Set());
    }
    mealDaysByMember.get(c.member_id)!.add(c.day_index);
  }
  const sessionsMarkedBy = new Map<string, Set<string>>();
  for (const w of effectiveWorkouts) {
    if (!w.member_id || !memberIds.has(w.member_id)) continue;
    if (!sessionsMarkedBy.has(w.member_id)) {
      sessionsMarkedBy.set(w.member_id, new Set());
    }
    sessionsMarkedBy.get(w.member_id)!.add(workoutKey(w));
  }

  const planned = input.planned ?? {};
  // Each member's % as an EXACT rational n/d (owner formula):
  //   meals only          → min(m, M) / M
  //   with workout pillar → (min(m,M)/M + min(s,S)/S) / 2
  // A degenerate denominator (≤0) contributes 0 to its pillar — never a
  // division by zero. Rank compares cross-multiplied integers so equal
  // fractions can never flip between renders.
  const scored = members.map((m, rosterIndex) => {
    const mealsMarked = mealsMarkedBy.get(m.id)?.size ?? 0;
    const sessionsMarked = sessionsMarkedBy.get(m.id)?.size ?? 0;
    const p = planned[m.id];
    const M = Math.max(0, Math.floor(p?.meals ?? 0));
    const hasWorkoutPillar = p?.sessions !== undefined;
    let n: number;
    let d: number;
    if (!hasWorkoutPillar) {
      n = M > 0 ? Math.min(mealsMarked, M) : 0;
      d = M > 0 ? M : 1;
    } else {
      const S = Math.max(0, Math.floor(p.sessions ?? 0));
      const mealD = M > 0 ? M : 1;
      const sessD = S > 0 ? S : 1;
      const mealN = M > 0 ? Math.min(mealsMarked, M) : 0;
      const sessN = S > 0 ? Math.min(sessionsMarked, S) : 0;
      n = mealN * sessD + sessN * mealD;
      d = 2 * mealD * sessD;
    }
    return {
      ...m,
      rosterIndex,
      score: mealsMarked + sessionsMarked,
      pct: n / d,
      n,
      d,
    };
  });
  scored.sort(
    (a, b) =>
      b.n * a.d - a.n * b.d ||
      b.score - a.score ||
      (mealDaysByMember.get(b.id)?.size ?? 0) -
        (mealDaysByMember.get(a.id)?.size ?? 0) ||
      a.rosterIndex - b.rosterIndex,
  );
  const ranked: RankedMember[] = scored.map(
    ({ n: _n, d: _d, ...member }) => member,
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
