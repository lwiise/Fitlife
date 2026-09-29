import { describe, expect, it } from "vitest";
import { planHasContent } from "@fitlife/plan-engine";

import {
  DEFAULT_DAYS_TOTAL,
  MEAL_PROBE_COLUMNS,
  daysReadyFromProbe,
  mealCellFromRows,
  mealStateOf,
  pickServedMealLite,
  pickServedMealPlan,
  planTargetsById,
  probeFromPlanData,
  projectMealWeek,
  resolveMealRow,
  resolveMealRowLite,
  workerAckedFromProbe,
  type MealPlanRowFull,
  type MealRowLite,
} from "./mealProjection";

const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

// ── fixtures (shapes follow packages/plan-engine/src/schema.ts) ─────────────

function meal(
  slot: string,
  name: string,
  calories: number,
  protein: number,
  extra: Record<string, unknown> = {},
) {
  return {
    slot,
    slot_name_ar: "وجبة",
    recipe_name_ar: name,
    ingredients: [],
    prep_steps_ar: [],
    calories,
    macros: { protein_g: protein, carbs_g: 20, fat_g: 10 },
    ...extra,
  };
}

function day(dayIndex: number, meals: ReturnType<typeof meal>[], total?: Record<string, number>) {
  return {
    day_index: dayIndex,
    day_name_ar: "السبت",
    meals,
    day_total: total ?? {
      calories: meals.reduce((s, m) => s + m.calories, 0),
      protein_g: meals.reduce((s, m) => s + m.macros.protein_g, 0),
      carbs_g: 0,
      fat_g: 0,
    },
  };
}

const shell = (dayIndex: number) =>
  day(dayIndex, [], { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

function member(id: string, days: unknown[], extra: Record<string, unknown> = {}) {
  return {
    member_id: id,
    member_name_ar: `اسم ${id}`,
    primary_goal: "fat_loss",
    daily_calories_target: 1800,
    macros_target: { protein_g: 130, carbs_g: 180, fat_g: 60 },
    days,
    ...extra,
  };
}

const fullDay = (i: number) =>
  day(i, [meal("breakfast", `فطور ${i}`, 400, 30), meal("lunch", `غداء ${i}`, 700, 50)]);

function plan(members: unknown[], extra: Record<string, unknown> = {}) {
  return { week_start_date: "2026-09-27", members, ...extra };
}

const weekPlan = (extra: Record<string, unknown> = {}) =>
  plan([member("mom", [0, 1, 2, 3, 4, 5, 6].map(fullDay))], { days_total: 7, ...extra });

// ── projection ──────────────────────────────────────────────────────────────

describe("projectMealWeek", () => {
  it("returns null when there is no plan object", () => {
    expect(projectMealWeek(null)).toBeNull();
    expect(projectMealWeek("nope")).toBeNull();
    expect(projectMealWeek([])).toBeNull();
  });

  it("handles empty plan_data and missing members", () => {
    const w = projectMealWeek({});
    expect(w).toEqual({
      weekStartDate: null,
      daysTotal: DEFAULT_DAYS_TOTAL,
      generating: false,
      members: [],
      completeDays: [],
    });
    expect(projectMealWeek({ members: "x", days_total: 4 })?.daysTotal).toBe(4);
  });

  it("projects meals, totals and targets for an adult", () => {
    const w = projectMealWeek(weekPlan())!;
    expect(w.weekStartDate).toBe("2026-09-27");
    expect(w.members).toHaveLength(1);
    const mom = w.members[0]!;
    expect(mom).toMatchObject({ memberId: "mom", name: "اسم mom", isChild: false });
    expect(mom.caloriesTarget).toBe(1800);
    expect(mom.proteinTargetG).toBe(130);
    expect(mom.days).toHaveLength(7);
    expect(mom.days[0]).toEqual({
      dayIndex: 0,
      meals: [
        { slot: "breakfast", name: "فطور 0", calories: 400, proteinG: 30, sharedBy: 1 },
        { slot: "lunch", name: "غداء 0", calories: 700, proteinG: 50, sharedBy: 1 },
      ],
      totalCalories: 1100,
      totalProteinG: 80,
    });
    expect(w.completeDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("gives a child no calorie/protein target (planned by portions)", () => {
    const w = projectMealWeek(
      plan([member("kid", [fullDay(0)], { is_child: true, primary_goal: null })]),
    )!;
    expect(w.members[0]).toMatchObject({
      isChild: true,
      caloriesTarget: null,
      proteinTargetG: null,
    });
    // Day totals still show what was served.
    expect(w.members[0]!.days[0]!.totalCalories).toBe(1100);
  });

  it("counts the sharers of a shared recipe, else 1", () => {
    const shared = meal("lunch", "كبسة", 650, 40, {
      shared_recipe: true,
      per_member_portions: [
        { member_id: "mom", portion_percentage: 40 },
        { member_id: "dad", portion_percentage: 40 },
        { member_id: "kid", portion_percentage: 20 },
      ],
    });
    const lonePortion = meal("dinner", "شوربة", 300, 20, {
      shared_recipe: true,
      per_member_portions: [{ member_id: "mom" }],
    });
    const notShared = meal("snack", "تمر", 100, 2, {
      per_member_portions: [{ member_id: "mom" }, { member_id: "dad" }],
    });
    const w = projectMealWeek(plan([member("mom", [day(0, [shared, lonePortion, notShared])])]))!;
    expect(w.members[0]!.days[0]!.meals.map((m) => m.sharedBy)).toEqual([3, 1, 1]);
  });

  it("drops empty day shells and reports only days every member has", () => {
    const w = projectMealWeek(
      plan([
        member("mom", [fullDay(0), fullDay(1), fullDay(2)]),
        member("dad", [fullDay(0), shell(1), fullDay(2)]),
      ]),
    )!;
    expect(w.members[1]!.days.map((d) => d.dayIndex)).toEqual([0, 2]);
    expect(w.completeDays).toEqual([0, 2]);
  });

  it("falls back to summing meals when day_total is missing or zero, and skips junk", () => {
    const junkDay = {
      day_index: 3,
      meals: [
        meal("lunch", "سمك", 500, 45),
        null,
        { slot: "dinner" }, // no name → skipped
        meal("dinner", "  ", 200, 5), // blank name → skipped
        { ...meal("snack", "لبن", 150, 8), calories: "150" }, // numeric string
      ],
      day_total: { calories: 0 },
    };
    const w = projectMealWeek(
      plan([member("mom", [junkDay, { day_index: 9, meals: [meal("lunch", "x", 1, 1)] }, "bad"])]),
    )!;
    const d = w.members[0]!.days;
    expect(d).toHaveLength(1);
    expect(d[0]!.meals.map((m) => m.name)).toEqual(["سمك", "لبن"]);
    expect(d[0]!.totalCalories).toBe(650);
    expect(d[0]!.totalProteinG).toBe(53);
  });

  it("uses current roster names and the resolved generating state", () => {
    const w = projectMealWeek(weekPlan({ generating: true }), {
      nameById: new Map([["mom", "هند"]]),
      generating: false,
    })!;
    expect(w.members[0]!.name).toBe("هند");
    expect(w.generating).toBe(false);
    expect(projectMealWeek(weekPlan({ generating: true }))!.generating).toBe(true);
  });
});

describe("planTargetsById", () => {
  it("reads goal, calories and complete macros per member", () => {
    const t = planTargetsById(
      plan([
        member("mom", []),
        member("kid", [], { primary_goal: null, macros_target: { protein_g: 40 } }),
      ]),
    );
    expect(t.get("mom")).toEqual({
      primaryGoal: "fat_loss",
      caloriesTarget: 1800,
      macros: { protein_g: 130, carbs_g: 180, fat_g: 60 },
    });
    expect(t.get("kid")).toEqual({ primaryGoal: null, caloriesTarget: 1800, macros: null });
    expect(planTargetsById(null).size).toBe(0);
  });
});

// ── probes ──────────────────────────────────────────────────────────────────

describe("probes", () => {
  it("probes the first member's days by their first meal, not by day_index", () => {
    expect(MEAL_PROBE_COLUMNS).toContain("d0:plan_data->members->0->days->0->meals->0->slot");
    expect(MEAL_PROBE_COLUMNS).toContain("d6:plan_data->members->0->days->6->meals->0->slot");
    const p = probeFromPlanData(
      plan([
        member("mom", [fullDay(0), fullDay(1), fullDay(2), shell(3), shell(4), shell(5), shell(6)]),
      ]),
    );
    expect(daysReadyFromProbe(p)).toBe(3);
  });

  it("tells a never-written row from one the worker touched", () => {
    expect(workerAckedFromProbe(probeFromPlanData({}))).toBe(false);
    expect(workerAckedFromProbe({})).toBe(false);
    expect(workerAckedFromProbe(probeFromPlanData({ worker_ack_at: minAgo(1) }))).toBe(true);
    expect(workerAckedFromProbe(probeFromPlanData(weekPlan()))).toBe(true);
  });
});

// ── the served rule: probe path == full path ────────────────────────────────

const fullRow = (
  id: string,
  status: string,
  planData: unknown,
  updatedMinAgo: number,
): MealPlanRowFull => ({
  id,
  status,
  plan_data: planData,
  generated_at: null,
  error_message: null,
  updated_at: minAgo(updatedMinAgo),
});

const liteOf = (r: MealPlanRowFull): MealRowLite => ({
  id: r.id,
  status: r.status,
  created_at: r.updated_at,
  updated_at: r.updated_at,
  probe: probeFromPlanData(r.plan_data),
});

function fullState(r: MealPlanRowFull) {
  const res = resolveMealRow(r, NOW)!;
  return mealStateOf({
    status: res.status,
    inProgress: res.inProgress,
    hasContent: !!res.planData && planHasContent(res.planData),
  });
}

const emptyShells = () =>
  plan([member("mom", [0, 1, 2, 3, 4, 5, 6].map(shell))], { generating: true });

describe("resolveMealRowLite agrees with getLatestPlan's resolveStaleness path", () => {
  const cases: Array<[string, MealPlanRowFull, "ready" | "generating" | "failed"]> = [
    ["ready week, fresh", fullRow("a", "ready", weekPlan(), 2), "ready"],
    ["ready week, weeks old", fullRow("a", "ready", weekPlan(), 60 * 24 * 10), "ready"],
    [
      "ready, still filling days, fresh",
      fullRow("a", "ready", weekPlan({ generating: true }), 3),
      "generating",
    ],
    [
      "ready, still flagged generating but silent",
      fullRow("a", "ready", weekPlan({ generating: true }), 40),
      "ready",
    ],
    ["ready shell, no meals yet, fresh", fullRow("a", "ready", emptyShells(), 2), "generating"],
    ["ready shell, no meals, silent", fullRow("a", "ready", emptyShells(), 40), "failed"],
    ["generating, nothing written, 30s", fullRow("a", "generating", {}, 0.5), "generating"],
    ["generating, never ACKed, 5 min", fullRow("a", "generating", {}, 5), "failed"],
    [
      "generating, ACKed, 5 min",
      fullRow("a", "generating", { worker_ack_at: minAgo(5) }, 5),
      "generating",
    ],
    [
      "generating, ACKed, silent 20 min",
      fullRow("a", "generating", { worker_ack_at: minAgo(20) }, 20),
      "failed",
    ],
    ["failed", fullRow("a", "failed", weekPlan(), 1), "failed"],
  ];

  it.each(cases)("%s", (_label, row, expected) => {
    expect(fullState(row)).toBe(expected);
    expect(mealStateOf(resolveMealRowLite(liteOf(row), NOW))).toBe(expected);
  });
});

function servedBoth(rows: MealPlanRowFull[]) {
  const newest = resolveMealRow(rows[0]!, NOW)!;
  const full = pickServedMealPlan(newest, rows.slice(1), NOW);
  const lite = pickServedMealLite(rows.map(liteOf), NOW);
  return { full, lite };
}

describe("the masked-failure fallback (probe path == full path)", () => {
  it("serves the previous ready plan when the newest run failed with nothing", () => {
    const { full, lite } = servedBoth([
      fullRow("new", "failed", {}, 5),
      fullRow("old", "ready", weekPlan(), 60 * 24 * 7),
    ]);
    expect(full.served.id).toBe("old");
    expect(full.masked).toBe(true);
    expect(full.maskedFailure?.id).toBe("new");
    expect(lite.served?.id).toBe("old");
    expect(lite.masked).toBe(true);
    expect(lite.maskedFailure?.id).toBe("new");
  });

  it("looks past stacked failures and empty ready shells, within five rows", () => {
    const { full, lite } = servedBoth([
      fullRow("f1", "failed", {}, 5),
      fullRow("f2", "failed", {}, 60),
      fullRow("empty", "ready", emptyShells(), 90),
      fullRow("good", "ready", weekPlan(), 60 * 24),
    ]);
    expect(full.served.id).toBe("good");
    expect(lite.served?.id).toBe("good");
  });

  it("does not reach a ready plan beyond the five-row window", () => {
    const rows = [
      fullRow("f1", "failed", {}, 1),
      fullRow("f2", "failed", {}, 2),
      fullRow("f3", "failed", {}, 3),
      fullRow("f4", "failed", {}, 4),
      fullRow("f5", "failed", {}, 5),
      fullRow("good", "ready", weekPlan(), 6),
    ];
    const { full, lite } = servedBoth(rows);
    expect(full.served.id).toBe("f1");
    expect(full.masked).toBe(false);
    expect(lite.served?.id).toBe("f1");
    expect(lite.masked).toBe(false);
  });

  it("keeps a live run on screen rather than falling back", () => {
    const { full, lite } = servedBoth([
      fullRow("live", "generating", { worker_ack_at: minAgo(1) }, 1),
      fullRow("old", "ready", weekPlan(), 60 * 24),
    ]);
    expect(full.served.id).toBe("live");
    expect(lite.served?.id).toBe("live");
    expect(lite.masked).toBe(false);
  });

  it("treats a dead run like a failure", () => {
    const { full, lite } = servedBoth([
      fullRow("dead", "generating", { worker_ack_at: minAgo(30) }, 30),
      fullRow("old", "ready", weekPlan(), 60 * 24),
    ]);
    expect(full.served.id).toBe("old");
    expect(lite.served?.id).toBe("old");
  });

  it("skips archived rows on the probe path", () => {
    const lite = pickServedMealLite(
      [
        liteOf(fullRow("arch", "archived", weekPlan(), 1)),
        liteOf(fullRow("cur", "ready", weekPlan(), 2)),
      ],
      NOW,
    );
    expect(lite.served?.id).toBe("cur");
  });
});

describe("mealCellFromRows", () => {
  it("is none without rows", () => {
    expect(mealCellFromRows([], NOW)).toEqual({
      state: "none",
      daysReady: null,
      daysTotal: 7,
      masked: false,
    });
  });

  it("reports days ready and the target from the probes", () => {
    const row = liteOf(
      fullRow(
        "p",
        "ready",
        plan([member("mom", [fullDay(0), fullDay(1), fullDay(2), shell(3)])], {
          days_total: 7,
          generating: true,
        }),
        2,
      ),
    );
    expect(mealCellFromRows([row], NOW)).toEqual({
      state: "generating",
      daysReady: 3,
      daysTotal: 7,
      masked: false,
    });
  });

  it("marks the masked failure", () => {
    const cell = mealCellFromRows(
      [liteOf(fullRow("new", "failed", {}, 5)), liteOf(fullRow("old", "ready", weekPlan(), 99))],
      NOW,
    );
    expect(cell).toEqual({ state: "ready", daysReady: 7, daysTotal: 7, masked: true });
  });

  it("outside the probe window: daysReady is unknown, a ready plan is ready", () => {
    const old: MealRowLite = {
      id: "old",
      status: "ready",
      created_at: minAgo(60 * 24 * 40),
      updated_at: null,
      probe: null,
    };
    expect(mealCellFromRows([old], NOW)).toEqual({
      state: "ready",
      daysReady: null,
      daysTotal: 7,
      masked: false,
    });
  });

  it("without a probe, a generating row is judged by its age", () => {
    const row = (createdMinAgo: number): MealRowLite => ({
      id: "g",
      status: "generating",
      created_at: minAgo(createdMinAgo),
      updated_at: null,
      probe: null,
    });
    // Just inserted between the list's two reads: still starting.
    expect(mealCellFromRows([row(1)], NOW).state).toBe("generating");
    // Created weeks ago and never finished.
    expect(mealCellFromRows([row(60 * 24 * 30)], NOW).state).toBe("failed");
  });
});
