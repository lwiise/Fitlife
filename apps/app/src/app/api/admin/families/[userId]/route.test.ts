import { beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_FAMILY_GONE, PANEL_NOT_FOUND, PANEL_UNAVAILABLE } from "@/lib/admin/panelResponse";

/**
 * GET /api/admin/families/:id — the side panel's one round trip. Its 404s
 * must keep two answers apart: to anyone who is not (or no longer) an admin a
 * bare 404 that says nothing, and only to an admin the marked «this family is
 * gone» the panel may show and remember. A failed admin lookup is a 503.
 */

const resolveAdminAccess = vi.fn();
const logAdminAccess = vi.fn();
const loadFamilyPanel = vi.fn();

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ resolveAdminAccess: () => resolveAdminAccess() }));
vi.mock("@/lib/admin/audit", () => ({
  logAdminAccess: (params: unknown) => logAdminAccess(params),
}));
vi.mock("@/lib/admin/family", () => ({
  loadFamilyPanel: (userId: string) => loadFamilyPanel(userId),
}));

const { GET } = await import("./route");

const ID = "00000000-0000-4000-8000-0000000000AA";
const ADMIN = { kind: "admin", ctx: { userId: "admin-1", email: "ops@example.com", role: "support" } };
const PANEL = { header: {}, meal: {}, workout: {}, household: [] };

const get = (userId: string) =>
  GET(new Request(`https://admin.test/api/admin/families/${userId}`), {
    params: Promise.resolve({ userId }),
  });

beforeEach(() => {
  resolveAdminAccess.mockReset().mockResolvedValue(ADMIN);
  logAdminAccess.mockReset().mockResolvedValue(undefined);
  loadFamilyPanel.mockReset().mockResolvedValue(PANEL);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/admin/families/:id (the side panel)", () => {
  it("answers an admin with the family, uncached, and records the panel view", async () => {
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual(PANEL);
    expect(loadFamilyPanel).toHaveBeenCalledWith(ID.toLowerCase());
    expect(logAdminAccess).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      subscriberId: ID.toLowerCase(),
      action: "view_subscriber_detail",
      detail: { surface: "panel" },
    });
  });

  it("gives anyone but an admin a bare 404 that says nothing — whatever the id", async () => {
    resolveAdminAccess.mockResolvedValue({ kind: "none" });
    for (const userId of [ID, "not-a-uuid"]) {
      const res = await get(userId);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(PANEL_NOT_FOUND);
    }
    expect(loadFamilyPanel).not.toHaveBeenCalled();
    expect(logAdminAccess).not.toHaveBeenCalled();
  });

  it("answers a failed admin lookup with a 503, never a 404", async () => {
    resolveAdminAccess.mockResolvedValue({ kind: "error" });
    const res = await get(ID);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual(PANEL_UNAVAILABLE);
    expect(loadFamilyPanel).not.toHaveBeenCalled();
    expect(logAdminAccess).not.toHaveBeenCalled();
  });

  it("marks the 404 only for an admin asking about a family that does not exist", async () => {
    loadFamilyPanel.mockResolvedValue(null);
    const gone = await get(ID);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual(PANEL_FAMILY_GONE);
    // A malformed id is a family that cannot exist: marked, and nothing read.
    loadFamilyPanel.mockClear();
    const malformed = await get("../../profiles");
    expect(malformed.status).toBe(404);
    expect(await malformed.json()).toEqual(PANEL_FAMILY_GONE);
    expect(loadFamilyPanel).not.toHaveBeenCalled();
  });

  it("answers a failed read with a 500 that leaks nothing", async () => {
    loadFamilyPanel.mockRejectedValue(new Error("admin load profiles: boom"));
    const res = await get(ID);
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
