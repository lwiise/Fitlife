import { describe, it, expect } from "vitest";
import { safeRedirectPath, DEFAULT_REDIRECT } from "./safeRedirect";

describe("safeRedirectPath", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/plan?view=workout")).toBe("/plan?view=workout");
    expect(safeRedirectPath("/family/edit/abc#section")).toBe(
      "/family/edit/abc#section",
    );
  });

  it("falls back when the value is missing", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath("")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects absolute URLs — the login form assigns this straight to window.location", () => {
    expect(safeRedirectPath("https://evil.example")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath("http://evil.example/relogin")).toBe(
      DEFAULT_REDIRECT,
    );
    expect(safeRedirectPath("javascript:alert(1)")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects protocol-relative and backslash forms", () => {
    expect(safeRedirectPath("//evil.example")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath("/\\evil.example")).toBe(DEFAULT_REDIRECT);
  });

  it("rejects the origin-concatenation escapes used against /auth/callback", () => {
    // `${origin}${value}` would have produced https://site.com@evil.example
    // and https://site.com.evil.example respectively.
    expect(safeRedirectPath("@evil.example")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath(".evil.example")).toBe(DEFAULT_REDIRECT);
  });

  it("honors an explicit fallback", () => {
    expect(safeRedirectPath("https://evil.example", "/plan")).toBe("/plan");
  });
});
