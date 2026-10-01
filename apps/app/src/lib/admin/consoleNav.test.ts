import { beforeEach, describe, expect, it, vi } from "vitest";

// The loaders are thin unstable_cache wrappers over the 60s dataset: a hit
// is handed back however old it is (stale-while-revalidate), a miss runs the
// function. Fed a fixed dataset and list.
const cacheEntries = new Map<string, unknown>();
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: () => Promise<unknown>, keyParts: string[]) =>
    async () => {
      const key = keyParts.join("|");
      if (!cacheEntries.has(key)) cacheEntries.set(key, await fn());
      return cacheEntries.get(key);
    },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const loadAdminDataset = vi.fn();
const loadFamilyList = vi.fn();
vi.mock("@/lib/admin/queries", () => ({
  loadAdminDataset: () => loadAdminDataset(),
  loadFamilyList: () => loadFamilyList(),
}));

import type { FamilyRow } from "./console-types";
import { loadConsoleNavData, loadFamilySearchIndex } from "./consoleNav";

/** A snapshot read just now: the cached entries below may be served as they are. */
const LOADED = new Date().toISOString();

const row = (userId: string, email: string, status: string | null, flags: FamilyRow["flags"] = []) =>
  ({
    userId,
    displayName: `name-${userId}`,
    email,
    status,
    cancelState: "none",
    flags,
  }) as unknown as FamilyRow;

beforeEach(() => {
  cacheEntries.clear();
  loadFamilyList.mockClear();
  loadAdminDataset.mockClear();
  loadFamilyList.mockResolvedValue({
    rows: [
      row("u1", "one@example.com", "active"),
      row("u2", "two@example.com", "trialing", ["onboarding_incomplete"]),
      row("u3", "three@example.com", null),
    ],
    loadedAt: LOADED,
    truncated: ["emails"],
  });
  loadAdminDataset.mockResolvedValue({
    profiles: [
      { id: "u1", display_name: "هند" },
      { id: "u2", display_name: null },
    ],
    emailByUser: new Map([["u1", "one@example.com"]]),
    loadedAt: LOADED,
  });
});

describe("loadConsoleNavData (every console page)", () => {
  it("is the rail's counts and nothing that names a family", async () => {
    const nav = await loadConsoleNavData();
    expect(Object.keys(nav).sort()).toEqual(["counts", "loadedAt", "truncated"]);
    expect(nav.counts.all).toBe(3);
    expect(nav.counts.attention).toBe(1);
    expect(nav.counts.active).toBe(1);
    expect(nav.loadedAt).toBe(LOADED);
    expect(nav.truncated).toEqual(["emails"]);
    const text = JSON.stringify(nav);
    expect(text).not.toContain("@example.com");
    expect(text).not.toContain("name-u1");
  });
});

describe("loadFamilySearchIndex (the audited ⌘K route only)", () => {
  it("lists every family by id, name and email, in dataset order", async () => {
    expect(await loadFamilySearchIndex()).toEqual({
      families: [
        { id: "u1", name: "هند", email: "one@example.com" },
        { id: "u2", name: null, email: null },
      ],
      loadedAt: LOADED,
    });
  });
});

describe("how old the frame's data may be", () => {
  const OLD = new Date(Date.now() - 9 * 3_600_000).toISOString();

  it("serves the cached rail counts while they are recent", async () => {
    cacheEntries.set("admin-console-nav|v2", {
      counts: { all: 99 },
      loadedAt: new Date(Date.now() - 90_000).toISOString(),
      truncated: [],
    });
    expect((await loadConsoleNavData()).counts.all).toBe(99);
    expect(loadFamilyList).not.toHaveBeenCalled();
  });

  it("cuts the rail counts from the dataset rather than serve them hours old", async () => {
    cacheEntries.set("admin-console-nav|v2", { counts: { all: 99 }, loadedAt: OLD, truncated: [] });
    const nav = await loadConsoleNavData();
    expect(nav.counts.all).toBe(3);
    expect(nav.loadedAt).toBe(LOADED);
  });

  it("does the same for the ⌘K index", async () => {
    cacheEntries.set("admin-family-search-index|v1", { families: [], loadedAt: OLD });
    expect((await loadFamilySearchIndex()).families).toHaveLength(2);
  });
});
