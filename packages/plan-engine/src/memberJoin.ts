import type { Meal, MealPlan, MemberPlan } from "./schema";

/**
 * Mid-week joins: a member added to a plan week that is already under way.
 *
 * The week has a history by the time someone joins it. Days that have passed
 * were eaten, and a meal the household already marked — cooked as planned,
 * swapped, skipped — happened the way it happened. Adding a person rewrites
 * neither. The newcomer is planned from the first meal still ahead of the
 * household, and everything before that stays exactly as it was, for them and
 * for everyone else:
 *
 *   - days before today: untouched, and the newcomer has no meals on them;
 *   - today: the menu stays as planned; the newcomer takes a portion of every
 *     dish still OPEN (unmarked), never of one already answered;
 *   - days after today: the shared menu is rebuilt with the newcomer at the
 *     table (what a shared add always did, now only for what is left).
 *
 * `plan_data.member_joins` records where each newcomer's week starts, so every
 * later run and every surface agrees on it. Days before it are EMPTY BY DESIGN,
 * which is the trap this module closes: the drain, the chain continuation and
 * the sweeper all decide who is "short" by counting days that have meals. A
 * count that included pre-join days would send them to "refill" history — a
 * paid model call per page visit, putting the newcomer into meals that were
 * already eaten. Anything asking "is this member missing days?" asks
 * memberIsShort.
 */

export type MealSlot = Meal["slot"];

/** Schema enum order — gives closed_slots a stable, comparable order. */
const SLOT_ORDER: readonly MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

function isMealSlot(v: string): v is MealSlot {
  return (SLOT_ORDER as readonly string[]).includes(v);
}

/** One member's entry in plan_data.member_joins. */
export interface MemberJoin {
  /** First day_index of the plan week this member is planned for. May equal
   * the week's length: added after its last open meal, so nothing this week. */
  day_index: number;
  /** On that first day, the slots already answered when they were added —
   * they are never given these, by this run or by any refill. */
  closed_slots?: MealSlot[];
}

type JoinsCarrier = Pick<MealPlan, "member_joins"> | null | undefined;

const NO_SLOTS: ReadonlySet<MealSlot> = new Set();

export function memberJoinOf(plan: JoinsCarrier, memberId: string): MemberJoin | null {
  return plan?.member_joins?.[memberId] ?? null;
}

/** First day_index this member is planned for — 0 for anyone there from the start. */
export function memberJoinDayIndex(plan: JoinsCarrier, memberId: string): number {
  return memberJoinOf(plan, memberId)?.day_index ?? 0;
}

/** A day that predates the member's addition: empty on purpose, never "missing". */
export function isBeforeJoin(
  plan: JoinsCarrier,
  memberId: string,
  dayIndex: number,
): boolean {
  return dayIndex < memberJoinDayIndex(plan, memberId);
}

/**
 * Slots the member must not be given on `dayIndex`. Non-empty only on the day
 * they joined, and only when some of that day's meals were already answered.
 */
export function closedSlotsOn(
  plan: JoinsCarrier,
  memberId: string,
  dayIndex: number,
): ReadonlySet<MealSlot> {
  const join = memberJoinOf(plan, memberId);
  if (!join || join.day_index !== dayIndex || !join.closed_slots?.length) return NO_SLOTS;
  return new Set(join.closed_slots);
}

/**
 * How many of the days a member is expected to have are still without meals —
 * THE definition of "short", for the engine and every caller that re-dispatches
 * a refill (chain, drain, sweeper, the housekeeper's partial-week notice).
 *
 * Expected days run from the member's join day to the end of the week. With no
 * join record this is exactly the rule it replaces (`mealed days < days_total`),
 * which is why the count — not "is any day empty" — is kept: a member whose
 * `days` array lacks a shell is short too.
 */
export function memberMissingDayCount(
  plan: Pick<MealPlan, "days_total" | "member_joins">,
  member: Pick<MemberPlan, "member_id" | "days">,
): number {
  const daysTotal = plan.days_total ?? 7;
  const from = Math.min(memberJoinDayIndex(plan, member.member_id), daysTotal);
  const mealed = member.days.filter(
    (d) => d.day_index >= from && d.meals.length > 0,
  ).length;
  return Math.max(0, daysTotal - from - mealed);
}

export function memberIsShort(
  plan: Pick<MealPlan, "days_total" | "member_joins">,
  member: Pick<MemberPlan, "member_id" | "days">,
): boolean {
  return memberMissingDayCount(plan, member) > 0;
}

/**
 * A typical day's split across the slots — only for a table with nothing on it
 * to measure (every member's day on the refill list at once).
 */
const TYPICAL_SLOT_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

/**
 * The part of a day still ahead of someone who joins partway through it: the
 * open slots' share of the day's calories, measured on the table they join.
 * Their first-day target is scaled by it — they eat what is left of the day,
 * not a whole day's food squeezed into the meals that remain. Always in (0, 1].
 */
export function openDayShare(
  meals: ReadonlyArray<Pick<Meal, "slot" | "calories">>,
  closed: ReadonlySet<MealSlot>,
): number {
  if (closed.size === 0) return 1;
  let all = 0;
  let open = 0;
  for (const m of meals) {
    const c = Math.max(0, m.calories || 0);
    all += c;
    if (!closed.has(m.slot)) open += c;
  }
  let share: number;
  if (all > 0) share = open / all;
  else {
    let gone = 0;
    for (const s of closed) gone += TYPICAL_SLOT_SHARE[s];
    share = 1 - gone;
  }
  return share > 0 && share <= 1 ? share : 1;
}

// ── Where a newcomer's week starts ─────────────────────────────────────────

/** meal_checkins.member_id for a row that speaks for the whole house (legacy
 * pre-per-person rows and the ختام اليوم ritual). Mirrors
 * HOUSEHOLD_CHECKIN_MEMBER in apps/app — the engine cannot import the app. */
export const HOUSEHOLD_MARK_MEMBER = "household";

/** A meal_checkins or meal_absences row — only the columns read here. */
export interface DayMarkRow {
  local_date?: string | null;
  slot: string;
  member_id?: string | null;
}

/** What the household has already recorded for today, read when the run starts. */
export interface JoinToday {
  /** Riyadh calendar date of now (YYYY-MM-DD) — what meal_checkins is keyed by. */
  dateISO: string;
  /** Today's meal_checkins rows (any status: cooked, swapped, skipped). */
  checkins: readonly DayMarkRow[];
  /** Today's meal_absences rows. */
  absences: readonly DayMarkRow[];
}

/**
 * Where a newcomer joining the shared table starts, given the plan and what
 * today already holds. Pure.
 *
 * A slot of today is closed once someone AT the shared table has answered it:
 * a present sharer's mark is the dish's status (the fan-out writes one row per
 * sharer), and the whole-house row speaks for everyone. An absentee's mark is
 * personal — they sat that meal out — and says nothing about the dish, the same
 * reading /plan gives it. Slot-keyed like every engagement row, so a day with
 * two snacks closes both with one mark.
 *
 * Returns null when the week anchor cannot be read: with no basis for "what has
 * passed", the caller keeps the whole-week rebuild rather than guess.
 */
export function joinWindow(params: {
  plan: MealPlan;
  /** The shared table: mom when shared + every shared member. */
  sharedIds: ReadonlySet<string>;
  today: JoinToday;
}): { todayIndex: number; join: MemberJoin } | null {
  const { plan, sharedIds, today } = params;
  const start = Date.parse(`${plan.week_start_date}T00:00:00Z`);
  const now = Date.parse(`${today.dateISO}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return null;

  const weekLength = Math.min(7, plan.days_total ?? 7);
  const todayIndex = Math.round((now - start) / 86_400_000);
  // The week has not begun (a clock edge — plans start on the day they are
  // made): all of it is ahead, and today's marks belong to another week.
  if (todayIndex < 0) return { todayIndex: -1, join: { day_index: 0 } };
  // The week is over — nothing of it is left to join.
  if (todayIndex >= weekLength) return { todayIndex, join: { day_index: weekLength } };

  const tableSlots = new Set<MealSlot>();
  for (const m of plan.members) {
    if (!sharedIds.has(m.member_id)) continue;
    for (const meal of m.days.find((d) => d.day_index === todayIndex)?.meals ?? [])
      tableSlots.add(meal.slot);
  }

  const absent = new Set(
    today.absences
      .filter((a) => a.local_date === today.dateISO)
      .map((a) => `${a.slot}|${a.member_id}`),
  );
  const answered = new Set<MealSlot>();
  for (const row of today.checkins) {
    if (row.local_date !== today.dateISO || !isMealSlot(row.slot)) continue;
    const who = row.member_id || HOUSEHOLD_MARK_MEMBER;
    const speaksForTable =
      who === HOUSEHOLD_MARK_MEMBER ||
      (sharedIds.has(who) && !absent.has(`${row.slot}|${who}`));
    if (speaksForTable) answered.add(row.slot);
  }

  const closed = SLOT_ORDER.filter((s) => tableSlots.has(s) && answered.has(s));
  // Every dish on today's table is answered: nothing of today is left, so the
  // newcomer starts tomorrow (or not this week, on its last day).
  if (tableSlots.size > 0 && closed.length === tableSlots.size) {
    return { todayIndex, join: { day_index: Math.min(todayIndex + 1, weekLength) } };
  }
  return {
    todayIndex,
    join:
      closed.length > 0
        ? { day_index: todayIndex, closed_slots: closed }
        : { day_index: todayIndex },
  };
}
