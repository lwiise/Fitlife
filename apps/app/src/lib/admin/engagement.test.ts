import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Overview's engagement counters. What is pinned: a missing 00017 table
 * is a state (zeros, "apply the migration"), any other failed read is an
 * error that throws — so the cache never stores a blip as a minute or more of
 * zeros — and the cached counters are never served once two TTLs old.
 */

type Result = { data?: unknown; count?: number | null; error: { message: string; code?: string } | null };
let results: Record<string, Result>;
let readCount: number;

function query(table: string) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "gte", "limit", "eq", "order", "not"]) b[method] = () => b;
  b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
    Promise.resolve()
      .then(() => {
        readCount += 1;
        return { data: null, count: null, ...results[table] };
      })
      .then(ok, bad);
  return b;
}

const cacheEntries = new Map<string, unknown>();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("./db", () => ({ adminDb: () => ({ from: (t: string) => query(t) }) }));
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: () => Promise<unknown>, keyParts: string[]) =>
    async () => {
      const key = keyParts.join("|");
      if (!cacheEntries.has(key)) cacheEntries.set(key, await fn());
      return cacheEntries.get(key);
    },
}));

const { isMissingTable, loadEngagementStats } = await import("./engagement");

const ok = (): Record<string, Result> => ({
  meal_checkins: {
    data: [
      { user_id: "u1", local_date: "2026-09-30", slot: "lunch" },
      // A shared dish marked by two people: one meal.
      { user_id: "u1", local_date: "2026-09-30", slot: "lunch" },
      { user_id: "u2", local_date: "2026-09-29", slot: "dinner" },
    ],
    error: null,
  },
  meal_verdicts: { count: 4, error: null },
  body_logs: { count: 2, error: null },
  meal_plans: { data: [{ week_changes: ["x"] }, { week_changes: [] }], error: null },
  subscriptions: { data: [], error: null },
});

beforeEach(() => {
  cacheEntries.clear();
  results = ok();
  readCount = 0;
});

describe("loadEngagementStats", () => {
  it("counts distinct meals, households, verdicts and weigh-ins", async () => {
    expect(await loadEngagementStats()).toMatchObject({
      eventsAvailable: true,
      checkins7d: 2,
      activeCheckinHouseholds7d: 2,
      verdicts7d: 4,
      weighIns7d: 2,
      plansWithChangesPct: 50,
    });
  });

  it("reads a missing engagement table as the migration not applied, with zeros", async () => {
    for (const code of ["42P01", "PGRST205"]) {
      cacheEntries.clear();
      results = {
        ...ok(),
        meal_checkins: { error: { message: "relation does not exist", code } },
        // A HEAD count of a missing table: a 404 with no body — no error, no count.
        meal_verdicts: { count: null, error: null },
        body_logs: { count: null, error: null },
      };
      expect(await loadEngagementStats()).toMatchObject({
        eventsAvailable: false,
        checkins7d: 0,
        verdicts7d: 0,
        weighIns7d: 0,
      });
    }
    expect(isMissingTable({ message: "x", code: "57014" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });

  it("throws on any other failed read — and caches nothing, so the next load reads again", async () => {
    for (const table of ["meal_checkins", "meal_verdicts", "body_logs", "meal_plans", "subscriptions"]) {
      cacheEntries.clear();
      results = { ...ok(), [table]: { error: { message: "canceling statement", code: "57014" } } };
      await expect(loadEngagementStats(), table).rejects.toThrow(/canceling statement/);
      expect(cacheEntries.size, table).toBe(0);
    }
    results = ok();
    expect((await loadEngagementStats()).eventsAvailable).toBe(true);
  });

  it("serves cached counters while recent, and reads again once two TTLs old", async () => {
    await loadEngagementStats();
    const [key, entry] = [...cacheEntries][0]! as [string, { loadedAt: string; stats: object }];
    cacheEntries.set(key, {
      ...entry,
      loadedAt: new Date(Date.now() - 90_000).toISOString(),
      stats: { ...entry.stats, verdicts7d: 99 },
    });
    readCount = 0;
    expect((await loadEngagementStats()).verdicts7d).toBe(99);
    expect(readCount).toBe(0);
    cacheEntries.set(key, {
      ...entry,
      loadedAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
      stats: { ...entry.stats, verdicts7d: 99 },
    });
    expect((await loadEngagementStats()).verdicts7d).toBe(4);
    expect(readCount).toBe(5);
  });
});
