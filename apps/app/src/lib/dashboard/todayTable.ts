/**
 * «سفرة اليوم» — today's meals for the WHOLE household as one table, the
 * dashboard's centerpiece (09/2026 redesign).
 *
 * /plan is organised by person (one tab per member); a kitchen is organised by
 * dish. So this folds every member's day into the dishes that actually get
 * cooked: a shared pot is ONE row carrying everyone who eats from it, a
 * member's own recipe is its own row. Each row carries exactly what a one-tap
 * «طبختها كما هي» needs to write the same mark /plan would:
 *   - shared dish → setSharedMealCheckin with the PRESENT sharers
 *     (per_member_portions minus meal_absences — the same `dishIds` roster
 *     PlanViewer uses, so the two surfaces can never disagree);
 *   - individual meal → setMealCheckin for that member.
 * Status is read through checkinMap.resolveCheckin, the one definition /plan
 * uses too (own/sharer row first, then the whole-house fallback).
 *
 * Pure: no dates, no I/O. The server resolves today's plan day_index.
 */

import type { Meal, MemberPlan } from "@fitlife/plan-engine";
import { orderDayMeals } from "@/lib/plans/mealOrder";
import {
  checkinMapKey,
  resolveCheckin,
  type CheckinMark,
} from "@/lib/engagement/checkinMap";
import type { CheckinStatus } from "@/lib/engagement/types";

export const OWNER_ID = "mom";

export interface TodayMark {
  day_index: number;
  slot: string;
  member_id: string | null;
  status: string;
  reason?: string | null;
}

export interface TodayAbsence {
  day_index: number;
  slot: string;
  member_id: string;
}

export interface TodayRow {
  /** Stable React key. */
  key: string;
  slot: Meal["slot"];
  /** The plan's own slot label («فطور»، «وجبة خفيفة مسائية»…). */
  slotLabel: string;
  recipeName: string;
  shared: boolean;
  /** Who eats it today, roster order, absentees removed. */
  eaterIds: string[];
  /** Planned sharers marked out of this occurrence, roster order. */
  absentIds: string[];
  /** The ids a mark is written for (present sharers, or the one member). */
  writeIds: string[];
  /** Calories of ONE portion, for `kcalFor` (the owner when she eats it). */
  kcal: number | null;
  kcalFor: string | null;
  status: CheckinStatus | null;
  /** Each PRESENT eater's share of the pot as a whole percent (shared dishes
   * with 2+ eaters only; empty otherwise). From portion_percentage, falling
   * back to portion_grams, then equal shares — renormalised after absences so
   * the bar always sums to 100 for the people actually eating. */
  shares: Array<{ id: string; pct: number }>;
  prepMinutes: number | null;
  cookMinutes: number | null;
  /** The dish in the cook's language, when the plan carries a translation. */
  translatedName: string | null;
  translatedLocale: string | null;
}

export interface TodayTable {
  rows: TodayRow[];
  /** Key of the first unmarked row — the one the timeline promotes. */
  nextKey: string | null;
  marked: number;
  cooked: number;
  /** The owner's day total vs her target, when she has one (not a minor on
   * portions — `daily_calories_target` is 0/absent for those). */
  ownerDay: { calories: number; target: number } | null;
}

const STATUS_SET = new Set<string>(["cooked", "swapped", "skipped"]);

function isStatus(s: string): s is CheckinStatus {
  return STATUS_SET.has(s);
}

/** The group a meal belongs to on the table: one pot = one row. */
function rowKeyFor(meal: Meal, memberId: string, indexInDay: number): string {
  if (meal.shared_recipe && meal.per_member_portions?.length) {
    return `s|${meal.slot}|${meal.recipe_name_ar.trim()}`;
  }
  return `i|${meal.slot}|${memberId}|${indexInDay}`;
}

/** Whole-percent shares for the present eaters, summing to exactly 100. */
export function potShares(meal: Meal, eaterIds: readonly string[]) {
  const portions = new Map(
    (meal.per_member_portions ?? []).map((p) => [p.member_id, p]),
  );
  const weightOf = (id: string, key: "portion_percentage" | "portion_grams") => {
    const v = Number(portions.get(id)?.[key]);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const pick = (key: "portion_percentage" | "portion_grams") =>
    eaterIds.map((id) => weightOf(id, key));
  let weights = pick("portion_percentage");
  if (weights.some((w) => w === 0)) weights = pick("portion_grams");
  if (weights.some((w) => w === 0)) weights = eaterIds.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  // Largest-remainder rounding, so the legend adds up to 100.
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return eaterIds.map((id, i) => ({ id, pct: floors[i]! }));
}

export function buildTodayTable(input: {
  members: readonly MemberPlan[];
  /** Roster order (owner first) — the order eaters are listed in. */
  rosterOrder: readonly string[];
  dayIndex: number;
  checkins: readonly TodayMark[];
  absences: readonly TodayAbsence[];
}): TodayTable {
  const { members, dayIndex } = input;
  const rank = (id: string) => {
    const i = input.rosterOrder.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const byRoster = (a: string, b: string) => rank(a) - rank(b);

  const map = new Map<string, CheckinMark>();
  for (const c of input.checkins) {
    if (c.day_index !== dayIndex || !isStatus(c.status)) continue;
    map.set(checkinMapKey(dayIndex, c.slot, c.member_id ?? "household"), {
      status: c.status,
      reason: c.reason ?? null,
    });
  }
  const absent = new Set(
    input.absences
      .filter((a) => a.day_index === dayIndex)
      .map((a) => `${a.slot}|${a.member_id}`),
  );

  const dayOf = (m: MemberPlan) => m.days.find((d) => d.day_index === dayIndex);
  const familyDayMeals = members.map((m) => dayOf(m)?.meals ?? []);

  // Merge every member's ordered day into one sequence. The owner goes first so
  // her day defines the spine; a row someone else adds is inserted just before
  // the next row of THEIR day that is already placed (their breakfast lands
  // before the shared lunch, not at the end), so each person's own sequence
  // stays in order.
  const orderedMembers = [...members].sort((a, b) =>
    byRoster(a.member_id, b.member_id),
  );
  const sequence: string[] = [];
  const groups = new Map<
    string,
    { meal: Meal; kcalById: Map<string, number>; memberIds: Set<string> }
  >();
  for (const m of orderedMembers) {
    const own = dayOf(m)?.meals ?? [];
    const ordered = orderDayMeals(own, familyDayMeals);
    const keys = ordered.map((meal, i) => rowKeyFor(meal, m.member_id, i));
    ordered.forEach((meal, i) => {
      const key = keys[i]!;
      let g = groups.get(key);
      if (!g) {
        g = { meal, kcalById: new Map(), memberIds: new Set() };
        groups.set(key, g);
      }
      g.kcalById.set(m.member_id, meal.calories);
      g.memberIds.add(m.member_id);
      if (sequence.includes(key)) return;
      const nextPlaced = keys.slice(i + 1).find((k) => sequence.includes(k));
      const at = nextPlaced ? sequence.indexOf(nextPlaced) : sequence.length;
      sequence.splice(at, 0, key);
    });
  }

  const rows: TodayRow[] = [];
  for (const key of sequence) {
    const g = groups.get(key)!;
    const { meal } = g;
    const shared = key.startsWith("s|");
    const planned = shared
      ? meal.per_member_portions!.map((p) => p.member_id)
      : [...g.memberIds];
    const present = planned.filter((id) => !absent.has(`${meal.slot}|${id}`));
    // Everyone-absent is a data-only edge (the UI refuses to remove the last
    // sharer); keep the full roster so the status still has somewhere to land,
    // exactly as PlanViewer does.
    const writeIds = present.length > 0 ? present : planned;
    const eaterIds = [...present].sort(byRoster);
    const mark = resolveCheckin(map, dayIndex, meal.slot, writeIds);
    const kcalFor = eaterIds.includes(OWNER_ID)
      ? OWNER_ID
      : (eaterIds.find((id) => g.kcalById.has(id)) ?? null);
    const kcal = kcalFor ? (g.kcalById.get(kcalFor) ?? null) : null;
    rows.push({
      shares: shared && eaterIds.length > 1 ? potShares(meal, eaterIds) : [],
      prepMinutes: meal.prep_time_minutes ?? null,
      cookMinutes: meal.cook_time_minutes ?? null,
      translatedName: meal.recipe_name_translated ?? null,
      translatedLocale: meal.prep_steps_translated_locale ?? null,
      key,
      slot: meal.slot,
      slotLabel: meal.slot_name_ar,
      recipeName: meal.recipe_name_ar,
      shared,
      eaterIds,
      absentIds: planned.filter((id) => !present.includes(id)).sort(byRoster),
      writeIds,
      kcal: kcal != null ? Math.round(kcal) : null,
      kcalFor,
      status: mark?.status ?? null,
    });
  }

  const owner = members.find((m) => m.member_id === OWNER_ID);
  const ownerDayPlan = owner ? dayOf(owner) : undefined;
  const target = owner?.daily_calories_target ?? 0;
  const ownerDay =
    ownerDayPlan && target > 0
      ? { calories: Math.round(ownerDayPlan.day_total.calories), target: Math.round(target) }
      : null;

  return {
    rows,
    nextKey: rows.find((r) => r.status === null)?.key ?? null,
    marked: rows.filter((r) => r.status !== null).length,
    cooked: rows.filter((r) => r.status === "cooked").length,
    ownerDay,
  };
}
