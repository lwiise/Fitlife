import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
} from "@supabase/supabase-js";

/**
 * The admin check keeps "no access" and "could not tell" apart
 * (resolveAdminAccess), so a JSON route can answer a lapsed session with a
 * 404 and an outage with a 503; getAdminContext keeps its yes/no for pages.
 */

const getUser = vi.fn();
const adminRow = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: () => getUser() } }),
}));
vi.mock("@/lib/admin/db", () => ({
  adminDb: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => adminRow() }) }) }),
  }),
}));

const { getAdminContext, requireAdmin, resolveAdminAccess } = await import("./auth");

const USER = { id: "admin-1", email: "ops@example.com" };
const signedOut = (error: unknown) => ({ data: { user: null }, error });

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: USER }, error: null });
  adminRow.mockReset().mockResolvedValue({ data: { role: "support" }, error: null });
});

describe("resolveAdminAccess", () => {
  it("knows an admin", async () => {
    expect(await resolveAdminAccess()).toEqual({
      kind: "admin",
      ctx: { userId: "admin-1", email: "ops@example.com", role: "support" },
    });
    expect(await getAdminContext()).toEqual({
      userId: "admin-1",
      email: "ops@example.com",
      role: "support",
    });
  });

  it("reads no session, an ended one and a non-admin as no access", async () => {
    const cases = [
      () => getUser.mockResolvedValue(signedOut(new AuthSessionMissingError())),
      () => getUser.mockResolvedValue(signedOut(new AuthApiError("invalid JWT", 403, "bad_jwt"))),
      () => getUser.mockResolvedValue(signedOut(null)),
      () => adminRow.mockResolvedValue({ data: null, error: null }),
    ];
    for (const arrange of cases) {
      arrange();
      expect(await resolveAdminAccess()).toEqual({ kind: "none" });
      expect(await getAdminContext()).toBeNull();
      getUser.mockResolvedValue({ data: { user: USER }, error: null });
      adminRow.mockResolvedValue({ data: { role: "support" }, error: null });
    }
  });

  it("reads a lookup that failed as an error, not as lost access", async () => {
    const cases = [
      () => getUser.mockResolvedValue(signedOut(new AuthRetryableFetchError("fetch failed", 0))),
      () => getUser.mockResolvedValue(signedOut(new AuthRetryableFetchError("Bad Gateway", 502))),
      () => getUser.mockResolvedValue(signedOut(new AuthApiError("internal", 500, undefined))),
      () => getUser.mockResolvedValue(signedOut(new AuthUnknownError("bad JSON", null))),
      () => adminRow.mockResolvedValue({ data: null, error: { message: "connection refused" } }),
    ];
    for (const arrange of cases) {
      arrange();
      expect(await resolveAdminAccess()).toEqual({ kind: "error" });
      // Pages keep their yes/no: no admin context either way.
      expect(await getAdminContext()).toBeNull();
      getUser.mockResolvedValue({ data: { user: USER }, error: null });
      adminRow.mockResolvedValue({ data: { role: "support" }, error: null });
    }
  });

  it("requireAdmin sends anyone without an admin context to the login page", async () => {
    await expect(requireAdmin()).resolves.toMatchObject({ userId: "admin-1" });
    getUser.mockResolvedValue(signedOut(new AuthSessionMissingError()));
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });
});
