import { describe, expect, it } from "vitest";

import {
  collapseMealMarks,
  collapseWorkoutMarks,
  computeSeasonStats,
  dayHasCookedMark,
  workoutMarkingWindow,
  type RawSeasonMealRow,
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

function rawRow(overrides: Partial<RawSeasonMealRow> = {}): RawSeasonMealRow {
  return {
    local_date: WEEK_START,
    day_index: 0,
    slot: "lunch",
    status: "cooked",
    member_id: "mom",
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
    });
    expect(stats.followedMeals).toBe(1);
    const byId = Object.fromEntries(stats.ranked.map((m) => [m.id, m.score]));
    expect(byId.mom).toBe(1);
    expect(byId.m1).toBe(0);
  });

  it("swapped earns nothing either — only «طبختها كما هي» scores", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ status: "swapped" })],
      planned: { mom: { meals: 5 }, m1: { meals: 5 }, m2: { meals: 5 } },
    });
    expect(stats.followedMeals).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.days[0]!.lit).toBe(false);
    expect(stats.hasActivity).toBe(false);
    expect(stats.ranked[0]!.score).toBe(0);
    expect(stats.ranked[0]!.pct).toBe(0);
    expect(stats.hasWinner).toBe(false);
  });

  it("a swap on a shared meal never lights the slot for anyone", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "mom", status: "swapped" }),
        mark({ member_id: "m1", status: "swapped" }),
        mark({ member_id: "m2", status: "swapped" }),
      ],
    });
    expect(stats.followedMeals).toBe(0);
    expect(stats.ranked.every((m) => m.score === 0)).toBe(true);
  });

  it("credits only the cooked-as-is meal in a mixed week", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "mom", day_index: 0, slot: "lunch", status: "cooked" }),
        mark({ member_id: "mom", day_index: 1, slot: "lunch", status: "swapped" }),
        mark({ member_id: "mom", day_index: 2, slot: "lunch", status: "skipped" }),
      ],
      planned: { mom: { meals: 3 }, m1: { meals: 3 }, m2: { meals: 3 } },
    });
    expect(stats.followedMeals).toBe(1);
    expect(stats.activeDays).toBe(1);
    expect(stats.days.map((d) => d.lit)).toEqual([
      true, false, false, false, false, false, false,
    ]);
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.mealsMarked).toBe(1);
    expect(mom.pct).toBeCloseTo(1 / 3);
  });

  it("stars cap at 3 distinct slots and ignore swapped/skipped slots", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ slot: "breakfast" }),
        mark({ slot: "lunch" }),
        mark({ slot: "dinner" }),
        mark({ slot: "snack" }),
        mark({ slot: "snack", member_id: "m1", status: "skipped" }),
      ],
    });
    expect(stats.days[0]!.stars).toBe(3);

    const swapped = computeSeasonStats({
      members,
      checkins: [
        mark({ slot: "breakfast" }),
        mark({ slot: "lunch", status: "swapped" }),
        mark({ slot: "dinner", status: "swapped" }),
      ],
    });
    expect(swapped.days[0]!.stars).toBe(1);
  });
});

describe("computeSeasonStats — plan-completion % (owner formula)", () => {
  it("meals-only member: % = mealsMarked / mealsPlanned", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "mom", day_index: 0 }),
        mark({ member_id: "mom", day_index: 1 }),
      ],
      planned: { mom: { meals: 5 }, m1: { meals: 5 }, m2: { meals: 5 } },
    });
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.pct).toBeCloseTo(2 / 5);
    expect(mom.score).toBe(2);
  });

  it("member with a workout plan: ½·meals + ½·sessions, each against its own planned count", () => {
    const stats = computeSeasonStats({
      members,
      checkins: Array.from({ length: 7 }, (_, day) =>
        mark({ member_id: "mom", day_index: day }),
      ),
      workoutCheckins: [
        workout({ local_date: "2026-07-18" }),
        workout({ local_date: "2026-07-19" }),
        workout({ local_date: "2026-07-20" }),
      ],
      weekStartDate: WEEK_START,
      planned: {
        mom: { meals: 14, sessions: 3 },
        m1: { meals: 14 },
        m2: { meals: 14 },
      },
    });
    // 0.5·(7/14) + 0.5·(3/3) = 0.75
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.pct).toBeCloseTo(0.75);
    expect(mom.score).toBe(10);
  });

  it("each pillar caps at its half — over-marking exercise can't exceed 50%", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
      workoutCheckins: [
        workout({ local_date: "2026-07-17" }),
        workout({ local_date: "2026-07-18" }),
        workout({ local_date: "2026-07-19" }),
        workout({ local_date: "2026-07-20" }),
      ],
      weekStartDate: WEEK_START,
      planned: { mom: { meals: 21, sessions: 3 }, m1: { meals: 21 }, m2: { meals: 21 } },
    });
    // 4 sessions done of 3 planned → session pillar full (0.5), meals 0.
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.pct).toBeCloseTo(0.5);
  });

  it("caps at 100% when everything planned is marked", () => {
    const stats = computeSeasonStats({
      members,
      checkins: Array.from({ length: 7 }, (_, day) =>
        ["breakfast", "lunch", "dinner"].map((slot) =>
          mark({ day_index: day, slot, member_id: "mom" }),
        ),
      ).flat(),
      planned: { mom: { meals: 21 }, m1: { meals: 21 }, m2: { meals: 21 } },
    });
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.score).toBe(21);
    expect(mom.pct).toBe(1);
    expect(stats.fillFrac).toBe(1);
  });

  it("ranks by completion % — fewer absolute marks can outrank more", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        // mom: 3 of 30 planned (10%); m1: 2 of 5 planned (40%).
        mark({ member_id: "mom", day_index: 0, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 0, slot: "lunch" }),
        mark({ member_id: "mom", day_index: 0, slot: "dinner" }),
        mark({ member_id: "m1", day_index: 0 }),
        mark({ member_id: "m1", day_index: 1 }),
      ],
      planned: { mom: { meals: 30 }, m1: { meals: 5 }, m2: { meals: 10 } },
    });
    expect(stats.ranked[0]!.id).toBe("m1");
    expect(stats.ranked[1]!.id).toBe("mom");
  });

  it("breaks an exact % tie by absolute marks", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        // mom: 4/20 = 20%; m1: 1/5 = 20% — mom's 4 marks beat m1's 1.
        mark({ member_id: "mom", day_index: 0, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 0, slot: "lunch" }),
        mark({ member_id: "mom", day_index: 1, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 1, slot: "lunch" }),
        mark({ member_id: "m1", day_index: 0 }),
      ],
      planned: { mom: { meals: 20 }, m1: { meals: 5 }, m2: { meals: 10 } },
    });
    expect(stats.ranked[0]!.id).toBe("mom");
    expect(stats.ranked[0]!.pct).toBeCloseTo(stats.ranked[1]!.pct);
  });

  it("a meals-only member competes fairly against a 50/50 member", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        // m1 (meals only): 3/6 = 50%. mom (both pillars): 0.5·(2/6)+0.5·(1/3) = 1/3.
        mark({ member_id: "m1", day_index: 0, slot: "breakfast" }),
        mark({ member_id: "m1", day_index: 0, slot: "lunch" }),
        mark({ member_id: "m1", day_index: 1, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 0, slot: "breakfast" }),
        mark({ member_id: "mom", day_index: 0, slot: "lunch" }),
      ],
      workoutCheckins: [workout({ local_date: "2026-07-18" })],
      weekStartDate: WEEK_START,
      planned: { mom: { meals: 6, sessions: 3 }, m1: { meals: 6 }, m2: { meals: 6 } },
    });
    expect(stats.ranked[0]!.id).toBe("m1");
    expect(stats.ranked[0]!.pct).toBeCloseTo(0.5);
    expect(stats.ranked[1]!.id).toBe("mom");
    expect(stats.ranked[1]!.pct).toBeCloseTo(1 / 3);
  });

  it("degenerate planned (zero/missing) yields 0% but marks still count as score", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ member_id: "mom" })],
      planned: { mom: { meals: 0 } }, // m1/m2 absent entirely
    });
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.pct).toBe(0);
    expect(mom.score).toBe(1); // still «حاضرة», still the leader by score
    expect(stats.hasWinner).toBe(true);
    expect(stats.leaderName).toBe("نورة");
  });

  it("no planned map at all → all pct 0, ranking falls back to score", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ member_id: "m2" })],
    });
    expect(stats.ranked[0]!.id).toBe("m2");
    expect(stats.ranked.every((m) => m.pct === 0)).toBe(true);
  });

  it("exposes the breakdown counts — meals-only member has no sessions fields", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        mark({ member_id: "mom", day_index: 0 }),
        mark({ member_id: "mom", day_index: 1 }),
      ],
      planned: { mom: { meals: 5 }, m1: { meals: 5 }, m2: { meals: 5 } },
    });
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.mealsMarked).toBe(2);
    expect(mom.mealsPlanned).toBe(5);
    expect(mom.sessionsMarked).toBeUndefined();
    expect(mom.sessionsPlanned).toBeUndefined();
  });

  it("exposes the breakdown counts — 50/50 member carries both pillars", () => {
    const stats = computeSeasonStats({
      members,
      checkins: Array.from({ length: 7 }, (_, day) =>
        mark({ member_id: "mom", day_index: day }),
      ),
      workoutCheckins: [
        workout({ local_date: "2026-07-18" }),
        workout({ local_date: "2026-07-19" }),
      ],
      weekStartDate: WEEK_START,
      planned: {
        mom: { meals: 14, sessions: 3 },
        m1: { meals: 14 },
        m2: { meals: 14 },
      },
    });
    const mom = stats.ranked.find((m) => m.id === "mom")!;
    expect(mom.mealsMarked).toBe(7);
    expect(mom.mealsPlanned).toBe(14);
    expect(mom.sessionsMarked).toBe(2);
    expect(mom.sessionsPlanned).toBe(3);
  });
});

describe("workoutMarkingWindow", () => {
  it("spans today back to the week's Sunday mid-week", () => {
    // 2026-07-22 is a Wednesday (weekday 3 > grace 2).
    expect(workoutMarkingWindow("2026-07-22")).toEqual({
      start: "2026-07-19",
      end: "2026-07-22",
    });
  });

  it("keeps the 48h grace floor on a Sunday (previous week's tail)", () => {
    // 2026-07-19 is a Sunday (weekday 0 → floor 2 days back).
    expect(workoutMarkingWindow("2026-07-19")).toEqual({
      start: "2026-07-17",
      end: "2026-07-19",
    });
  });

  it("covers the whole week on a Saturday", () => {
    // 2026-07-25 is a Saturday (weekday 6).
    expect(workoutMarkingWindow("2026-07-25")).toEqual({
      start: "2026-07-19",
      end: "2026-07-25",
    });
  });
});

describe("computeSeasonStats — workouts", () => {
  it("counts done and moved sessions inside the plan week", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
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
      workoutCheckins: rows,
      weekStartDate: WEEK_START,
    });
    expect(scoped.workoutActs).toBe(0);
    const unscoped = computeSeasonStats({
      members,
      checkins: [],
      workoutCheckins: rows,
    });
    expect(unscoped.workoutActs).toBe(1);
  });

  it("a skipped session never counts anywhere", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [],
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
      workoutCheckins: [
        workout({ member_id: "mom", day_index: 1, local_date: "2026-07-18" }),
      ],
      weekStartDate: WEEK_START, // [07-17 … 07-23]
    });
    expect(stats.workoutActs).toBe(1);
  });
});

describe("computeSeasonStats — ranking determinism", () => {
  it("a full tie keeps roster order (mom first) — deterministic across renders", () => {
    const checkins = [
      mark({ member_id: "mom" }),
      mark({ member_id: "m1" }),
      mark({ member_id: "m2" }),
    ];
    const planned = { mom: { meals: 10 }, m1: { meals: 10 }, m2: { meals: 10 } };
    const a = computeSeasonStats({ members, checkins, planned });
    const b = computeSeasonStats({ members, checkins, planned });
    expect(a.ranked.map((m) => m.id)).toEqual(["mom", "m1", "m2"]);
    expect(b.ranked.map((m) => m.id)).toEqual(a.ranked.map((m) => m.id));
    expect(a.leaderName).toBe("نورة");
  });

  it("breaks a score tie by distinct meal days (spread beats a one-day burst)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [
        // m1: 2 marks on one day; m2: 2 marks across two days → m2 ranks higher.
        mark({ member_id: "m1", day_index: 0, slot: "lunch" }),
        mark({ member_id: "m1", day_index: 0, slot: "dinner" }),
        mark({ member_id: "m2", day_index: 0, slot: "lunch" }),
        mark({ member_id: "m2", day_index: 1, slot: "lunch" }),
      ],
      planned: { mom: { meals: 10 }, m1: { meals: 10 }, m2: { meals: 10 } },
    });
    expect(stats.ranked.map((m) => m.id)).toEqual(["m2", "m1", "mom"]);
    expect(stats.leaderName).toBe("لينا");
  });

  it("keeps rosterIndex stable regardless of rank (avatar colours never shuffle)", () => {
    const stats = computeSeasonStats({
      members,
      checkins: [mark({ member_id: "m2" })],
    });
    expect(stats.ranked[0]!.id).toBe("m2");
    expect(stats.ranked[0]!.rosterIndex).toBe(2);
  });
});

describe("collapseMealMarks — calendar fan-in across plan re-mints", () => {
  it("dedupes rows for the same (date, slot, member) keeping the LAST write", () => {
    // Two same-week plan versions each hold a row for the same meal; the later
    // «تجاوزتها» correction (on the re-minted plan) must win.
    const collapsed = collapseMealMarks(
      [
        rawRow({ status: "cooked" }),
        rawRow({ status: "skipped" }),
      ],
      WEEK_START,
    );
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.status).toBe("skipped");
  });

  it("derives day_index from local_date against the week anchor", () => {
    const collapsed = collapseMealMarks(
      [rawRow({ local_date: "2026-07-20", day_index: 99 })],
      WEEK_START,
    );
    expect(collapsed[0]!.day_index).toBe(3);
  });

  it("drops rows dated outside the plan week", () => {
    const collapsed = collapseMealMarks(
      [rawRow({ local_date: "2026-07-30" })],
      WEEK_START,
    );
    expect(collapsed).toHaveLength(0);
  });

  it("falls back to the row's own day_index without a week anchor", () => {
    const collapsed = collapseMealMarks([rawRow({ day_index: 4 })], undefined);
    expect(collapsed[0]!.day_index).toBe(4);
  });

  it("keeps household and member rows for the same meal separate", () => {
    const collapsed = collapseMealMarks(
      [rawRow({ member_id: "household" }), rawRow({ member_id: "mom" })],
      WEEK_START,
    );
    expect(collapsed).toHaveLength(2);
  });

  it("carries reason through (the /plan surface displays it)", () => {
    const collapsed = collapseMealMarks(
      [rawRow({ status: "skipped", reason: "guests" })],
      WEEK_START,
    );
    expect(collapsed[0]!.reason).toBe("guests");
    const noReason = collapseMealMarks([rawRow()], WEEK_START);
    expect(noReason[0]!.reason).toBeNull();
  });

  it("last write wins for reason too — a correction replaces the old reason", () => {
    const collapsed = collapseMealMarks(
      [
        rawRow({ status: "cooked", reason: null }),
        rawRow({ status: "skipped", reason: "travel" }),
      ],
      WEEK_START,
    );
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.status).toBe("skipped");
    expect(collapsed[0]!.reason).toBe("travel");
  });

  it("end-to-end: marks survive a same-week plan re-mint", () => {
    // Rows from plan v1 (before regen) and v2 (after) — same calendar meal.
    const collapsed = collapseMealMarks(
      [
        rawRow({ member_id: "mom", local_date: "2026-07-17" }),
        rawRow({ member_id: "m1", local_date: "2026-07-18", day_index: 1 }),
        // v2 re-mark of mom's same meal (upsert on the new plan id):
        rawRow({ member_id: "mom", local_date: "2026-07-17" }),
      ],
      WEEK_START,
    );
    const stats = computeSeasonStats({
      members,
      checkins: collapsed,
      planned: { mom: { meals: 7 }, m1: { meals: 7 }, m2: { meals: 7 } },
    });
    expect(stats.followedMeals).toBe(2);
    const byId = Object.fromEntries(stats.ranked.map((m) => [m.id, m.score]));
    expect(byId.mom).toBe(1);
    expect(byId.m1).toBe(1);
  });
});

describe("collapseWorkoutMarks", () => {
  it("dedupes per (member, date) keeping the last write", () => {
    const collapsed = collapseWorkoutMarks([
      { local_date: "2026-07-18", day_index: 1, member_id: "mom", status: "done" },
      { local_date: "2026-07-18", day_index: 1, member_id: "mom", status: "skipped" },
      { local_date: "2026-07-18", day_index: 1, member_id: "m1", status: "done" },
    ]);
    expect(collapsed).toHaveLength(2);
    expect(
      collapsed.find((w) => w.member_id === "mom")!.status,
    ).toBe("skipped");
  });
});

describe("dayHasCookedMark", () => {
  it("is false for a skipped- or swapped-only day, true for a household cooked mark", () => {
    const checkins = [
      mark({ day_index: 0, status: "skipped" }),
      mark({ day_index: 1, member_id: "household" }),
      mark({ day_index: 3, status: "swapped" }),
    ];
    expect(dayHasCookedMark(checkins, 0)).toBe(false);
    expect(dayHasCookedMark(checkins, 1)).toBe(true);
    expect(dayHasCookedMark(checkins, 2)).toBe(false);
    expect(dayHasCookedMark(checkins, 3)).toBe(false);
  });
});
