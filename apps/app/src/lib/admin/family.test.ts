import { beforeEach, describe, expect, it, vi } from "vitest";

import { addDaysISO, riyadhTodayISO } from "@/lib/plans/dayMapping";
import { probeFromPlanData } from "./mealProjection";
import { currentTrainingWeek } from "./workoutProjection";

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
/** This training week's Sunday in Riyadh — the loader reads marks from here. */
const SUNDAY = currentTrainingWeek(riyadhTodayISO()).start;

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
/** Every read of these tables fails. */
let failTables: Set<string>;
/** Only the plan_data reads of these tables fail (their list and probe reads work). */
let failBlobs: Set<string>;
/** From this many meal_plans plan_data reads on (1-based), each one fails. */
let failMealBlobsFrom: number | null;
/** Only the probe reads of these tables fail. */
let failProbes: Set<string>;
/**
 * Every read, by kind: `table` (a list or single read), `table#blob` (a
 * plan_data read), `table#probe` (the JSON-path probes), `table#count` (a
 * head count).
 */
let calls: string[];
/** Every plan_data read, with the ids it asked for, in order. */
let blobCalls: Array<{ table: string; ids: unknown[] }>;
const blobReads = (table: string) =>
  blobCalls.filter((c) => c.table === table).map((c) => c.ids);
/** Every probe read, with the ids it asked for, in order. */
let probeCalls: Array<{ table: string; ids: unknown[] }>;
const probeReads = (table: string) =>
  probeCalls.filter((c) => c.table === table).map((c) => c.ids);
/** A probe read returns what the JSON paths would: these columns only. */
const PROBE_KEYS = [
  "id",
  "status",
  "updated_at",
  "days_total",
  "generating",
  "ack",
  "ws",
  "m0",
  "d0",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
];

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
          // Health detail: must never reach the panel (see the last assertion).
          injuries: ["knee"],
          injury_notes: "ألم في الركبة اليسرى",
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
        local_date: SUNDAY,
        created_at: minAgo(60),
      },
    ],
  };
}

function query(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  const orders: Array<[string, boolean]> = [];
  let inIds: unknown[] | null = null;
  let range: [number, number] | null = null;
  let limit: number | null = null;
  let single = false;
  let head = false;
  let columns = "";
  const cmp = (a: unknown, b: unknown) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
  const run = () => {
    const kind = head ? "count" : !inIds ? "list" : columns === "id, plan_data" ? "blob" : "probe";
    calls.push(kind === "list" ? table : `${table}#${kind}`);
    let fails = failTables.has(table);
    if (kind === "blob") {
      blobCalls.push({ table, ids: [...inIds!] });
      fails ||= failBlobs.has(table);
      if (table === "meal_plans" && failMealBlobsFrom !== null) {
        fails ||= blobReads("meal_plans").length >= failMealBlobsFrom;
      }
    }
    if (kind === "probe") {
      probeCalls.push({ table, ids: [...inIds!] });
      fails ||= failProbes.has(table);
    }
    if (fails) return { data: null, error: { message: `${table} is down` }, count: null };
    let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    if (inIds) rows = rows.filter((r) => inIds!.includes(r.id));
    if (orders.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const [key, asc] of orders) {
          const d = cmp(a[key], b[key]);
          if (d) return asc ? d : -d;
        }
        return 0;
      });
    }
    if (head) return { data: null, error: null, count: rows.length };
    if (kind === "blob") rows = rows.map((r) => ({ id: r.id, plan_data: r.plan_data }));
    if (kind === "probe") {
      rows = rows.map((r) => Object.fromEntries(PROBE_KEYS.map((k) => [k, r[k] ?? null])));
    }
    if (single) return { data: rows[0] ?? null, error: null };
    if (range) rows = rows.slice(range[0], range[1] + 1);
    if (limit !== null) rows = rows.slice(0, limit);
    return { data: rows, error: null };
  };
  const b: Record<string, unknown> = {
    select: (c: string, opts?: { head?: boolean }) => ((columns = c), (head = !!opts?.head), b),
    eq: (k: string, v: unknown) => (filters.push((r) => String(r[k]) === String(v)), b),
    neq: (k: string, v: unknown) => (filters.push((r) => String(r[k]) !== String(v)), b),
    gte: (k: string, v: unknown) => (filters.push((r) => cmp(r[k], v) >= 0), b),
    lte: (k: string, v: unknown) => (filters.push((r) => cmp(r[k], v) <= 0), b),
    in: (_k: string, v: unknown[]) => ((inIds = v), b),
    order: (k: string, o?: { ascending?: boolean }) => (orders.push([k, o?.ascending !== false]), b),
    limit: (n: number) => ((limit = n), b),
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
  failBlobs = new Set();
  failMealBlobsFrom = null;
  failProbes = new Set();
  calls = [];
  blobCalls = [];
  probeCalls = [];
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
      "workout_checkins",
    ]) {
      expect(count(t), t).toBe(1);
    }
    expect(count("meal_plans#blob")).toBe(1);
    expect(count("workout_plans#blob")).toBe(1);
    // Probes: the serve window for the decision, then the rest of the
    // history's newest rows for their day counts — never one read per row.
    expect(probeReads("meal_plans")).toEqual([["m-new", "m-old"], ["m-arch"]]);
    // The chat figures: a count, the newest message and one page of costs.
    expect(count("chat_messages#count")).toBe(1);
    expect(count("chat_messages")).toBe(2);

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
      cancelState: "none",
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
    expect(workout.marksWindow).toEqual({ start: SUNDAY, end: riyadhTodayISO() });

    // Household: owner first, targets from the served plan, pregnancy-free
    // types. A child's figure is /plan's: the average of her real days (1500),
    // not the header's 1200 estimate.
    expect(household.map((m) => [m.id, m.memberType, m.caloriesTarget, m.medicalGate])).toEqual([
      ["mom", "adult", 1700, false],
      [DAD, "adult", 2600, true],
      [KID, "child", 1500, false],
      [COOK, "housekeeper", null, false],
    ]);
    expect(household[0]!.age).toBeGreaterThan(30);

    // Nothing sensitive crosses the wire — conditions, nor the workout
    // questionnaire's injury areas and notes (the trainee's profile still does).
    const json = JSON.stringify(panel);
    expect(json).not.toContain("kidney_disease");
    expect(json).not.toContain("medical_conditions");
    expect(json).not.toContain("knee");
    expect(json).not.toContain("الركبة");
    expect(workout.served?.trainees[0]?.profile).toMatchObject({ location: "home", injuries: [] });
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
    // Only the blob reads of meal_plans fail; the list and probe reads are fine.
    failBlobs.add("meal_plans");
    const meal = await family.loadMealSection(UID);
    expect(meal.served?.plan.id).toBe("m-old");
    expect(meal.served?.masked).toBe(true);
    expect(meal.served?.week).toBeNull();
  });

  /** Make every plan_data read of `table` fail; its list read still works. */
  const failBlobReadsOf = (table: string) => {
    failBlobs.add(table);
    return () => {
      failBlobs.delete(table);
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

  it("keeps a portal cancellation scheduled until the day it is paid through", async () => {
    // LemonSqueezy's portal: status 'cancelled', no new period end, ends_at set.
    const portal = {
      ...tables.subscriptions![0]!,
      status: "cancelled",
      cancel_at_period_end: true,
      current_period_end: null,
      ends_at: daysAgo(-12),
      cancelled_at: daysAgo(1),
    };
    tables.subscriptions = [portal];
    const header = await family.loadFamilyHeader(UID);
    expect(header?.subscription?.endsAt).toBe(daysAgo(-12));
    expect(header?.cancelState).toBe("scheduled");
    expect(header?.flags).toContain("cancel_scheduled");
    expect(header?.reasons.find((r) => r.flag === "cancel_scheduled")).toMatchObject({
      severity: "medium",
      at: daysAgo(-12),
      tab: "billing",
    });

    tables.subscriptions = [{ ...portal, ends_at: daysAgo(1) }];
    const lapsed = await family.loadFamilyHeader(UID);
    expect(lapsed?.cancelState).toBe("ended");
    expect(lapsed?.flags).not.toContain("cancel_scheduled");
  });
});

describe("after a failed newest run, older plans are read one at a time", () => {
  const mealRow = (id: string, status: string, ageDays: number, planData: unknown) => ({
    id,
    user_id: UID,
    status,
    created_at: daysAgo(ageDays),
    updated_at: daysAgo(ageDays),
    generated_at: status === "ready" ? daysAgo(ageDays) : null,
    error_message: status === "failed" ? "timeout" : null,
    ai_input_tokens: 1,
    ai_output_tokens: 1,
    ai_model: "claude-sonnet-4-6",
    plan_data: planData,
    ...probeFromPlanData(planData),
  });

  /** Every member of READY_PLAN with its days emptied — or only those `only` names. */
  const emptied = (only?: string) => ({
    ...READY_PLAN,
    generating: true,
    members: READY_PLAN.members.map((m) =>
      only === undefined || m.member_id === only
        ? { ...m, days: [0, 1, 2, 3, 4, 5, 6].map((i) => day(i, [])) }
        : m,
    ),
  });
  /** Meals in the probes (first member, day 0), but not a plan the schema accepts. */
  const BAD_PLAN = {
    week_start_date: "2026-09-27",
    members: [{ member_id: "mom", days: [{ day_index: 0, meals: [{ slot: "lunch" }] }] }],
  };

  /** Make the n-th plan_data read of meal_plans (1-based) fail; every read after it too. */
  const failMealBlobReadFrom = (n: number) => {
    failMealBlobsFrom = n;
    return () => {
      failMealBlobsFrom = null;
    };
  };

  it("meal: reads older plans newest first, one blob at a time, and stops at the first the app serves", async () => {
    tables.meal_plans = [
      mealRow("m-new", "failed", 1, {}),
      // No member and no week: the probes prove the schema rejects it — never read.
      mealRow("m-void", "ready", 2, { members: [] }),
      // Meals in the probes, but the blob fails the schema: read, passed over.
      mealRow("m-bad", "ready", 3, BAD_PLAN),
      mealRow("m-good", "ready", 4, READY_PLAN),
      mealRow("m-older", "ready", 5, READY_PLAN),
    ];
    const meal = await family.loadMealSection(UID);
    expect(meal.served?.plan.id).toBe("m-good");
    expect(meal.served?.masked).toBe(true);
    expect(meal.served?.maskedFailureAt).toBe(daysAgo(1));
    expect(meal.served?.week?.members).toHaveLength(3);
    // One blob per read, newest first — never m-void, never m-older.
    expect(blobReads("meal_plans")).toEqual([["m-bad"], ["m-good"]]);
  });

  it("meal: serves a plan whose first member is empty when another member has meals (the app's any-member rule)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tables.meal_plans = [
      mealRow("m-new", "failed", 1, {}),
      // A dead shell: a valid plan, but nobody has a meal — read, passed over.
      mealRow("m-shell", "ready", 2, emptied()),
      // A killed regeneration of the owner: her days emptied, everyone else's
      // carried. Its probes (first member only) read 0 days, yet getLatestPlan
      // serves it — so it must be read, and it must win over the older week.
      mealRow("m-regen", "ready", 3, emptied("mom")),
      mealRow("m-good", "ready", 4, READY_PLAN),
    ];
    try {
      const meal = await family.loadMealSection(UID);
      expect(meal.served?.plan).toMatchObject({ id: "m-regen", status: "ready", daysReady: 0 });
      expect(meal.served?.masked).toBe(true);
      expect(meal.served?.week?.members.map((m) => [m.memberId, m.days.length])).toEqual([
        ["mom", 0],
        [DAD, 7],
        [KID, 7],
      ]);
      expect(blobReads("meal_plans")).toEqual([["m-shell"], ["m-regen"]]);
    } finally {
      warn.mockRestore();
    }
  });

  it("meal: an unreadable candidate is served on its probes, without a week", async () => {
    tables.meal_plans = [
      mealRow("m-new", "failed", 1, {}),
      mealRow("m-bad", "ready", 3, BAD_PLAN),
      mealRow("m-good", "ready", 4, READY_PLAN),
    ];
    // The second blob read (m-good) fails; m-bad was already ruled out.
    const restore = failMealBlobReadFrom(2);
    try {
      const meal = await family.loadMealSection(UID);
      expect(meal.served?.plan).toMatchObject({ id: "m-good", status: "ready" });
      expect(meal.served?.masked).toBe(true);
      expect(meal.served?.week).toBeNull();
    } finally {
      restore();
    }
  });

  it("meal: once a blob read fails, the probes decide the rest — with no further reads", async () => {
    tables.meal_plans = [
      mealRow("m-new", "failed", 1, {}),
      // Unreadable, and its probes show no meals: the list's rule passes it over…
      mealRow("m-regen", "ready", 2, emptied("mom")),
      // …and serves the next candidate whose probes show meals, unread.
      mealRow("m-good", "ready", 4, READY_PLAN),
    ];
    const restore = failMealBlobReadFrom(1);
    try {
      const meal = await family.loadMealSection(UID);
      expect(meal.served?.plan).toMatchObject({ id: "m-good", status: "ready" });
      expect(meal.served?.masked).toBe(true);
      expect(meal.served?.week).toBeNull();
      expect(blobReads("meal_plans")).toEqual([["m-regen"]]);
    } finally {
      restore();
    }
  });

  it("meal: with nothing older to serve, the failed run stands", async () => {
    tables.meal_plans = [
      mealRow("m-new", "failed", 1, {}),
      mealRow("m-bad", "ready", 3, BAD_PLAN),
    ];
    const meal = await family.loadMealSection(UID);
    expect(meal.served?.plan).toMatchObject({ id: "m-new", status: "failed" });
    expect(meal.served?.masked).toBe(false);
    expect(blobReads("meal_plans")).toEqual([["m-bad"]]);
  });

  it("workout: stops at the first ready program the app serves", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const base = tables.workout_plans![0]!;
    const at = (ageDays: number) => ({
      created_at: daysAgo(ageDays),
      updated_at: daysAgo(ageDays),
    });
    tables.workout_plans = [
      {
        ...base,
        ...at(1),
        id: "w-new",
        status: "failed",
        generated_at: null,
        error_message: "timeout",
        plan_data: {},
      },
      // Ready, but not a program the schema accepts.
      { ...base, ...at(2), id: "w-bad", plan_data: { members: "nope" } },
      { ...base, ...at(3), id: "w-good" },
      { ...base, ...at(4), id: "w-older" },
    ];
    try {
      const workout = await family.loadWorkoutSection(UID);
      expect(workout.latest).toMatchObject({ id: "w-new", status: "failed" });
      expect(workout.served?.plan).toMatchObject({
        id: "w-good",
        status: "ready",
        traineeCount: 1,
      });
      expect(workout.served?.masked).toBe(true);
      // The failed newest row has no program to read; then w-bad, then w-good.
      expect(blobReads("workout_plans")).toEqual([["w-bad"], ["w-good"]]);
    } finally {
      warn.mockRestore();
    }
  });

  it("workout: only this week's marks count — last Thursday is not this Thursday", async () => {
    tables.workout_checkins!.push({
      user_id: UID,
      member_id: "mom",
      day_index: 4,
      status: "done",
      intensity: "hard",
      local_date: addDaysISO(SUNDAY, -3),
      created_at: minAgo(30),
    });
    const workout = await family.loadWorkoutSection(UID);
    const mom = workout.served!.trainees[0]!;
    expect(mom.doneThisWeek).toBe(1);
    expect(mom.sessions.find((s) => s.dayIndex === 0)?.mark?.status).toBe("done");
    expect(mom.sessions.find((s) => s.dayIndex === 4)?.mark).toBeNull();
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

describe("the family page reads the household off the plan it is served", () => {
  /** A meal_plans row with its probes, `ageMin` minutes old. */
  const planRow = (id: string, status: string, ageMin: number, planData: unknown) => ({
    id,
    user_id: UID,
    status,
    created_at: minAgo(ageMin),
    updated_at: minAgo(ageMin),
    generated_at: status === "ready" ? minAgo(ageMin) : null,
    error_message: status === "failed" ? "timeout" : null,
    ai_input_tokens: 1,
    ai_output_tokens: 1,
    ai_model: "claude-sonnet-4-6",
    plan_data: planData,
    ...probeFromPlanData(planData),
  });
  const days = (indices: number[], meals: unknown[]) => indices.map((i) => day(i, meals));
  const WEEK = [0, 1, 2, 3, 4, 5, 6];
  /** A meal-run audit row that is still 'started' (a hard-killed run never closes its row). */
  const liveMealRun = (ageMin: number, mealPlanId: string) => ({
    ...tables.plan_generations![0]!,
    id: "g-live",
    status: "started",
    cost_usd: null,
    created_at: minAgo(ageMin),
    started_at: minAgo(ageMin),
    meal_plan_id: mealPlanId,
  });

  it("counts the days ready as the household's, not the first member's", async () => {
    // The dad's days keep failing: he has two, everyone else seven.
    const SHORT = {
      ...READY_PLAN,
      members: READY_PLAN.members.map((m) =>
        m.member_id === DAD ? { ...m, days: days([0, 1], [meal("breakfast", "فطور", 400)]) } : m,
      ),
    };
    tables.meal_plans = [planRow("m-short", "ready", 60, SHORT)];
    tables.plan_generations = tables.plan_generations!.filter((g) => g.plan_kind === "workout");
    const section = await family.loadMealSection(UID);
    // The probes (the first member, the owner) would say 7/7.
    expect(probeFromPlanData(SHORT).d6).not.toBeNull();
    expect(section.served?.plan).toMatchObject({ id: "m-short", daysReady: 2, daysTotal: 7 });
    expect(section.served?.week?.completeDays).toEqual([0, 1]);
    // Its history row says the same as its summary.
    expect(section.plans.find((p) => p.id === "m-short")?.daysReady).toBe(2);
  });

  it("flags the header by the plan the app serves, as the Meal tab shows it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // The owner regenerated her own week: her days were emptied, everyone
    // else's carried, and the run was killed before her first day landed.
    const REGEN = {
      ...READY_PLAN,
      generating: true,
      members: READY_PLAN.members.map((m) =>
        m.member_id === "mom" ? { ...m, days: days(WEEK, []) } : m,
      ),
    };
    tables.meal_plans = [
      planRow("m-regen", "ready", 30, REGEN),
      planRow("m-old", "ready", 6 * 24 * 60, READY_PLAN),
    ];
    tables.plan_generations = [liveMealRun(30, "m-regen"), ...tables.plan_generations!.slice(1)];
    try {
      const [header, section] = await Promise.all([
        family.loadFamilyHeader(UID),
        family.loadMealSection(UID),
      ]);
      // The app keeps the partial week: ready, not masked.
      expect(section.served?.plan).toMatchObject({ id: "m-regen", status: "ready" });
      expect(section.served?.masked).toBe(false);
      // So the header raises no failed run over it (the probes, which see the
      // empty owner only, would have called it failed and masked).
      expect(header?.flags).not.toContain("failed_meal_run");
      expect(header?.reasons.map((r) => r.flag)).not.toContain("failed_meal_run");
    } finally {
      warn.mockRestore();
    }
  });

  it("drops a member removed from the household, as /plan does", async () => {
    const GHOST = "99999999-9999-4999-8999-999999999999";
    const WITH_GHOST = {
      ...READY_PLAN,
      members: [
        ...READY_PLAN.members,
        weekFor(GHOST, { days: days([0], [meal("breakfast", "فطور", 400)]) }),
      ],
    };
    tables.meal_plans = [planRow("m-1", "ready", 60, WITH_GHOST)];
    const section = await family.loadMealSection(UID);
    expect(section.served?.week?.members.map((m) => m.memberId)).toEqual(["mom", DAD, KID]);
    // The ghost's one day does not hold the household's week back.
    expect(section.served?.week?.completeDays).toEqual(WEEK);
    expect(section.served?.plan.daysReady).toBe(7);
  });

  it("decides who is a child by the app's rule, and shows a child's figures as /plan does", async () => {
    const TEEN = "66666666-6666-4666-8666-666666666666";
    tables.family_members!.push({
      ...tables.family_members![0]!,
      id: TEEN,
      name: "سعود",
      role: "son",
      // Saved as an adult, but fifteen: the engine plans him by portions.
      member_type: "adult",
      birth_year: new Date().getFullYear() - 15,
      medical_conditions: [],
      display_order: 4,
    });
    // A plan from before the engine stamped is_child, with the skeleton's
    // throwaway estimates on the header.
    const UNSTAMPED = {
      ...READY_PLAN,
      members: [
        weekFor("mom"),
        weekFor(DAD),
        weekFor(KID, { primary_goal: null, daily_calories_target: 2730 }),
        weekFor(TEEN, { primary_goal: null, daily_calories_target: 2400 }),
      ],
    };
    tables.meal_plans = [planRow("m-1", "ready", 60, UNSTAMPED)];
    const [section, household] = await Promise.all([
      family.loadMealSection(UID),
      family.loadHousehold(UID),
    ]);
    const week = new Map(section.served!.week!.members.map((m) => [m.memberId, m]));
    for (const id of [KID, TEEN]) {
      expect(week.get(id), id).toMatchObject({ isChild: true, caloriesTarget: null });
    }
    expect(week.get(DAD)).toMatchObject({ isChild: false, caloriesTarget: 1700 });
    // The average of their real days (1500 kcal each), not the estimate.
    const byId = new Map(household.map((m) => [m.id, m]));
    expect(byId.get(KID)).toMatchObject({ caloriesTarget: 1500 });
    expect(byId.get(KID)?.macros).toEqual({ protein_g: 90, carbs_g: 150, fat_g: 50 });
    expect(byId.get(TEEN)).toMatchObject({ caloriesTarget: 1500 });
    expect(byId.get(DAD)).toMatchObject({ caloriesTarget: 1700 });
  });

  it("keeps the household's targets while a new run is still planning", async () => {
    // A regeneration in its skeleton phase: the worker has ACKed, nothing more.
    const ACK = { worker_ack_at: minAgo(1) };
    tables.meal_plans = [
      { ...planRow("m-run", "generating", 2, ACK), updated_at: minAgo(1) },
      planRow("m-old", "ready", 6 * 24 * 60, READY_PLAN),
    ];
    tables.plan_generations = [liveMealRun(2, "m-run"), ...tables.plan_generations!.slice(1)];
    // The panel: one reader for every section, as a page render shares one.
    const { meal: section, household } = (await family.loadFamilyPanel(UID))!;
    expect(section.served?.plan).toMatchObject({ id: "m-run", status: "generating" });
    // The latest computed targets: the previous week's.
    expect(household.map((m) => [m.id, m.caloriesTarget])).toEqual([
      ["mom", 1700],
      [DAD, 2600],
      [KID, 1500],
      [COOK, null],
    ]);
    expect(household[0]!.macros).toEqual({ protein_g: 120, carbs_g: 170, fat_g: 55 });
    // One extra blob, the earlier plan's — the running row's is the served one.
    expect(blobReads("meal_plans")).toEqual([["m-run"], ["m-old"]]);
  });

  it("reads the targets a dead run's skeleton wrote when there is no earlier plan", async () => {
    const SHELL = {
      ...READY_PLAN,
      members: READY_PLAN.members.map((m) => ({ ...m, days: days(WEEK, []) })),
    };
    tables.meal_plans = [planRow("m-dead", "failed", 60, SHELL)];
    const household = await family.loadHousehold(UID);
    expect(household.map((m) => [m.id, m.caloriesTarget])).toEqual([
      ["mom", 1700],
      [DAD, 2600],
      [KID, 1200],
      [COOK, null],
    ]);
  });

  it("reads no earlier plan when the served one already covers everyone", async () => {
    tables.meal_plans = [
      planRow("m-new", "ready", 60, READY_PLAN),
      planRow("m-old", "ready", 6 * 24 * 60, READY_PLAN),
    ];
    await family.loadHousehold(UID);
    expect(blobReads("meal_plans")).toEqual([["m-new"]]);
  });

  it("probes only the serve window and the history's newest rows", async () => {
    tables.meal_plans = Array.from({ length: 30 }, (_, i) =>
      planRow(`m-${String(i).padStart(2, "0")}`, "ready", (i + 1) * 24 * 60, READY_PLAN),
    );
    const section = await family.loadMealSection(UID);
    const reads = probeReads("meal_plans");
    expect(reads).toHaveLength(2);
    expect(reads.flat()).toHaveLength(family.MEAL_HISTORY_PROBED_ROWS);
    // Rows past them have no day count — unknown, never guessed.
    expect(section.plans.slice(0, family.MEAL_HISTORY_PROBED_ROWS).every((p) => p.daysReady === 7)).toBe(
      true,
    );
    expect(section.plans.slice(family.MEAL_HISTORY_PROBED_ROWS).every((p) => p.daysReady === null)).toBe(
      true,
    );
  });

  it("reads the chat figures without paging through every message in turn", async () => {
    tables.chat_messages = Array.from({ length: 2500 }, (_, i) => ({
      id: `c-${String(i).padStart(5, "0")}`,
      user_id: UID,
      cost_usd: "0.01",
      created_at: minAgo(10 + i),
    }));
    const header = await family.loadFamilyHeader(UID);
    expect(header?.engagement.chatCount).toBe(2500);
    expect(header?.engagement.lastChatAt).toBe(minAgo(10));
    expect(header?.engagement.chatCostUsd).toBeCloseTo(25, 6);
    expect(header?.lifetimeAiCostUsd).toBeCloseTo(0.46 + 0.94 + 3.1 + 25, 6);
    expect(header?.lastActivityAt).toBe(minAgo(10));
    // One count, the newest message, and the cost column's three pages.
    expect(calls.filter((c) => c === "chat_messages#count")).toHaveLength(1);
    expect(calls.filter((c) => c === "chat_messages")).toHaveLength(4);
  });

  it("starts the week's session marks with the program rows, not after the program's blob", async () => {
    await family.loadWorkoutSection(UID);
    expect(calls.indexOf("workout_checkins")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("workout_checkins")).toBeLessThan(calls.indexOf("workout_plans#blob"));
  });
});
