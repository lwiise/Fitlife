import { describe, expect, it } from "vitest";
import { previousPageDelta } from "./previousPage";

/** A history as the Navigation API lists it: absolute URLs, oldest first. */
const history = (...paths: string[]) => paths.map((p) => `https://app.example.com${p}`);

/** The delta from the LAST entry of `paths`, which is the page being viewed. */
function backFrom(here: string, ...paths: string[]) {
  return previousPageDelta(history(...paths), paths.length - 1, here);
}

describe("previousPageDelta", () => {
  it("returns to the page the user came from, wherever that was", () => {
    expect(backFrom("/journey", "/plan", "/journey?member=abc")).toBe(-1);
    expect(backFrom("/subscription", "/dashboard", "/subscription")).toBe(-1);
    expect(backFrom("/subscription", "/plan", "/settings", "/subscription")).toBe(-1);
  });

  it("returns to a sibling the account menu came from", () => {
    expect(backFrom("/subscription", "/journey", "/subscription")).toBe(-1);
  });

  it("steps over entries that are this page again", () => {
    // Member chips on /journey.
    expect(backFrom("/journey", "/plan", "/journey", "/journey?member=a", "/journey?member=b")).toBe(-3);
    // The cancel flow's #change-plan link.
    expect(backFrom("/subscription", "/settings", "/subscription", "/subscription#change-plan")).toBe(-2);
  });

  it("never reopens the form a save came from", () => {
    // /family → /profile → /profile/health → save → /profile?edited=health.
    expect(
      backFrom("/profile", "/family", "/profile", "/profile/health", "/profile?edited=health"),
    ).toBe(-3);
  });

  it("does not mistake a longer path for a sub-page", () => {
    expect(backFrom("/profile", "/profile-archive", "/profile")).toBe(-1);
  });

  it("leaves the account area from the settings hub", () => {
    expect(backFrom("/settings", "/plan", "/settings")).toBe(-1);
    expect(backFrom("/settings", "/plan", "/settings", "/subscription", "/settings")).toBe(-3);
    expect(backFrom("/settings", "/dashboard", "/profile", "/profile/health", "/settings")).toBe(-3);
  });

  it("never bounces the hub back into a page it opened", () => {
    // Checkout returns to /subscription with nothing behind it; its «رجوع»
    // falls back to /settings. Back from there must not return to it.
    expect(backFrom("/settings", "/subscription?changed=success", "/settings")).toBeNull();
    expect(backFrom("/settings", "/journey", "/settings")).toBeNull();
  });

  it("has nothing to return to on a fresh tab or deep link", () => {
    expect(backFrom("/subscription", "/subscription")).toBeNull();
    expect(backFrom("/journey", "/journey", "/journey?member=a")).toBeNull();
  });

  it("stops at a sign-in page instead of going past it", () => {
    expect(backFrom("/settings", "/auth/login", "/settings")).toBeNull();
    expect(backFrom("/settings", "/dashboard", "/auth/login", "/settings")).toBeNull();
    expect(backFrom("/profile", "/dashboard", "/auth/login", "/profile", "/profile/personal", "/profile")).toBeNull();
  });

  it("gives up at an entry it cannot read", () => {
    const urls = ["https://app.example.com/plan", null, "https://app.example.com/journey"];
    expect(previousPageDelta(urls, 2, "/journey")).toBeNull();
    expect(previousPageDelta(["not a url", "https://app.example.com/journey"], 1, "/journey")).toBeNull();
  });

  it("looks only behind the current entry", () => {
    // Forward entries (after a back) are not the previous page.
    expect(previousPageDelta(history("/plan", "/journey", "/settings"), 1, "/journey")).toBe(-1);
  });

  it("is safe with an index outside the list", () => {
    expect(previousPageDelta(history("/plan"), -1, "/journey")).toBeNull();
    expect(previousPageDelta(history("/plan"), 5, "/journey")).toBeNull();
    expect(previousPageDelta([], 0, "/journey")).toBeNull();
  });
});
