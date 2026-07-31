// «موسم بيتنا» — all season counting in one pure module, shared by the server
// props builder (seasonProps.ts) and the leaderboard card (FamilySeasonCard).
// Extracted so the ranking rules are unit-testable and can never fork between
// the strip, the ring, and the per-member scores.
//
// Owner decisions (07/2026) encoded here:
//   • ONLY «طبختها كما هي» (status "cooked") scores. «بدّلتها» (swapped) and
//     «تجاوزتها» (skipped) earn NOTHING — no member credit, no family ring, no
//     strip cell. Marking them is still honest logging (Sara's adaptation and
//     the weekly recap keep reading every status), but the season celebrates
//     the plan actually cooked as written. Superseded the earlier
//     "cooked-or-swapped" rule at the owner's direction.
//   • A FAMILY MEAL IS A DISH, NOT A SLOT (owner directive 07/2026 — «present
//     the real numbers»). The family total was distinct (day, slot) pairs: right
//     for a shared dish (three people marking one lunch is ONE meal) but wrong
//     the moment a day holds more than one dish in the same slot — and it does
//     routinely, because Sara's family methodology gives a member their own
//     recipe whenever the shared pot doesn't suit them. Five real meals then
//     rendered as three, and marking the fourth and fifth moved no number at
//     all. Family-level identity is now (day, slot, DISH) via `dishKeys`, so a
//     shared dish still counts once and different dishes count separately.
//     PER-MEMBER counts keep (day, slot) identity — that is what one member can
//     mark (see plannedMealSlots), and one person eats one dish per slot.
//   • The strip's THIRD star is EARNED, not a cap: three stars mean the day's
//     meals were ALL cooked as written. The rating is measured against the
//     day's OWN plan (its distinct planned dishes), so a partial day tops out at
//     two stars however many meals it holds. Superseded the earlier
//     `min(3, cooked)` cap, which handed a 4-meal day its third star at
//     three marks.
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
  /** Why a meal was swapped/skipped — carried for the /plan surface (MealCard
   * shows it); the board ignores it. */
  reason?: string | null;
}

export interface SeasonWorkoutMark {
  day_index?: number;
  member_id?: string | null;
  status: string;
  /** Server-stamped Riyadh date of the session — the only field that can place
   * a weekday-anchored workout mark inside a calendar week. */
  local_date?: string | null;
  /** 00022 — pass-through for the plan-page viewer; board math ignores it. */
  intensity?: string | null;
}

/** A raw meal_checkins row from the calendar-keyed read (may span several
 * same-week plan versions). Ordered oldest-first by the query. */
export interface RawSeasonMealRow {
  local_date: string | null;
  day_index: number;
  slot: string;
  status: string;
  member_id: string | null;
  reason?: string | null;
}

/** A raw workout_checkins row from the calendar-keyed read. */
export interface RawSeasonWorkoutRow {
  local_date: string | null;
  day_index: number;
  member_id: string | null;
  status: string;
  /** 00022 — how the done session felt; carried for the plan-page viewer,
   * ignored by the board math. */
  intensity?: string | null;
}

/** A member's weekly plan totals — the % denominators. `sessions` is present
 * ONLY when the member is in the ready workout plan (the 50/50 pillar exists);
 * absent means the meals-only formula applies. */
export interface PlannedTotals {
  meals: number;
  sessions?: number;
}

/**
 * How many MEALS a member's planned week actually offers to be marked.
 *
 * Distinct slots per day, not raw meal count. `meal_checkins` is keyed
 * (day_index, slot, member), so a day carrying two snack-slot meals — which
 * mealOrder.ts exists to bucket, and which «4-5 وجبات» plans produce routinely
 * — can only ever yield ONE mark for that slot. Counting both made 100%
 * unreachable: a member on a 5-meal day who cooked every planned dish as
 * written scored 28/35 = 80% and her card printed a 7-meal deficit she never
 * had, while a sibling on a 4-meal plan hit 100% for the same behaviour — so
 * the «فائز هذا الأسبوع» crown turned on snack count rather than adherence.
 *
 * This is the PER-MEMBER key space: one person marks at most one row per
 * (day, slot). The FAMILY total counts dishes instead (see `dishKeys`), because
 * two members can be served two different dishes in the same slot.
 */
export function plannedMealSlots(
  days: ReadonlyArray<{ meals: ReadonlyArray<{ slot: string }> }>,
): number {
  return days.reduce((n, d) => n + new Set(d.meals.map((m) => m.slot)).size, 0);
}

export interface RankedMember extends SeasonMember {
  /** Marks that happened: distinct meals marked + distinct sessions done. */
  score: number;
  /** Plan completion — meals-only: mealsMarked/mealsPlanned; with a workout
   * plan: ½·meals + ½·sessions. Capped at 1; the ring fill and rank metric. */
  pct: number;
  /** Position in the ROSTER (not the ranking) — stable avatar colour. */
  rosterIndex: number;
  /** Raw counts behind the % (pct caps; these don't) — the card renders them
   * as «وجبات م/M · تمارين س/S» so every % explains itself. sessions* present
   * iff the member has the workout pillar (planned[id].sessions !== undefined). */
  mealsMarked: number;
  mealsPlanned: number;
  sessionsMarked?: number;
  sessionsPlanned?: number;
}

export interface SeasonDayCell {
  dayIndex: number;
  /** The house cooked the plan as written this day («طبختها كما هي» exists). */
  lit: boolean;
  /** Distinct DISHES cooked as-is that day — a shared dish counts once, two
   * different dishes in one slot count twice. */
  cookedMeals: number;
  /** Distinct dishes the plan holds that day — the star denominator. 0 when
   * the caller passed no per-day plan (legacy/degraded read). */
  plannedMeals: number;
  /** Every planned meal of the day was cooked as written — the third star. */
  complete: boolean;
  /** 0-3 rating of the day against its OWN plan; 3 ONLY on a complete day. */
  stars: number;
}

export interface SeasonStats {
  /** Distinct DISHES cooked as-is this week — the ring figure AND its sentence.
   * A shared dinner marked by three people is ONE meal (household size can
   * never inflate it); mom's own lunch beside the children's is TWO. */
  followedMeals: number;
  /** Distinct days with at least one «طبختها كما هي» mark. */
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

/** True for a plain YYYY-MM-DD calendar date — the shared anchor guard. */
export function isISODate(v: string | null | undefined): v is string {
  return typeof v === "string" && ISO_DATE_RE.test(v);
}

/** The floor of the workout marking window, mirrored from actions.ts
 * GRACE_DAYS: setWorkoutCheckin can stamp a session's local_date back to
 * today - max(todayWeekday, GRACE_DAYS). */
export const WORKOUT_GRACE_DAYS = 2;

/** Weekday (0=Sunday, matches setWorkoutCheckin's derivation) of a
 * Riyadh-local YYYY-MM-DD date. */
function weekdayOfISO(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

/**
 * The current Sunday-anchored workout marking window (inclusive) — exactly the
 * span setWorkoutCheckin can stamp: today back to
 * today - max(todayWeekday, GRACE_DAYS). Pure — callers pass riyadhTodayISO().
 * The ONE definition shared by the board (seasonProps) and the /plan viewer
 * read (plan/page.tsx), so the two surfaces can never disagree on which
 * workout marks exist.
 */
export function workoutMarkingWindow(todayISO: string): {
  start: string;
  end: string;
} {
  return {
    start: addDaysISO(
      todayISO,
      -Math.max(weekdayOfISO(todayISO), WORKOUT_GRACE_DAYS),
    ),
    end: todayISO,
  };
}

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
 * resolvable day inside [0,6] are dropped. Status-filtering happens later in
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
      reason: r.reason ?? null,
    });
  }
  return [...latest.values()];
}

/**
 * Collapse the calendar-keyed workout_checkins fan-in to one mark per
 * (member, date) — same last-write-wins rule across workout plan re-mints.
 */
/** A raw meal_absences row from the calendar-keyed read (00021). */
export interface RawMealAbsenceRow {
  local_date?: string | null;
  day_index: number;
  slot: string;
  member_id: string;
}

/** One member excluded from one meal occurrence. */
export interface MealAbsence {
  day_index: number;
  slot: string;
  member_id: string;
}

/**
 * Collapse calendar-keyed meal_absences to one entry per (day, slot, member).
 *
 * The read has to be calendar-keyed for the same reason meal_checkins' is:
 * EVERY generation dispatch mints a new meal_plans row (createPlanRows is
 * unconditional — a member add, an edit, a regenerate, and the drain all do
 * it), and the superseded plan is only ARCHIVED, never deleted. A plan-id-keyed
 * read therefore returned [] the moment a new plan appeared mid-week, stranding
 * the absence rows on the old plan forever. The visible damage was worse than
 * losing the adjustment: the batch quietly reverted to its unscaled size (she
 * cooks for one more person than she planned for), and because check-ins ARE
 * calendar-read, the excluded member's PERSONAL «تجاوزتها» stopped being
 * recognised as an absentee's row and lit the whole household's shared chip —
 * exactly the leak the out-of-meal rule exists to prevent.
 *
 * Rows may repeat across same-week plan versions; presence is presence, so any
 * match counts. day_index is re-derived from local_date against the plan week
 * anchor (uniform across versions), falling back to the stored index when there
 * is no date — same rule as collapseMealMarks.
 */
export function collapseMealAbsences(
  rows: RawMealAbsenceRow[],
  weekStartDate?: string,
): MealAbsence[] {
  const weekStart =
    weekStartDate && ISO_DATE_RE.test(weekStartDate) ? weekStartDate : undefined;
  const seen = new Map<string, MealAbsence>();
  for (const r of rows) {
    let dayIndex: number | null = null;
    if (weekStart && r.local_date && ISO_DATE_RE.test(r.local_date)) {
      const diff = daysFromStart(weekStart, r.local_date);
      if (diff >= 0 && diff <= 6) dayIndex = diff;
    } else if (Number.isInteger(r.day_index) && r.day_index >= 0 && r.day_index <= 6) {
      dayIndex = r.day_index;
    }
    if (dayIndex === null || !r.member_id) continue;
    const key = `${dayIndex}|${r.slot}|${r.member_id}`;
    if (!seen.has(key)) {
      seen.set(key, { day_index: dayIndex, slot: r.slot, member_id: r.member_id });
    }
  }
  return [...seen.values()];
}

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
      intensity: r.intensity ?? null,
    });
  }
  return [...latest.values()];
}

/** The ONE meal status the season counts (owner directive): «طبختها كما هي».
 * Swapped and skipped are honest logging, not season credit. */
export const SEASON_COUNTED_MEAL_STATUS = "cooked";

/** A meal cooked from the plan as written — the only mark that scores. */
function isCookedAsIs(mark: SeasonMealMark): boolean {
  return mark.status === SEASON_COUNTED_MEAL_STATUS;
}

/** The dish-identity lookup key for one mark: a check-in row knows WHO marked
 * WHICH slot on WHICH day, and the plan turns that into the dish they ate. The
 * server builds the map (seasonProps); this is the shared key format. */
export function dishKeyFor(dayIndex: number, slot: string, memberId: string) {
  return `${dayIndex}|${slot}|${memberId}`;
}

/** Stand-in identity for a mark the plan can't resolve to a dish: the
 * whole-kitchen 'household' sentinel (it names no member), a member dropped
 * from the roster, or a re-minted plan that no longer describes that slot. It
 * counts as ONE meal for its slot, and ONLY when no identified dish already
 * covers that slot — a degraded lookup must never inflate the total. */
const UNKNOWN_DISH = " unknown";

/**
 * Distinct dishes cooked per plan day: `day → slot → set of dish identities`.
 *
 * The one place a family meal's identity is decided. Every sharer of a shared
 * dish resolves to the SAME key, so their fan-out collapses to one meal, while
 * two genuinely different dishes in one slot stay two meals. With no `dishKeys`
 * map (older callers, degraded reads) every mark falls back to UNKNOWN_DISH and
 * the result is exactly the legacy distinct-(day, slot) count.
 */
function cookedDishesPerDay(
  happened: SeasonMealMark[],
  dishKeys?: Record<string, string>,
): Map<number, Map<string, Set<string>>> {
  const perDay = new Map<number, Map<string, Set<string>>>();
  const unresolved = new Map<number, Set<string>>();
  const slotsOf = (dayIndex: number) => {
    if (!perDay.has(dayIndex)) perDay.set(dayIndex, new Map());
    return perDay.get(dayIndex)!;
  };
  for (const c of happened) {
    const dish =
      c.member_id && dishKeys
        ? dishKeys[dishKeyFor(c.day_index, c.slot, c.member_id)]
        : undefined;
    if (dish === undefined) {
      if (!unresolved.has(c.day_index)) unresolved.set(c.day_index, new Set());
      unresolved.get(c.day_index)!.add(c.slot);
      continue;
    }
    const slots = slotsOf(c.day_index);
    if (!slots.has(c.slot)) slots.set(c.slot, new Set());
    slots.get(c.slot)!.add(dish);
  }
  // An unresolved mark contributes its slot only when nothing identified it —
  // otherwise a household attestation sitting beside a member's own mark would
  // count the same meal twice.
  for (const [dayIndex, slotNames] of unresolved) {
    const slots = slotsOf(dayIndex);
    for (const slot of slotNames) {
      if ((slots.get(slot)?.size ?? 0) > 0) continue;
      slots.set(slot, new Set([UNKNOWN_DISH]));
    }
  }
  return perDay;
}

/** Distinct dishes cooked on one day, summed across its slots. */
function countDishes(slots: Map<string, Set<string>> | undefined): number {
  let n = 0;
  for (const dishes of slots?.values() ?? []) n += dishes.size;
  return n;
}

/** Any «طبختها كما هي» mark on this plan day (the 'household' sentinel counts —
 * whole-kitchen attestation lights family surfaces). The single definition of
 * «the day lit», shared by the strip cells and the hero's alreadyLit. */
export function dayHasCookedMark(
  checkins: SeasonMealMark[],
  dayIndex: number,
): boolean {
  return checkins.some((c) => c.day_index === dayIndex && isCookedAsIs(c));
}

/**
 * The 0-3 star rating of one strip day, measured against THAT DAY'S plan
 * (owner directive 07/2026): the third star means «كل وجبات اليوم» — every
 * planned meal of the day cooked as written. A partial day never reaches it,
 * so a family with four meals a day can no longer collect three stars at three
 * marks. Partial days split the day's own plan into thirds (floored) and are
 * clamped to 1-2, so any real progress still reads as progress.
 *
 * `plannedMeals <= 0` means the caller supplied no per-day plan (legacy caller,
 * or a day the plan doesn't describe): degrade to the pre-directive count-based
 * rating rather than inventing — or withholding — a completeness claim.
 */
export function starsForDay(cookedMeals: number, plannedMeals: number): number {
  if (cookedMeals <= 0) return 0;
  if (plannedMeals <= 0) return Math.min(3, cookedMeals);
  if (cookedMeals >= plannedMeals) return 3;
  return Math.min(2, Math.max(1, Math.floor((3 * cookedMeals) / plannedMeals)));
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
  /** Distinct DISHES the plan holds for each day of the week, indexed by plan
   * day_index (length 7). The star denominators — a day earns its third star
   * only when all of its planned meals were cooked as written. Omitted (or 0
   * for a day) degrades that day to the legacy count-based rating. Built from
   * the SEASON ROSTER's meals only: the housekeeper is never marked, so her
   * dishes must never be part of «كل وجبات اليوم». */
  plannedMealsPerDay?: number[];
  /** `${day_index}|${slot}|${member_id}` → the identity of the dish that member
   * is served at that meal (built from the plan by the server — see
   * `dishKeyFor`). Sharers of one dish all map to the SAME key, so their marks
   * collapse into one family meal, while different dishes in the same slot stay
   * separate meals. Omitted → every mark falls back to slot identity, i.e. the
   * legacy count. */
  dishKeys?: Record<string, string>;
  /** What a full week looks like for THIS household — planned meals plus
   * planned sessions — so the ring fills against their real week. Falls back to
   * CAP when the caller can't derive it. */
  weeklyCapacity?: number;
  /** Per-member weekly plan totals (the % denominators — owner directive:
   * the % measures completion of the member's OWN plan). A missing member or
   * zero planned meals yields 0% for that pillar (never a division by zero);
   * the member's raw marks still count toward `score`/«حاضر». */
  planned?: Record<string, PlannedTotals>;
}): SeasonStats {
  const { members, checkins } = input;
  const workoutCheckins = input.workoutCheckins ?? [];
  const memberIds = new Set(members.map((m) => m.id));

  // ── Meals: only «طبختها كما هي» is visible to the season ─────────────────
  // Swapped and skipped rows are invisible everywhere below (ring, strip,
  // stars, member scores) — one filter, so the surfaces can never disagree.
  const happened = checkins.filter(isCookedAsIs);

  // Meal-true family total: the DISH is the meal's identity, so a shared dinner
  // marked by three people is ONE followed meal (household size can never
  // inflate it), while mom's own lunch beside the children's is genuinely two.
  // Each day is rated against ITS OWN planned dishes, so the third star always
  // means «كل وجبات اليوم» (see starsForDay).
  const dishesPerDay = cookedDishesPerDay(happened, input.dishKeys);
  const plannedPerDay = input.plannedMealsPerDay ?? [];
  const days: SeasonDayCell[] = Array.from({ length: 7 }, (_, i) => {
    const cookedMeals = countDishes(dishesPerDay.get(i));
    const plannedMeals = Math.max(0, Math.floor(plannedPerDay[i] ?? 0));
    return {
      dayIndex: i,
      lit: cookedMeals > 0,
      cookedMeals,
      plannedMeals,
      complete: plannedMeals > 0 && cookedMeals >= plannedMeals,
      stars: starsForDay(cookedMeals, plannedMeals),
    };
  });
  const followedMeals = days.reduce((n, d) => n + d.cookedMeals, 0);
  const activeDays = days.filter((d) => d.lit).length;
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

  // The ring fills toward the household's OWN week (planned meals + sessions)
  // whenever the caller can derive it: now that every dish counts, a fixed
  // capacity would peg a large family at 100% by midweek. CAP is the fallback.
  const capacity =
    input.weeklyCapacity && input.weeklyCapacity > 0
      ? Math.floor(input.weeklyCapacity)
      : CAP;
  const fillFrac = Math.min(
    1,
    capacity > 0 ? (followedMeals + workoutActs) / capacity : 0,
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
    const S = hasWorkoutPillar ? Math.max(0, Math.floor(p.sessions ?? 0)) : undefined;
    let n: number;
    let d: number;
    if (S === undefined) {
      n = M > 0 ? Math.min(mealsMarked, M) : 0;
      d = M > 0 ? M : 1;
    } else {
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
      mealsMarked,
      mealsPlanned: M,
      ...(S !== undefined ? { sessionsMarked, sessionsPlanned: S } : {}),
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
