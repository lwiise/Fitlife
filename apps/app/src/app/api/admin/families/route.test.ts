import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminContext = vi.fn();
const logAdminAccess = vi.fn();
const loadFamilySearchIndex = vi.fn();

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ getAdminContext: () => getAdminContext() }));
vi.mock("@/lib/admin/audit", () => ({
  logAdminAccess: (params: unknown) => logAdminAccess(params),
}));
vi.mock("@/lib/admin/consoleNav", () => ({
  loadFamilySearchIndex: () => loadFamilySearchIndex(),
}));

import { GET } from "./route";

const INDEX = {
  families: [
    { id: "u1", name: "هند", email: "hind@example.com" },
    { id: "u2", name: null, email: "reem@example.com" },
  ],
  loadedAt: "2026-09-30T09:00:00.000Z",
};

beforeEach(() => {
  getAdminContext.mockReset();
  logAdminAccess.mockReset().mockResolvedValue(undefined);
  loadFamilySearchIndex.mockReset().mockResolvedValue(INDEX);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/admin/families (the ⌘K index)", () => {
  it("is a 404 for anyone but an admin, and reads and records nothing", async () => {
    getAdminContext.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(loadFamilySearchIndex).not.toHaveBeenCalled();
    expect(logAdminAccess).not.toHaveBeenCalled();
  });

  it("answers an admin with the index, uncached, after writing the list-view audit row", async () => {
    getAdminContext.mockResolvedValue({ userId: "admin-1", email: "ops@example.com" });
    let audited = false;
    logAdminAccess.mockImplementation(async () => {
      audited = true;
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual(INDEX);
    expect(audited).toBe(true);
    expect(logAdminAccess).toHaveBeenCalledTimes(1);
    expect(logAdminAccess).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      action: "view_subscriber_list",
      detail: { section: "palette", total: 2 },
    });
  });

  it("answers a failed read with a 500 and records no disclosure", async () => {
    getAdminContext.mockResolvedValue({ userId: "admin-1", email: "ops@example.com" });
    loadFamilySearchIndex.mockRejectedValue(new Error("admin load profiles: boom"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await res.json())).not.toContain("boom");
    expect(logAdminAccess).not.toHaveBeenCalled();
  });
});
