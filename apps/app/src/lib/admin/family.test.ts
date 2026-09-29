import { beforeEach, describe, expect, it, vi } from "vitest";

import { probeFromPlanData } from "./mealProjection";

/**
 * family.ts is server-only and reads through the service-role client, so this
 * suite swaps `adminDb()` for an in-memory fake. It pins the WIRING — which
 * rows each section reads, the served-plan fallback on real blobs, the audit-
 * free projections — and that the side panel issues every read exactly once.
 * SQL itself (the JSON-path probes) is out of scope here.
 */

const UID = "11111111-1111-4111-8111-111111111111";
const DAD = "22222222-2222-4222-8222-222222222222";
const KID = "33333333-3333-4333-8333-333333333333";
const COOK = "44444444-4444-4444-8444-444444444444";

const now = Date.now();
const minAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const daysAgo = (d: number) => minAgo(d * 24 * 60);

// ── plan fixtures ───────────────────────────────────────────────────────────

const meal = (
  slot: string,
  name: string,
  calories: number,
  extra: Record<string, unknown> = {},
) => ({
  slot,
  slot_name_ar: "وجبة",
  recipe_name_ar: name,
  ingredients: [],
  prep_steps_ar: [],
  calories,
  macros: { protein_g: 30, carbs_g: 40, fat_g: 10 },
  ...extra,
});
const day = (i: number, meals: unknown[]) => ({
  day_index: i,
  day_name_ar: "السبت",
  meals,
  day_total: { calories: 1500, protein_g: 90, carbs_g: 150, fat_g: 50 },
});
const shared = meal("lunch", "كبسة دجاج", 650, {
  shared_recipe: true,
  per_member_portions: [{ member_id: "mom" }, { member_id: DAD }],
});
const weekFor = (id: string, extra: Record<string, unknown> = {}) => ({
  member_id: id,
  member_name_ar: `قديم ${id}`,
  primary_goal: "fat_loss",
  daily_calories_target: 1700,
  macros_target: { protein_g: 120, carbs_g: 170, fat_g: 55 },
  days: [0, 1, 2, 3, 4, 5, 6].map((i) => day(i, [meal("breakfast", `فطور ${i}`, 400), shared])),
  ...extra,
});
const READY_PLAN = {
  week_start_date: "2026-09-27",
  days_total: 7,
  members: [
    weekFor("mom"),
    weekFor(DAD, { primary_goal: "muscle_gain", daily_calories_target: 2600 }),
    weekFor(KID, { is_child: true, primary_goal: null, daily_calories_target: 1200 }),
  ],
};

const PROGRAM = {
  week_start_date: "2026-09-27",
  members: [
    {
      member_id: "mom",
      member_name_ar: "هند",
      split_name_ar: "جسم كامل ×٣",
      weekly_sessions: [0, 2, 4].map((d) => ({
        day_index: d,
        session_name_ar: `جلسة ${d}`,
        warmup_ar: ["مشي"],
        exercises: [
          { name_ar: "سكوات", target_muscles_ar: "الأرجل", sets: 3, reps: "10", rest_seconds: 90 },
        ],
        cooldown_ar: [],
        duration_min: 40,
      })),
      progression_notes_ar: "زيدي تدريجياً",
    },
  ],
};

// ── the fake database ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let failTables: Set<string>;
let calls: string[];

function seed() {
  const mealRows = [
    // newest: a regeneration that failed with nothing to show
    {
      id: "m-new",
      user_id: UID,
      status: "failed",
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
      plan_data: {},
    },
    // the week the household is actually cooking from
    {
      id: "m-old",
      user_id: UID,
      status: "ready",
      created_at: daysAgo(6),
      updated_at: daysAgo(6),
      plan_data: READY_PLAN,
    },
    {
      id: "m-arch",
      user_id: UID,
      status: "archived",
      created_at: daysAgo(20),
      updated_at: daysAgo(20),
      plan_data: READY_PLAN,
    },
  ].map((r) => ({
    ...r,
    generated_at: r.status === "failed" ? null : r.created_at,
    error_message: r.status === "failed" ? "timeout" : null,
    ai_input_tokens: 1000,
    ai_output_tokens: 2000,
    ai_model: "claude-sonnet-4-6",
    ...probeFromPlanData(r.plan_data),
  }));
  tables = {
    profiles: [
      {
        id: UID,
        display_name: "هند",
        preferred_language: "ar",
        created_at: daysAgo(90),
        onboarding_completed_at: daysAgo(89),
        family_wide_completed_at: daysAgo(89),
        mom_profile_completed_at: daysAgo(89),
        primary_goal: "fat_loss",
        has_medical_conditions: false,
        is_pregnant: false,
        consulted_doctor: false,
        medical_conditions: [],
        birth_year: 1992,
        sex: "female",
        workout_profile: {
          location: "home",
          equipment: ["dumbbells"],
          injuries: [],
          desired_days: 3,
          focus_areas: ["full_body"],
          experience: "beginner",
          session_minutes: "m30_45",
        },
      },
    ],
    subscriptions: [
      {
        user_id: UID,
        tier: "pro",
        status: "active",
        cadence: "monthly",
        created_at: daysAgo(80),
        updated_at: daysAgo(2),
        trial_started_at: daysAgo(80),
        trial_ends_at: daysAgo(73),
        current_period_end: daysAgo(-10),
        cancel_at_period_end: false,
        cancelled_at: null,
        lemonsqueezy_subscription_id: "123",
        lemonsqueezy_customer_id: "456",
        lemonsqueezy_variant_id: "789",
      },
    ],
    family_members: [
      {
        id: DAD,
        user_id: UID,
        name: "فيصل",
        role: "dad",
        member_type: "adult",
        birth_year: 1989,
        sex: "male",
        primary_goal: "muscle_gain",
        picky_eater: false,
        high_risk_pregnancy: null,
        consulted_doctor: null,
        medical_conditions: ["kidney_disease"],
        workout_profile: null,
        display_order: 1,
      },
      {
        id: KID,
        user_id: UID,
        name: "لمى",
        role: "daughter",
        member_type: "child",
        birth_year: 2016,
        sex: "female",
        primary_goal: null,
        picky_eater: true,
        high_risk_pregnancy: null,
        consulted_doctor: null,
        medical_conditions: [],
        workout_profile: null,
        display_order: 2,
      },
      {
        id: COOK,
        user_id: UID,
        name: "ماريا",
        role: "housekeeper",
        member_type: "housekeeper",
        birth_year: 1995,
        sex: null,
        primary_goal: null,
        picky_eater: null,
        high_risk_pregnancy: null,
        consulted_doctor: null,
        medical_conditions: [],
        workout_profile: null,
        display_order: 3,
      },
    ],
    meal_plans: mealRows,
    workout_plans: [
      {
        id: "w-1",
        user_id: UID,
        status: "ready",
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
        generated_at: daysAgo(3),
        error_message: null,
        ai_model: "claude-sonnet-4-6",
        plan_data: PROGRAM,
      },
    ],
    plan_generations: [
      {
        id: "g-1",
        user_id: UID,
        status: "failed",
        plan_kind: "meal",
        model: "m",
        tokens_in: 10,
        tokens_out: 20,
        cost_usd: "0.46",
        duration_ms: 855000,
        created_at: daysAgo(1),
        started_at: daysAgo(1),
        completed_at: null,
        error_message: "timeout",
        meal_plan_id: "m-new",
        workout_plan_id: null,
      },
      {
        id: "g-2",
        user_id: UID,
        status: "completed",
        plan_kind: "workout",
        model: "m",
        tokens_in: 10,
        tokens_out: 20,
        cost_usd: 0.94,
        duration_ms: 190000,
        created_at: daysAgo(3),
        started_at: daysAgo(3),
        completed_at: daysAgo(3),
        error_message: null,
        meal_plan_id: null,
        workout_plan_id: "w-1",
      },
      {
        id: "g-3",
        user_id: UID,
        status: "completed",
        plan_kind: "meal",
        model: "m",
        tokens_in: 10,
        tokens_out: 20,
        cost_usd: 3.1,
        duration_ms: 700000,
        created_at: daysAgo(6),
        started_at: daysAgo(6),
        completed_at: daysAgo(6),
        error_message: null,
        meal_plan_id: "m-old",
        workout_plan_id: null,
      },
    ],
    chat_messages: [
      { user_id: UID, cost_usd: 0.25, created_at: minAgo(30) },
      { user_id: UID, cost_usd: "0.5", created_at: minAgo(90) },
    ],
    workout_checkins: [
      {
        user_id: UID,
        member_id: "mom",
        day_index: 0,
        status: "done",
        intensity: "right",
        local_date: "2026-09-27",
        created_at: minAgo(60),
      },
    ],
  };
}

function query(table: string) {
  const eq: Record<string, unknown> = {};
  let inIds: unknown[] | null = null;
  let range: [number, number] | null = null;
  let single = false;
  let columns = "";
  const run = () => {
    calls.push(inIds ? `${table}#blob` : table);
    if (failTables.has(table)) return { data: null, error: { message: `${table} is down` } };
    let rows = (tables[table] ?? []).filter((r) =>
      Object.entries(eq).every(([k, v]) => String(r[k]) === String(v)),
    );
    if (inIds) rows = rows.filter((r) => inIds!.includes(r.id));
    if (columns === "id, plan_data") rows = rows.map((r) => ({ id: r.id, plan_data: r.plan_data }));
    if (single) return { data: rows[0] ?? null, error: null };
    if (range) rows = rows.slice(range[0], range[1] + 1);
    return { data: rows, error: null };
  };
  const b: Record<string, unknown> = {
    select: (c: string) => ((columns = c), b),
    eq: (k: string, v: unknown) => ((eq[k] = v), b),
    neq: () => b,
    in: (_k: string, v: unknown[]) => ((inIds = v), b),
    gte: () => b,
    lte: () => b,
    order: () => b,
    limit: () => b,
    returns: () => b,
    range: (f: number, t: number) => ((range = [f, t]), b),
    maybeSingle: () => ((single = true), b),
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
      Promise.resolve().then(run).then(ok, bad),
  };
  return b;
}

const fakeDb = {
  from: (table: string) => query(table),
  auth: {
    admin: {
      getUserById: async (id: string) => {
        calls.push("auth");
        return id === UID
          ? { data: { user: { id, email: "hind@example.com", banned_until: null } }, error: null }
          : { data: { user: null }, error: { message: "User not found" } };
      },
    },
  },
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/admin/db", () => ({ adminDb: () => fakeDb }));

// Imported after the mocks.
const family = await import("./family");

beforeEach(() => {
  seed();
  failTables = new Set();
  calls = [];
});

describe("loadFamilyPanel", () => {
  it("serves the previous week when the newest run failed, and reads each table once", async () => {
    const panel = await family.loadFamilyPanel(UID);
    expect(panel).not.toBeNull();
    const { header, meal, workout, household } = panel!;

    // Every list read once; blobs only for the rows the served rule needs:
    // the failed newest row has none to read, the older ready one does.
    const count = (t: string) => calls.filter((c) => c === t).length;
    for (const t of [
      "profiles",
      "auth",
      "subscriptions",
      "family_members",
      "meal_plans",
      "workout_plans",
      "plan_generations",
      "chat_messages",
      "workout_checkins",
    ]) {
      expect(count(t), t).toBe(1);
    }
    expect(count("meal_plans#blob")).toBe(1);
    expect(count("workout_plans#blob")).toBe(1);

    // Header: same flags as the list, plus the medical gate (the dad's
    // unconfirmed high-risk condition) — as a boolean only.
    expect(header).toMatchObject({
      userId: UID,
      displayName: "هند",
      email: "hind@example.com",
      deactivated: false,
      beneficiaries: 3,
      hasHousekeeper: true,
      tierMaxPeople: 2,
      overLimit: true,
      flags: ["over_limit", "failed_meal_run"],
      medicalGateBlocked: true,
    });
    expect(header.reasons.map((r) => [r.flag, r.severity])).toEqual([
      ["over_limit", "high"],
      ["medical_gate", "high"],
      ["failed_meal_run", "medium"],
    ]);
    expect(header.subscription?.lemonsqueezyCustomerId).toBe("456");
    expect(header.engagement).toEqual({ chatCount: 2, lastChatAt: minAgo(30), chatCostUsd: 0.75 });
    expect(header.lifetimeAiCostUsd).toBeCloseTo(0.46 + 0.94 + 3.1 + 0.75, 6);

    // Meal: the masked failure, the week from the OLDER plan, every plan listed.
    expect(meal.served?.plan.id).toBe("m-old");
    expect(meal.served?.plan.status).toBe("ready");
    expect(meal.served?.masked).toBe(true);
    expect(meal.served?.maskedFailureAt).toBe(daysAgo(1));
    expect(meal.served?.week?.members.map((m) => m.name)).toEqual(["هند", "فيصل", "لمى"]);
    expect(meal.served?.week?.members[2]).toMatchObject({ isChild: true, caloriesTarget: null });
    expect(meal.served?.week?.members[0]!.days[0]!.meals[1]).toMatchObject({
      name: "كبسة دجاج",
      sharedBy: 2,
    });
    expect(meal.plans.map((p) => [p.id, p.status, p.daysReady, p.costUsd])).toEqual([
      ["m-new", "failed", 0, 0.46],
      ["m-old", "ready", 7, 3.1],
      ["m-arch", "archived", 7, null],
    ]);

    // Workout: the served program with this week's mark, the cook and the child left out.
    expect(workout.optedIn).toBe(true);
    expect(workout.served?.plan).toMatchObject({
      id: "w-1",
      traineeCount: 1,
      sessionsPerWeek: 3,
      costUsd: 0.94,
    });
    expect(workout.served?.trainees[0]).toMatchObject({
      name: "هند",
      role: "mom",
      doneThisWeek: 1,
    });
    expect(workout.served?.trainees[0]!.sessions[0]!.mark).toMatchObject({
      status: "done",
      intensity: "right",
    });
    expect(workout.latest?.status).toBe("ready");
    expect(workout.ineligible.map((m) => [m.memberId, m.reason])).toEqual([
      [KID, "child"],
      [COOK, "housekeeper"],
    ]);
    expect(workout.marksWindow).not.toBeNull();

    // Household: owner first, targets from the served plan, pregnancy-free types.
    expect(household.map((m) => [m.id, m.memberType, m.caloriesTarget, m.medicalGate])).toEqual([
      ["mom", "adult", 1700, false],
      [DAD, "adult", 2600, true],
      [KID, "child", 1200, false],
      [COOK, "housekeeper", null, false],
    ]);
    expect(household[0]!.age).toBeGreaterThan(30);

    // Nothing sensitive crosses the wire.
    const json = JSON.stringify(panel);
    expect(json).not.toContain("kidney_disease");
    expect(json).not.toContain("medical_conditions");
  });

  it("returns null for an unknown family and never reads for a malformed id", async () => {
    tables.profiles = [];
    expect(await family.loadFamilyPanel(UID)).toBeNull();
    calls = [];
    expect(await family.loadFamilyPanel("not-a-uuid")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("throws when the core profile read fails", async () => {
    failTables.add("profiles");
    await expect(family.loadFamilyPanel(UID)).rejects.toThrow(/profile/);
  });

  it("degrades optional reads instead of failing the panel", async () => {
    failTables.add("workout_plans");
    failTables.add("chat_messages");
    failTables.add("workout_checkins");
    const panel = await family.loadFamilyPanel(UID);
    expect(panel?.workout.served).toBeNull();
    expect(panel?.workout.plans).toEqual([]);
    expect(panel?.header.engagement.chatCount).toBe(0);
  });

  it("falls back to the probe decision when a plan blob cannot be read", async () => {
    // Only the blob read of meal_plans fails; the list read is fine.
    const original = fakeDb.from;
    fakeDb.from = (t: string) => {
      const q = original(t) as Record<string, unknown>;
      if (t !== "meal_plans") return q;
      const inFn = q.in as (k: string, v: unknown[]) => unknown;
      q.in = (k: string, v: unknown[]) => {
        failTables.add("meal_plans");
        return inFn(k, v);
      };
      return q;
    };
    try {
      const meal = await family.loadMealSection(UID);
      expect(meal.served?.plan.id).toBe("m-old");
      expect(meal.served?.masked).toBe(true);
      expect(meal.served?.week).toBeNull();
    } finally {
      fakeDb.from = original;
    }
  });

  /** Make every plan_data read of `table` fail; its list read still works. */
  const failBlobReadsOf = (table: string) => {
    const original = fakeDb.from;
    fakeDb.from = (t: string) => {
      const q = original(t) as Record<string, unknown>;
      if (t !== table) return q;
      const inFn = q.in as (k: string, v: unknown[]) => unknown;
      q.in = (k: string, v: unknown[]) => {
        failTables.add(table);
        return inFn(k, v);
      };
      return q;
    };
    return () => {
      fakeDb.from = original;
    };
  };

  it("still serves a ready program whose blob cannot be read, without figures", async () => {
    const restore = failBlobReadsOf("workout_plans");
    try {
      const workout = await family.loadWorkoutSection(UID);
      expect(workout.latest?.status).toBe("ready");
      expect(workout.served?.plan).toMatchObject({
        id: "w-1",
        status: "ready",
        traineeCount: null,
        sessionsPerWeek: null,
      });
      expect(workout.served?.masked).toBe(false);
      expect(workout.served?.trainees).toEqual([]);
      expect(workout.marksWindow).toBeNull();
    } finally {
      restore();
    }
  });

  it("keeps the masked fallback when only the older programs cannot be read", async () => {
    tables.workout_plans = [
      {
        ...tables.workout_plans![0]!,
        id: "w-new",
        status: "failed",
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
        generated_at: null,
        error_message: "timeout",
        plan_data: {},
      },
      ...tables.workout_plans!,
    ];
    const restore = failBlobReadsOf("workout_plans");
    try {
      const workout = await family.loadWorkoutSection(UID);
      expect(workout.latest).toMatchObject({ id: "w-new", status: "failed" });
      expect(workout.served?.plan).toMatchObject({ id: "w-1", status: "ready" });
      expect(workout.served?.masked).toBe(true);
      expect(workout.served?.trainees).toEqual([]);
    } finally {
      restore();
    }
  });

  it("flags and dates a killed workout run the audit row still calls started", async () => {
    tables.workout_plans = [
      {
        ...tables.workout_plans![0]!,
        id: "w-dead",
        status: "generating",
        created_at: minAgo(40),
        updated_at: minAgo(40),
        generated_at: null,
        plan_data: {},
      },
      ...tables.workout_plans!,
    ];
    tables.plan_generations = [
      {
        ...tables.plan_generations![1]!,
        id: "g-dead",
        status: "started",
        cost_usd: null,
        created_at: minAgo(40),
        started_at: minAgo(40),
        completed_at: null,
        workout_plan_id: "w-dead",
      },
      ...tables.plan_generations!,
    ];
    const header = await family.loadFamilyHeader(UID);
    expect(header?.flags).toEqual(["over_limit", "failed_workout_run", "failed_meal_run"]);
    expect(header?.reasons.find((r) => r.flag === "failed_workout_run")).toMatchObject({
      severity: "medium", // the previous program is still served
      at: minAgo(40),
      tab: "exercise",
    });
  });
});

describe("loadRuns / loadWorkoutForInspect", () => {
  it("lists meal and workout runs with their kind and numeric cost", async () => {
    const runs = await family.loadRuns(UID);
    expect(runs.map((r) => [r.id, r.kind, r.costUsd])).toEqual([
      ["g-1", "meal", 0.46],
      ["g-2", "workout", 0.94],
      ["g-3", "meal", 3.1],
    ]);
  });

  it("only opens a program that belongs to the family", async () => {
    // loadWorkoutForInspect reads by id; the fake needs UUID-shaped ids.
    const PID = "55555555-5555-4555-8555-555555555555";
    tables.workout_plans = [{ ...tables.workout_plans![0]!, id: PID }];
    expect((await family.loadWorkoutForInspect(UID, PID))?.planData).toEqual(PROGRAM);
    expect(await family.loadWorkoutForInspect(DAD, PID)).toBeNull();
    expect(await family.loadWorkoutForInspect(UID, "nope")).toBeNull();
  });
});
