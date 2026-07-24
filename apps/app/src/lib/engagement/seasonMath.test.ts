import { describe, expect, it } from "vitest";

import {
  computeSeasonStats,
  dayHasNonSkippedMark,
  WEEKLY_TARGET,
  type SeasonMealMark,
  type SeasonMember,
  type SeasonWorkoutMark,
} from "./seasonMath";

const WEEK_START = "2026-07-17"; // Friday, matching a real plan anchor

const members: SeasonMember[] = [
  { id: "mom", name: "نورة", sex: "female" },
  { id: "m1", name: "سالم", sex: "male" },
  { id: "m2", name: "لينا", sex: "female" },
];

function mark(overrides: Partial<SeasonMealMark> = {}): SeasonMealMark {
  return { day_index: 0, slot: "lunch", status: "cooked", member_id: "mom", ...overrides };
}

function workout(overrides: Partial<SeasonWorkoutMark> = {}): SeasonWorkoutMark {
  return {
    day_index: 1,
    member_id: "mom",
    status: "done",
    local_date: "2026-07-18",
    ...overrides,
  };
}

describe("computeSeasonStats — meals", () => {
  it("collapses a shared meal's fan-out to ONE family meal but credits each sharer", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "mom" }),
        mark({ member_id: "m1" }),
        mark({ member_id: "m2" }),
      ],
      verdicts: [],
    });
    expect(stats.followedMeals).toBe(1);
    expect(stats.days[0]!.lit).toBe(true);
    expect(stats.days[0]!.stars).toBe(1);
    expect(stats.ranked.map((m) => m.score)).toEqual([1, 1, 1]);
  });

  it("household sentinel rows light family surfaces but never buy member rank", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "household" }),
        mark({ member_id: "household", slot: "dinner", day_index: 2 }),
      ],
      verdicts: [],
    });
    expect(stats.followedMeals).toBe(2);
    expect(stats.activeDays).toBe(2);
    expect(stats.days[0]!.lit).toBe(true);
    expect(stats.days[2]!.lit).toBe(true);
    expect(stats.hasActivity).toBe(true);
    expect(stats.ranked.every((m) => m.score === 0)).toBe(true);
    expect(stats.hasWinner).toBe(false);
    expect(stats.leaderName).toBeNull();
  });

  it("skipped meals earn nothing — no ring, no strip, no member credit", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ status: "skipped" })],
      verdicts: [],
    });
    expect(stats.followedMeals).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.days[0]!.lit).toBe(false);
    expect(stats.hasActivity).toBe(false);
    expect(stats.ranked[0]!.score).toBe(0);
  });

  it("a mixed slot (one cooked, one skipped) counts the meal once and credits only the cook", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "mom", status: "cooked" }),
        mark({ member_id: "m1", status: "skipped" }),
      ],
      verdicts: [],
    });
    expect(stats.followedMeals).toBe(1);
    const byId = Object.fromEntries(stats.ranked.map((m) => [m.id, m.score]));
    expect(byId.mom).toBe(1);
    expect(byId.m1).toBe(0);
  });

  it("swapped counts like cooked (a meal that happened)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ status: "swapped" })],
      verdicts: [],
    });
    expect(stats.followedMeals).toBe(1);
    expect(stats.ranked[0]!.score).toBe(1);
  });

  it("stars cap at 3 distinct slots and ignore skipped slots", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ slot: "breakfast" }),
        mark({ slot: "lunch" }),
        mark({ slot: "dinner" }),
        mark({ slot: "snack" }),
        mark({ slot: "snack", member_id: "m1", status: "skipped" }),
      ],
      verdicts: [],
    });
    expect(stats.days[0]!.stars).toBe(3);
  });
});

describe("computeSeasonStats — verdicts", () => {
  it("each verdict is one point for its member (mom included)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ member_id: "mom" })],
      verdicts: [{ verdict: "loved", member_id: "mom" }, { verdict: "fine", member_id: "m1" }],
    });
    const byId = Object.fromEntries(stats.ranked.map((m) => [m.id, m.score]));
    expect(byId.mom).toBe(2); // mark + verdict — the flat formula stacks acts
    expect(byId.m1).toBe(1);
  });

  it("verdicts from outside the roster (e.g. removed member) are ignored", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [{ verdict: "loved", member_id: "ghost" }],
    });
    expect(stats.ranked.every((m) => m.score === 0)).toBe(true);
  });
});

describe("computeSeasonStats — workouts", () => {
  it("counts done and moved sessions inside the plan week", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: [
        workout({ status: "done", day_index: 1, local_date: "2026-07-18" }),
        workout({ status: "moved", day_index: 3, local_date: "2026-07-20" }),
      ],
      weekStartDate: WEEK_START,
    });
    expect(stats.workoutActs).toBe(2);
    expect(stats.sessionsDone).toBe(2);
    expect(stats.hasActivity).toBe(true);
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.score).toBe(2);
  });

  it("excludes sessions dated outside the meal plan week (stale prior-week marks)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: [
        workout({ local_date: "2026-07-10" }), // before the week
        workout({ day_index: 2, local_date: "2026-07-24" }), // after week end (07-23)
      ],
      weekStartDate: WEEK_START,
    });
    expect(stats.workoutActs).toBe(0);
    expect(stats.sessionsDone).toBe(0);
    expect(stats.ranked.every((m) => m.score === 0)).toBe(true);
  });

  it("drops rows without local_date when a week anchor is given, keeps them without one", () => {
    const rows = [workout({ local_date: null })];
    const scoped = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: rows,
      weekStartDate: WEEK_START,
    });
    expect(scoped.workoutActs).toBe(0);
    const unscoped = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: rows,
    });
    expect(unscoped.workoutActs).toBe(1);
  });

  it("a skipped session never counts anywhere", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: [workout({ status: "skipped" })],
      weekStartDate: WEEK_START,
    });
    expect(stats.workoutActs).toBe(0);
    expect(stats.sessionsDone).toBe(0);
    expect(stats.hasActivity).toBe(false);
    expect(stats.ranked.every((m) => m.score === 0)).toBe(true);
  });
});

describe("computeSeasonStats — workout window (decoupled from the meal week)", () => {
  it("scopes workouts to the explicit workout window, not the meal week_start_date", () => {
    // The meal plan is a STALE prior week; the workout was marked THIS week.
    // Under the old meal-week scoping the mark was dropped; it must now count.
    const stats = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: [
        workout({ member_id: "mom", day_index: 3, local_date: "2026-07-22" }),
      ],
      weekStartDate: "2026-07-06", // stale meal week [07-06 … 07-12]
      workoutWeekStart: "2026-07-19", // current week [07-19 … 07-23]
      workoutWeekEnd: "2026-07-23",
    });
    expect(stats.workoutActs).toBe(1);
    expect(stats.ranked.find((m) => m.id === "mom")!.score).toBe(1);
  });

  it("drops a workout outside the workout window even if it lands inside the meal week", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: [
        workout({ member_id: "mom", day_index: 3, local_date: "2026-07-10" }),
      ],
      weekStartDate: "2026-07-06", // meal week [07-06 … 07-12] contains 07-10
      workoutWeekStart: "2026-07-19",
      workoutWeekEnd: "2026-07-23",
    });
    expect(stats.workoutActs).toBe(0);
    expect(stats.ranked.every((m) => m.score === 0)).toBe(true);
  });

  it("falls back to meal week+6 when no explicit workout window is given", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
      verdicts: [],
      workoutCheckins: [
        workout({ member_id: "mom", day_index: 1, local_date: "2026-07-18" }),
      ],
      weekStartDate: WEEK_START, // [07-17 … 07-23]
    });
    expect(stats.workoutActs).toBe(1);
  });
});

describe("computeSeasonStats — per-member targets (owner directive: % of OWN plan)", () => {
  it("divides each member's acts by their own planned total, not a flat target", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "mom", day_index: 0 }),
        mark({ member_id: "mom", day_index: 1 }),
        mark({ member_id: "m1", day_index: 0 }),
        mark({ member_id: "m1", day_index: 1 }),
      ],
      verdicts: [],
      targets: { mom: 20, m1: 5, m2: 10 },
    });
    const byId = Object.fromEntries(stats.ranked.map((m) => [m.id, m]));
    expect(byId.mom!.pct).toBeCloseTo(2 / 20);
    expect(byId.mom!.target).toBe(20);
    expect(byId.m1!.pct).toBeCloseTo(2 / 5);
    expect(byId.m1!.target).toBe(5);
  });

  it("ranks by completion % — fewer absolute acts can outrank more", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        // mom: 3 acts of 30 planned (10%); m1: 2 acts of 5 planned (40%).
        mark({ member_id: "mom", day_index: 0, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 0, slot: "lunch" }),
        mark({ member_id: "mom", day_index: 0, slot: "dinner" }),
        mark({ member_id: "m1", day_index: 0 }),
        mark({ member_id: "m1", day_index: 1 }),
      ],
      verdicts: [],
      targets: { mom: 30, m1: 5, m2: 10 },
    });
    expect(stats.ranked[0]!.id).toBe("m1");
    expect(stats.ranked[1]!.id).toBe("mom");
  });

  it("breaks an exact % tie by absolute acts", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        // mom: 4/20 = 20%; m1: 1/5 = 20% — mom's 4 acts beat m1's 1.
        mark({ member_id: "mom", day_index: 0, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 0, slot: "lunch" }),
        mark({ member_id: "mom", day_index: 1, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 1, slot: "lunch" }),
        mark({ member_id: "m1", day_index: 0 }),
      ],
      verdicts: [],
      targets: { mom: 20, m1: 5, m2: 10 },
    });
    expect(stats.ranked[0]!.id).toBe("mom");
    expect(stats.ranked[0]!.pct).toBeCloseTo(stats.ranked[1]!.pct);
  });

  it("caps at 100% when acts exceed the member's planned total", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "m1", day_index: 0, slot: "breakfast" }),
        mark({ member_id: "m1", day_index: 0, slot: "lunch" }),
        mark({ member_id: "m1", day_index: 1, slot: "breakfast" }),
      ],
      verdicts: [{ verdict: "loved", member_id: "m1" }],
      targets: { mom: 10, m1: 3, m2: 10 },
    });
    const m1 = stats.ranked.find((m) => m.id === "m1")!;
    expect(m1.score).toBe(4);
    expect(m1.pct).toBe(1);
  });

  it("falls back to WEEKLY_TARGET for a missing or zero target (degraded read)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ member_id: "mom" })],
      verdicts: [],
      targets: { mom: 0 }, // m1/m2 absent entirely
    });
    const byId = Object.fromEntries(stats.ranked.map((m) => [m.id, m]));
    expect(byId.mom!.target).toBe(WEEKLY_TARGET);
    expect(byId.mom!.pct).toBeCloseTo(1 / WEEKLY_TARGET);
    expect(byId.m1!.target).toBe(WEEKLY_TARGET);
  });
});

describe("computeSeasonStats — ranking", () => {
  it("caps the percentage at 100% and the family ring at 1", () => {
    const stats = computeSeasonStats({
      members,
      checkins: Array.from({ length: 7 }, (_, day) =>
        ["breakfast", "lunch", "dinner"].map((slot) =>
          mark({ day_index: day, slot, member_id: "mom" }),
        ),
      ).flat(),
      verdicts: [],
    });
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.score).toBe(21);
    expect(mom.score).toBeGreaterThan(WEEKLY_TARGET);
    expect(mom.pct).toBe(1);
    expect(stats.fillFrac).toBe(1);
  });

  it("breaks a score tie by distinct meal days (spread beats a one-day burst)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        // m1: 2 acts on one day; m2: 2 acts across two days → m2 ranks higher.
        mark({ member_id: "m1", day_index: 0, slot: "lunch" }),
        mark({ member_id: "m1", day_index: 0, slot: "dinner" }),
        mark({ member_id: "m2", day_index: 0, slot: "lunch" }),
        mark({ member_id: "m2", day_index: 1, slot: "lunch" }),
      ],
      verdicts: [],
    });
    expect(stats.ranked.map((m) => m.id)).toEqual(["m2", "m1", "mom"]);
    expect(stats.leaderName).toBe("لينا");
  });

  it("a full tie keeps roster order (mom first) — deterministic across renders", () => {
    const checkins = [
      mark({ member_id: "mom" }),
      mark({ member_id: "m1" }),
      mark({ member_id: "m2" }),
    ];
    const a = computeSeasonStats({ members, checkins, verdicts: [] });
    const b = computeSeasonStats({ members, checkins, verdicts: [] });
    expect(a.ranked.map((m) => m.id)).toEqual(["mom", "m1", "m2"]);
    expect(b.ranked.map((m) => m.id)).toEqual(a.ranked.map((m) => m.id));
    expect(a.leaderName).toBe("نورة");
  });

  it("keeps rosterIndex stable regardless of rank (avatar colours never shuffle)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ member_id: "m2" })],
      verdicts: [],
    });
    expect(stats.ranked[0]!.id).toBe("m2");
    expect(stats.ranked[0]!.rosterIndex).toBe(2);
  });
});

describe("dayHasNonSkippedMark", () => {
  it("is false for a skipped-only day, true for a household cooked mark", () => {
    const checkins = [
      mark({ day_index: 0, status: "skipped" }),
      mark({ day_index: 1, member_id: "household" }),
    ];
    expect(dayHasNonSkippedMark(checkins, 0)).toBe(false);
    expect(dayHasNonSkippedMark(checkins, 1)).toBe(true);
    expect(dayHasNonSkippedMark(checkins, 2)).toBe(false);
  });
});
