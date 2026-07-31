import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safeRedirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirectPath("/plan")).toBe("/plan");
    expect(safeRedirectPath("/plan?member=abc#top")).toBe("/plan?member=abc#top");
  });

  it("falls back when absent", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });

  // The open-redirect cases. Reached via a hand-crafted
  // /auth/login?redirect_to=… link: the victim sees our real domain and our
  // real login form, signs in successfully, and is then handed to the target —
  // which is what makes a follow-up "session expired, sign in again" credible.
  it("rejects absolute URLs", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("http://evil.example/x")).toBe("/dashboard");
  });

  it("rejects protocol-relative and backslash forms that leave the origin", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
  });

  it("rejects javascript: and other schemes", () => {
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirectPath("data:text/html,x")).toBe("/dashboard");
  });

  it("rejects EMBEDDED control characters used to smuggle a scheme", () => {
    expect(safeRedirectPath("/\u0020\u0000/evil")).toBe("/dashboard");
    expect(safeRedirectPath("/pl\u000Aan")).toBe("/dashboard");
  });

  it("trims surrounding whitespace rather than rejecting on it", () => {
    // A leading newline is stripped before validation, so this resolves to the
    // ordinary path "/plan" — safe, and worth pinning so a future tightening
    // does not start rejecting legitimate targets.
    expect(safeRedirectPath("\u000A/plan")).toBe("/plan");
    expect(safeRedirectPath("  /plan  ")).toBe("/plan");
  });

  it("honours an explicit fallback", () => {
    expect(safeRedirectPath("https://evil.example", "/pricing")).toBe("/pricing");
  });
});
