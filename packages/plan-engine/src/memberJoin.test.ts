import { describe, it, expect } from "vitest";

import {
  closedSlotsOn,
  isBeforeJoin,
  joinWindow,
  memberIsShort,
  memberMissingDayCount,
  openDayShare,
  type JoinToday,
} from "./memberJoin";
import type { Day, Meal, MealPlan, MemberPlan } from "./schema";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const meal = (slot: Meal["slot"], calories: number, name = `${slot}-dish`): Meal => ({
  slot,
  slot_name_ar: slot,
  recipe_name_ar: name,
  ingredients: [{ name_ar: "أرز", amount: 100, unit: "g" }],
  prep_steps_ar: ["اطبخي"],
  calories,
  macros: { protein_g: 10, carbs_g: 10, fat_g: 10 },
});

const day = (di: number, meals: Meal[]): Day => ({
  day_index: di,
  day_name_ar: `اليوم ${di + 1}`,
  meals,
  day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
});

/** A member with the standard table (breakfast 600 / lunch 900 / dinner 500) on the given days. */
const member = (member_id: string, mealedDays: number[], allDays = 7): MemberPlan => ({
  member_id,
  member_name_ar: member_id,
  daily_calories_target: 2000,
  macros_target: { protein_g: 120, carbs_g: 200, fat_g: 70 },
  days: Array.from({ length: allDays }, (_, di) =>
    day(
      di,
      mealedDays.includes(di)
        ? [meal("breakfast", 600), meal("lunch", 900), meal("dinner", 500)]
        : [],
    ),
  ),
});

const plan = (members: MemberPlan[], extra: Partial<MealPlan> = {}): MealPlan => ({
  week_start_date: "2026-06-06",
  members,
  days_total: 7,
  ...extra,
});

const ALL = [0, 1, 2, 3, 4, 5, 6];
const today = (dateISO: string, extra: Partial<JoinToday> = {}): JoinToday => ({
  dateISO,
  checkins: [],
  absences: [],
  ...extra,
});

// ── The one "short" rule ─────────────────────────────────────────────────────
describe("memberMissingDayCount / memberIsShort", () => {
  it("without a join record it is exactly the old rule (mealed days < days_total)", () => {
    const p = plan([member("mom", ALL), member("m1", [0, 1, 2])]);
    expect(memberMissingDayCount(p, p.members[0]!)).toBe(0);
    expect(memberMissingDayCount(p, p.members[1]!)).toBe(4);
    expect(memberIsShort(p, p.members[1]!)).toBe(true);
  });

  it("a member missing a day SHELL is still short (the count, not an empty-day scan)", () => {
    const p = plan([member("m1", [0, 1, 2, 3, 4, 5], 6)]);
    expect(memberMissingDayCount(p, p.members[0]!)).toBe(1);
  });

  it("days before a mid-week join are not missing — the newcomer is whole from day 3 on", () => {
    const p = plan([member("mom", ALL), member("new", [3, 4, 5, 6])], {
      member_joins: { new: { day_index: 3 } },
    });
    expect(memberIsShort(p, p.members[1]!)).toBe(false);
    // …but a post-join gap still counts.
    const gappy = plan([member("mom", ALL), member("new", [3, 5, 6])], {
      member_joins: { new: { day_index: 3 } },
    });
    expect(memberMissingDayCount(gappy, gappy.members[1]!)).toBe(1);
  });

  it("a member who joined after the week ended expects nothing this week", () => {
    const p = plan([member("mom", ALL), member("new", [])], {
      member_joins: { new: { day_index: 7 } },
    });
    expect(memberMissingDayCount(p, p.members[1]!)).toBe(0);
  });
});

describe("isBeforeJoin / closedSlotsOn", () => {
  const p = plan([member("mom", ALL), member("new", [2, 3, 4, 5, 6])], {
    member_joins: { new: { day_index: 2, closed_slots: ["breakfast"] } },
  });

  it("only the newcomer's days before their join are pre-join", () => {
    expect(isBeforeJoin(p, "new", 1)).toBe(true);
    expect(isBeforeJoin(p, "new", 2)).toBe(false);
    expect(isBeforeJoin(p, "mom", 0)).toBe(false);
  });

  it("closed slots apply on the join day only", () => {
    expect([...closedSlotsOn(p, "new", 2)]).toEqual(["breakfast"]);
    expect(closedSlotsOn(p, "new", 3).size).toBe(0);
    expect(closedSlotsOn(p, "mom", 2).size).toBe(0);
    expect(closedSlotsOn(null, "new", 2).size).toBe(0);
  });
});

// ── How much of a day is left ────────────────────────────────────────────────
describe("openDayShare", () => {
  const table = [meal("breakfast", 600), meal("lunch", 900), meal("dinner", 500)];

  it("weighs the open slots by the table's own calories", () => {
    expect(openDayShare(table, new Set(["breakfast"]))).toBeCloseTo(1400 / 2000);
    expect(openDayShare(table, new Set(["breakfast", "lunch"]))).toBeCloseTo(500 / 2000);
  });

  it("is a whole day when nothing is closed", () => {
    expect(openDayShare(table, new Set())).toBe(1);
  });

  it("falls back to a typical split when the table has nothing to measure", () => {
    expect(openDayShare([], new Set(["breakfast"]))).toBeCloseTo(0.75);
  });

  it("never returns zero — a fully closed table is guarded, not scaled to nothing", () => {
    expect(openDayShare(table, new Set(["breakfast", "lunch", "dinner"]))).toBe(1);
  });
});

// ── Where a newcomer's week starts ───────────────────────────────────────────
describe("joinWindow", () => {
  const shared = new Set(["mom", "m1", "new"]);
  const base = plan([member("mom", ALL), member("m1", ALL), member("indep", ALL)]);

  it("joins TODAY with nothing closed when today is unmarked", () => {
    // 2026-06-06 is day 0, so 06-09 is day 3.
    expect(joinWindow({ plan: base, sharedIds: shared, today: today("2026-06-09") })).toEqual({
      todayIndex: 3,
      join: { day_index: 3 },
    });
  });

  it("a present sharer's mark (any status) closes that slot for the newcomer", () => {
    const w = joinWindow({
      plan: base,
      sharedIds: shared,
      today: today("2026-06-09", {
        checkins: [
          { local_date: "2026-06-09", slot: "breakfast", member_id: "mom" },
          { local_date: "2026-06-09", slot: "lunch", member_id: "m1" },
        ],
      }),
    });
    expect(w?.join).toEqual({ day_index: 3, closed_slots: ["breakfast", "lunch"] });
  });

  it("the whole-house row closes a slot — named or legacy null", () => {
    const w = joinWindow({
      plan: base,
      sharedIds: shared,
      today: today("2026-06-09", {
        checkins: [
          { local_date: "2026-06-09", slot: "dinner", member_id: "household" },
          { local_date: "2026-06-09", slot: "breakfast", member_id: null },
        ],
      }),
    });
    expect(w?.join.closed_slots).toEqual(["breakfast", "dinner"]);
  });

  it("an independent member's private meal does not close the shared table's slot", () => {
    const w = joinWindow({
      plan: base,
      sharedIds: shared,
      today: today("2026-06-09", {
        checkins: [{ local_date: "2026-06-09", slot: "breakfast", member_id: "indep" }],
      }),
    });
    expect(w?.join).toEqual({ day_index: 3 });
  });

  it("an absentee's personal mark says nothing about the dish", () => {
    const w = joinWindow({
      plan: base,
      sharedIds: shared,
      today: today("2026-06-09", {
        checkins: [{ local_date: "2026-06-09", slot: "lunch", member_id: "m1" }],
        absences: [{ local_date: "2026-06-09", slot: "lunch", member_id: "m1" }],
      }),
    });
    expect(w?.join).toEqual({ day_index: 3 });
  });

  it("ignores rows from other dates and slots it does not know", () => {
    const w = joinWindow({
      plan: base,
      sharedIds: shared,
      today: today("2026-06-09", {
        checkins: [
          { local_date: "2026-06-08", slot: "breakfast", member_id: "mom" },
          { local_date: "2026-06-09", slot: "suhoor", member_id: "mom" },
        ],
      }),
    });
    expect(w?.join).toEqual({ day_index: 3 });
  });

  it("when every dish on today's table is answered, the newcomer starts tomorrow", () => {
    const checkins = (["breakfast", "lunch", "dinner"] as const).map((slot) => ({
      local_date: "2026-06-09",
      slot,
      member_id: "mom",
    }));
    expect(
      joinWindow({ plan: base, sharedIds: shared, today: today("2026-06-09", { checkins }) })
        ?.join,
    ).toEqual({ day_index: 4 });
    // On the week's last day there is no tomorrow in it.
    const last = checkins.map((c) => ({ ...c, local_date: "2026-06-12" }));
    expect(
      joinWindow({
        plan: base,
        sharedIds: shared,
        today: today("2026-06-12", { checkins: last }),
      })?.join,
    ).toEqual({ day_index: 7 });
  });

  it("after the week is over, nothing of it is left", () => {
    expect(
      joinWindow({ plan: base, sharedIds: shared, today: today("2026-06-20") }),
    ).toEqual({ todayIndex: 14, join: { day_index: 7 } });
  });

  it("a week that has not begun is all ahead — today's marks belong to another week", () => {
    expect(
      joinWindow({
        plan: base,
        sharedIds: shared,
        today: today("2026-06-05", {
          checkins: [{ local_date: "2026-06-05", slot: "breakfast", member_id: "mom" }],
        }),
      }),
    ).toEqual({ todayIndex: -1, join: { day_index: 0 } });
  });

  it("returns null when the week anchor cannot be read", () => {
    expect(
      joinWindow({
        plan: { ...base, week_start_date: "not-a-date" },
        sharedIds: shared,
        today: today("2026-06-09"),
      }),
    ).toBeNull();
  });
});
