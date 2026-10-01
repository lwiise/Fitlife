import { beforeEach, describe, expect, it, vi } from "vitest";

import { probeFromPlanData } from "./mealProjection";

/**
 * loadAdminDataset over a fake database: HOW the dataset is read — every
 * table a page at a time by key (never LIMIT/OFFSET), the meal-plan probes
 * only for the rows that decide what each household is served, lean cached
 * rows — and that a cached snapshot is never served once it is more than two
 * TTLs old. buildFamilyRows itself is covered by queries.test.ts.
 */

type Row = Record<string, unknown>;

interface Read {
  table: string;
  columns: string;
  afterId: string | null;
  limit: number | null;
  ids: string[] | null;
  usedRange: boolean;
}

let tables: Record<string, Row[]>;
let reads: Read[];
let authPages: number;

const PROBE_COLUMNS_PREFIX = "id, status, updated_at, ";

/** The listed columns of a plain select ("a, b, c"). */
const pick = (row: Row, columns: string): Row =>
  Object.fromEntries(columns.split(",").map((c) => [c.trim(), row[c.trim()] ?? null]));

function query(table: string) {
  const read: Read = { table, columns: "", afterId: null, limit: null, ids: null, usedRange: false };
  const run = () => {
    reads.push(read);
    let rows = [...(tables[table] ?? [])].sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
    if (read.afterId !== null) rows = rows.filter((r) => String(r.id) > read.afterId!);
    if (read.ids) rows = rows.filter((r) => read.ids!.includes(String(r.id)));
    if (read.limit !== null) rows = rows.slice(0, read.limit);
    const data = read.columns.startsWith(PROBE_COLUMNS_PREFIX)
      ? rows.map((r) => ({
          id: r.id,
          status: r.status,
          updated_at: r.updated_at,
          ...probeFromPlanData(r.plan_data),
        }))
      : rows.map((r) => pick(r, read.columns));
    return { data, error: null };
  };
  const b: Record<string, unknown> = {
    select: (c: string) => ((read.columns = c), b),
    gt: (k: string, v: string) => {
      if (k !== "id") throw new Error(`unexpected gt on ${k}`);
      read.afterId = v;
      return b;
    },
    order: () => b,
    limit: (n: number) => ((read.limit = n), b),
    in: (_k: string, v: string[]) => ((read.ids = [...v]), b),
    range: () => ((read.usedRange = true), b),
    returns: () => b,
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
      Promise.resolve().then(run).then(ok, bad),
  };
  return b;
}

const fakeDb = {
  from: (table: string) => query(table),
  auth: {
    admin: {
      listUsers: async ({ page }: { page: number }) => {
        authPages += 1;
        const users = page === 1 ? [{ id: HIND, email: "hind@example.com" }] : [];
        return { data: { users }, error: null };
      },
    },
  },
};

/** The unstable_cache entries, by key: a hit is handed back however old it is. */
const cacheEntries = new Map<string, unknown>();

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/admin/db", () => ({ adminDb: () => fakeDb }));
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: () => Promise<unknown>, keyParts: string[]) =>
    async () => {
      const key = keyParts.join("|");
      if (cacheEntries.has(key)) return cacheEntries.get(key);
      const value = await fn();
      cacheEntries.set(key, value);
      return value;
    },
}));

const { buildFamilyRows, loadAdminDataset } = await import("./queries");

// ── fixtures ────────────────────────────────────────────────────────────────

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HIND = id(1);
const ABEER = id(2);
const REEM = id(3);
const MANY = id(4);

const now = Date.now();
const minAgo = (m: number) => new Date(now - m * 60_000).toISOString();

const WEEK = {
  week_start_date: "2026-09-27",
  days_total: 7,
  members: [
    {
      member_id: "mom",
      days: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ day_index: i, meals: [{ slot: "breakfast" }] })),
    },
  ],
};
const DEAD_SHELL = {
  week_start_date: "2026-09-27",
  generating: true,
  members: [{ member_id: "mom", days: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ day_index: i, meals: [] })) }],
};

let planSeq = 0;
const plan = (userId: string, status: string, ageMin: number, planData: unknown): Row => {
  planSeq += 1;
  return {
    id: `pl-${String(planSeq).padStart(3, "0")}`,
    user_id: userId,
    status,
    created_at: minAgo(ageMin),
    updated_at: minAgo(ageMin),
    plan_data: planData,
  };
};

function seed() {
  planSeq = 0;
  const plans = [
    // Hind: a served week, and an older one nobody needs to look at.
    plan(HIND, "ready", 60, WEEK),
    plan(HIND, "ready", 60 * 24 * 7, WEEK),
    // Abeer: her newest run failed outright; last week is served.
    plan(ABEER, "failed", 30, {}),
    plan(ABEER, "ready", 60 * 24 * 7, WEEK),
    plan(ABEER, "archived", 60 * 24 * 8, WEEK),
    // Reem: a shell whose run died before any meal landed; last week is served.
    plan(REEM, "ready", 40, DEAD_SHELL),
    plan(REEM, "ready", 60 * 24 * 7, WEEK),
  ];
  // A household with a long history: only its newest row is ever probed.
  for (let w = 0; w < 8; w += 1) plans.push(plan(MANY, "ready", 60 * (1 + w * 24 * 7), WEEK));

  tables = {
    // 1001 profiles: two keyset pages.
    profiles: Array.from({ length: 1001 }, (_, i) => ({
      id: id(i + 1),
      display_name: `عائلة ${i + 1}`,
      preferred_language: "ar",
      created_at: minAgo(60 * 24 * 90),
      onboarding_completed_at: minAgo(60 * 24 * 89),
      family_wide_completed_at: null,
      mom_profile_completed_at: null,
    })),
    subscriptions: [
      { id: "s-b", user_id: HIND, tier: "family", status: "active", created_at: minAgo(100) },
      { id: "s-a", user_id: HIND, tier: "pro", status: "cancelled", created_at: minAgo(5000) },
    ].map((s) => ({
      cadence: "monthly",
      updated_at: s.created_at,
      trial_started_at: null,
      trial_ends_at: null,
      current_period_end: minAgo(-60 * 24 * 10),
      ends_at: null,
      cancel_at_period_end: false,
      cancelled_at: null,
      lemonsqueezy_subscription_id: "1",
      ...s,
    })),
    family_members: [{ id: "fm-1", user_id: HIND, role: "dad" }],
    meal_plans: plans,
    workout_plans: [],
    plan_generations: [
      {
        id: "g-1",
        user_id: HIND,
        plan_kind: "meal",
        cost_usd: "0.5",
        created_at: minAgo(60),
        status: "completed",
        error_message: "never cached",
        meal_plan_id: "pl-001",
      },
    ],
    chat_messages: [{ id: "c-1", user_id: HIND, cost_usd: "0.25", created_at: minAgo(5) }],
  };
}

beforeEach(() => {
  seed();
  reads = [];
  authPages = 0;
  cacheEntries.clear();
});

const readsOf = (table: string) => reads.filter((r) => r.table === table && !r.ids);
const probeReads = () => reads.filter((r) => r.table === "meal_plans" && r.ids).map((r) => r.ids!);

describe("loadAdminDataset — how the dataset is read", () => {
  it("pages every table by key, never by offset", async () => {
    await loadAdminDataset();
    expect(reads.some((r) => r.usedRange)).toBe(false);
    const profilePages = readsOf("profiles");
    expect(profilePages.map((p) => [p.afterId, p.limit])).toEqual([
      [null, 1000],
      [id(1000), 1000],
    ]);
    for (const table of ["subscriptions", "family_members", "meal_plans", "plan_generations"]) {
      expect(readsOf(table).every((r) => r.limit === 1000), table).toBe(true);
    }
  });

  it("probes only the plans that decide what each household is served", async () => {
    const ds = await loadAdminDataset();
    const ids = (userId: string, ...statuses: string[]) =>
      tables.meal_plans!.filter((p) => p.user_id === userId && statuses.includes(String(p.status)));
    const [hindNew] = ids(HIND, "ready");
    const [, abeerOld] = ids(ABEER, "failed", "ready");
    const [reemShell, reemOld] = ids(REEM, "ready");
    const [manyNewest] = ids(MANY, "ready");
    // Round 1: each household's newest row — and, where that row is a raw
    // failure (it decides itself, unprobed), its fallbacks at once. Round 2:
    // the fallbacks of a newest row whose probes showed it died empty.
    const [round1, round2, ...more] = probeReads();
    expect(round1!.sort()).toEqual([hindNew!.id, abeerOld!.id, reemShell!.id, manyNewest!.id].sort());
    expect(round2).toEqual([reemOld!.id]);
    expect(more).toEqual([]);
    expect(ds.planProbes.map((p) => p.id).sort()).toEqual(
      [hindNew!.id, reemShell!.id, manyNewest!.id, abeerOld!.id, reemOld!.id].sort(),
    );

    // And the list's cells are what the full probe set would give.
    const rows = new Map(buildFamilyRows(ds).map((r) => [r.userId, r]));
    expect(rows.get(HIND)?.meal).toEqual({ state: "ready", daysReady: 7, daysTotal: 7, masked: false });
    expect(rows.get(ABEER)?.meal).toEqual({ state: "ready", daysReady: 7, daysTotal: 7, masked: true });
    expect(rows.get(REEM)?.meal).toEqual({ state: "ready", daysReady: 7, daysTotal: 7, masked: true });
    expect(rows.get(MANY)?.meal).toEqual({ state: "ready", daysReady: 7, daysTotal: 7, masked: false });
  });

  it("keeps only what its readers read", async () => {
    const ds = await loadAdminDataset();
    expect(Object.keys(ds.generations[0]!).sort()).toEqual([
      "cost_usd",
      "created_at",
      "plan_kind",
      "status",
      "user_id",
    ]);
    expect(ds.generations[0]!.cost_usd).toBe(0.5);
    expect(Object.keys(ds.chats[0]!).sort()).toEqual(["cost_usd", "created_at", "user_id"]);
    expect(Object.keys(ds.members[0]!).sort()).toEqual(["role", "user_id"]);
    // Newest subscription first, whatever the key order the pages came in.
    expect(ds.subscriptions.map((s) => s.tier)).toEqual(["family", "pro"]);
    expect("id" in ds.subscriptions[0]!).toBe(false);
    // The cached value survives JSON.
    const cached = cacheEntries.get("admin-dataset|v4");
    expect(JSON.parse(JSON.stringify(cached))).toEqual(cached);
  });
});

describe("loadAdminDataset — how old a snapshot may be", () => {
  const cachedDataset = async (loadedAt: string) => {
    await loadAdminDataset();
    const entry = cacheEntries.get("admin-dataset|v4") as { loadedAt: string; profiles: unknown[] };
    cacheEntries.set("admin-dataset|v4", { ...entry, loadedAt, profiles: [] });
    reads = [];
    authPages = 0;
  };

  it("serves a cached snapshot up to two TTLs old without reading", async () => {
    await cachedDataset(minAgo(1.5));
    const ds = await loadAdminDataset();
    expect(ds.profiles).toEqual([]);
    expect(reads).toEqual([]);
  });

  it("reads for itself rather than serve a snapshot hours old", async () => {
    await cachedDataset(minAgo(60 * 9));
    const ds = await loadAdminDataset();
    expect(ds.profiles).toHaveLength(1001);
    expect(now - Date.parse(ds.loadedAt)).toBeLessThan(60_000);
    expect(readsOf("profiles").length).toBeGreaterThan(0);
  });

  it("bounds the email list the same way, on its own TTL", async () => {
    await loadAdminDataset();
    expect(authPages).toBe(2);
    const entry = cacheEntries.get("admin-email-map|v2") as { loadedAt: string };
    cacheEntries.set("admin-email-map|v2", { ...entry, loadedAt: minAgo(9), entries: [] });
    authPages = 0;
    expect((await loadAdminDataset()).emailByUser.size).toBe(0);
    expect(authPages).toBe(0);
    cacheEntries.set("admin-email-map|v2", { ...entry, loadedAt: minAgo(11), entries: [] });
    expect((await loadAdminDataset()).emailByUser.get(HIND)).toBe("hind@example.com");
    expect(authPages).toBe(2);
  });
});
