import { describe, expect, it, vi } from "vitest";

// queries.ts → db.ts imports the service-role client factory; stub it so the
// import chain never touches env. buildFamilyRows is pure over the dataset.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { buildFamilyRows, type AdminDataset, type PlanProbeLite } from "./queries";

const LOADED = "2026-09-29T12:00:00.000Z";
const NOW = Date.parse(LOADED);
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const daysAgo = (d: number) => minAgo(d * 24 * 60);

const U = {
  hind: "00000000-0000-4000-8000-000000000001",
  abeer: "00000000-0000-4000-8000-000000000002",
  maha: "00000000-0000-4000-8000-000000000003",
  reem: "00000000-0000-4000-8000-000000000004",
  old: "00000000-0000-4000-8000-000000000005",
};

const profile = (id: string, name: string, onboarded = true) => ({
  id,
  display_name: name,
  preferred_language: "ar",
  created_at: daysAgo(90),
  onboarding_completed_at: onboarded ? daysAgo(89) : null,
  family_wide_completed_at: null,
  mom_profile_completed_at: null,
});

const sub = (user_id: string, p: Partial<AdminDataset["subscriptions"][number]> = {}) => ({
  user_id,
  tier: "family",
  status: "active",
  cadence: "monthly",
  created_at: daysAgo(80),
  updated_at: daysAgo(3),
  trial_started_at: null,
  trial_ends_at: null,
  current_period_end: daysAgo(-14),
  cancel_at_period_end: false,
  cancelled_at: null,
  lemonsqueezy_subscription_id: "1",
  ...p,
});

/** Probe values for a plan with `days` real days for the first member. */
const probes = (days: number, extra: Partial<PlanProbeLite> = {}) => {
  const out: Record<string, unknown> = {
    days_total: 7,
    generating: false,
    ack: null,
    ws: "2026-09-27",
    m0: "mom",
  };
  for (let i = 0; i < 7; i += 1) out[`d${i}`] = i < days ? "breakfast" : null;
  return { ...out, ...extra };
};

const gen = (
  id: string,
  user_id: string,
  status: string,
  created_at: string,
  plan_kind: string | null = "meal",
  cost_usd: number | null = 0.5,
) => ({
  id,
  user_id,
  plan_kind,
  cost_usd,
  created_at,
  completed_at: null,
  status,
  error_message: null,
  failure_reason: null,
  meal_plan_id: null,
  workout_plan_id: null,
});

function dataset(): AdminDataset {
  const plans = [
    // hind: a ready week, current.
    { id: "p-hind", user_id: U.hind, status: "ready", created_at: daysAgo(2) },
    // abeer: newest run failed with nothing, previous week still served (masked).
    { id: "p-abeer-new", user_id: U.abeer, status: "failed", created_at: daysAgo(1) },
    { id: "p-abeer-old", user_id: U.abeer, status: "ready", created_at: daysAgo(8) },
    { id: "p-abeer-arch", user_id: U.abeer, status: "archived", created_at: daysAgo(15) },
    // reem: a live generation, 3 days in.
    { id: "p-reem", user_id: U.reem, status: "ready", created_at: minAgo(6) },
    // old: only a plan from before the probe window.
    { id: "p-old", user_id: U.old, status: "ready", created_at: daysAgo(40) },
  ];
  const planProbes: PlanProbeLite[] = [
    {
      id: "p-hind",
      user_id: U.hind,
      status: "ready",
      created_at: daysAgo(2),
      updated_at: daysAgo(2),
      ...probes(7),
    },
    {
      id: "p-abeer-new",
      user_id: U.abeer,
      status: "failed",
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
      ...probes(0, { m0: null, ws: null }),
    },
    {
      id: "p-abeer-old",
      user_id: U.abeer,
      status: "ready",
      created_at: daysAgo(8),
      updated_at: daysAgo(8),
      ...probes(7),
    },
    {
      id: "p-reem",
      user_id: U.reem,
      status: "ready",
      created_at: minAgo(6),
      updated_at: minAgo(1),
      ...probes(3, { generating: true }),
    },
  ];
  return {
    profiles: [
      profile(U.hind, "هند"),
      profile(U.abeer, "عبير"),
      profile(U.maha, "مها", false),
      profile(U.reem, "ريم"),
      profile(U.old, "قديمة"),
    ],
    subscriptions: [
      sub(U.hind),
      sub(U.abeer, { tier: "premium" }),
      sub(U.maha, {
        tier: "starter",
        status: "trialing",
        trial_ends_at: daysAgo(-3),
        cancel_at_period_end: true,
      }),
      sub(U.reem, { tier: "pro", status: "past_due" }),
      sub(U.old),
    ],
    members: [
      { user_id: U.hind, role: "dad" },
      { user_id: U.hind, role: "housekeeper" },
      { user_id: U.reem, role: "dad" },
      { user_id: U.reem, role: "daughter" },
    ],
    plans,
    planProbes,
    workoutPlans: [
      {
        id: "w-hind",
        user_id: U.hind,
        status: "ready",
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
      },
      {
        id: "w-abeer-new",
        user_id: U.abeer,
        status: "failed",
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
      },
      {
        id: "w-abeer-old",
        user_id: U.abeer,
        status: "ready",
        created_at: daysAgo(9),
        updated_at: daysAgo(9),
      },
      {
        id: "w-reem",
        user_id: U.reem,
        status: "generating",
        created_at: minAgo(3),
        updated_at: minAgo(3),
      },
    ],
    generations: [
      gen("g1", U.hind, "failed", daysAgo(9)),
      gen("g2", U.hind, "completed", daysAgo(2)),
      gen("g3", U.hind, "completed", daysAgo(2), "workout", 0.94),
      gen("g4", U.abeer, "failed", daysAgo(1)),
      gen("g5", U.abeer, "failed", daysAgo(1), "workout"),
      gen("g6", U.reem, "started", minAgo(6), null, null),
    ],
    chats: [{ user_id: U.hind, cost_usd: 0.25, created_at: minAgo(30) }],
    emailByUser: new Map([[U.hind, "hind@example.com"]]),
    truncated: [],
    loadedAt: LOADED,
  };
}

const byId = (rows: ReturnType<typeof buildFamilyRows>, id: string) =>
  rows.find((r) => r.userId === id)!;

describe("buildFamilyRows", () => {
  const rows = buildFamilyRows(dataset());

  it("keeps every SubscriberRow field", () => {
    const hind = byId(rows, U.hind);
    expect(hind).toMatchObject({
      displayName: "هند",
      email: "hind@example.com",
      tier: "family",
      status: "active",
      beneficiaries: 2, // owner + dad; the housekeeper never counts
      hasHousekeeper: true,
      overLimit: false,
      plansGenerated: 1,
      failedPlans: 0,
      lastActivityAt: minAgo(30),
      onboardingComplete: true,
    });
    expect(hind.lifetimeAiCostUsd).toBeCloseTo(0.5 + 0.5 + 0.94 + 0.25, 6);
    expect(rows).toHaveLength(5);
  });

  it("reports the served meal plan and the exercise program", () => {
    const hind = byId(rows, U.hind);
    expect(hind.meal).toEqual({ state: "ready", daysReady: 7, daysTotal: 7, masked: false });
    expect(hind.workout).toEqual({ state: "ready", masked: false });
    // An old failed meal run followed by a completed one is not a flag.
    expect(hind.flags).toEqual([]);
  });

  it("applies the masked-failure rule on both plan kinds", () => {
    const abeer = byId(rows, U.abeer);
    expect(abeer.meal).toEqual({ state: "ready", daysReady: 7, daysTotal: 7, masked: true });
    expect(abeer.workout).toEqual({ state: "ready", masked: true });
    expect(abeer.flags).toEqual(["failed_workout_run", "failed_meal_run"]);
    expect(abeer.failedPlans).toBe(1);
    expect(abeer.plansGenerated).toBe(3);
  });

  it("shows a live run as generating with its progress", () => {
    const reem = byId(rows, U.reem);
    expect(reem.meal).toEqual({ state: "generating", daysReady: 3, daysTotal: 7, masked: false });
    expect(reem.workout).toEqual({ state: "generating", masked: false });
    // pro allows 2; owner + 2 members = 3.
    expect(reem.overLimit).toBe(true);
    expect(reem.flags).toEqual(["past_due", "over_limit"]);
  });

  it("gives a plan outside the probe window an unknown day count", () => {
    expect(byId(rows, U.old).meal).toEqual({
      state: "ready",
      daysReady: null,
      daysTotal: 7,
      masked: false,
    });
  });

  it("flags onboarding and a scheduled cancellation for a new trial with no plans", () => {
    const maha = byId(rows, U.maha);
    expect(maha.meal.state).toBe("none");
    expect(maha.workout.state).toBe("none");
    expect(maha.flags).toEqual(["cancel_scheduled", "onboarding_incomplete"]);
  });

  it("judges staleness against when the dataset was read", () => {
    // Twenty minutes after the snapshot the same rows would call Reem's run
    // dead — but the default clock is the snapshot's own.
    const late = buildFamilyRows(dataset(), NOW + 20 * 60_000);
    expect(byId(late, U.reem).meal.state).toBe("ready"); // partial week kept
    expect(byId(late, U.reem).workout.state).toBe("failed");
    // The dead program run flags the family although it wrote no failed audit row.
    expect(byId(late, U.reem).flags).toContain("failed_workout_run");
  });

  it("flags failures the newest audit row does not show", () => {
    const ds = dataset();
    // Hind: a workout run hard-killed 30 minutes ago. Its program row is still
    // 'generating' and its audit row still 'started' (no workout sweeper);
    // the previous program is served in its place.
    ds.workoutPlans.push({
      id: "w-hind-dead",
      user_id: U.hind,
      status: "generating",
      created_at: minAgo(30),
      updated_at: minAgo(30),
    });
    ds.generations.push(gen("g7", U.hind, "started", minAgo(30), "workout", null));
    // Abeer: after her failed meal run, a housekeeper translation pass wrote
    // its own audit row — plan_kind left to the column default (meal) — and
    // completed it. The newest meal-kind row no longer says failed.
    ds.generations.push(gen("g8", U.abeer, "completed", minAgo(10), null, 0.02));

    const out = buildFamilyRows(ds);
    const hind = byId(out, U.hind);
    expect(hind.workout).toEqual({ state: "ready", masked: true });
    expect(hind.flags).toEqual(["failed_workout_run"]);
    const abeer = byId(out, U.abeer);
    expect(abeer.meal.masked).toBe(true);
    expect(abeer.flags).toEqual(["failed_workout_run", "failed_meal_run"]);
  });

  it("tolerates a dataset cached before the rebuild (no probes, no programs)", () => {
    const legacy = { ...dataset() } as Partial<AdminDataset>;
    delete legacy.planProbes;
    delete legacy.workoutPlans;
    const out = buildFamilyRows(legacy as AdminDataset);
    expect(byId(out, U.hind).meal).toEqual({
      state: "ready",
      daysReady: null,
      daysTotal: 7,
      masked: false,
    });
    expect(byId(out, U.hind).workout.state).toBe("none");
  });
});
