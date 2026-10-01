import { beforeEach, describe, expect, it, vi } from "vitest";

// The loaders are thin unstable_cache wrappers over the 60s dataset: run the
// cached functions directly, and feed them a fixed dataset and list.
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const loadAdminDataset = vi.fn();
const loadFamilyList = vi.fn();
vi.mock("@/lib/admin/queries", () => ({
  loadAdminDataset: () => loadAdminDataset(),
  loadFamilyList: () => loadFamilyList(),
}));

import type { FamilyRow } from "./console-types";
import { loadConsoleNavData, loadFamilySearchIndex } from "./consoleNav";

const LOADED = "2026-09-30T09:00:00.000Z";

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
