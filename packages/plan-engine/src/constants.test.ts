import { describe, it, expect } from "vitest";
import { dayConcurrency } from "./constants";

// WS1: small families (≤3 members in scope) now run a few days in parallel rather
// than strictly sequential. Each generateDay is independent and resyncSharedMeals
// is within-day, so out-of-order day completion is expected and safe.
describe("dayConcurrency", () => {
  it("parallelizes small families (>1) instead of running strictly sequential", () => {
    for (const members of [1, 2, 3]) {
      expect(dayConcurrency(members, false)).toBeGreaterThan(1);
      expect(dayConcurrency(members, true)).toBeGreaterThan(1);
    }
  });

  it("gives housekeeper (translation) households a slightly higher small-family cap", () => {
    expect(dayConcurrency(2, true)).toBeGreaterThanOrEqual(dayConcurrency(2, false));
  });

  it("keeps the large-family parallel caps", () => {
    expect(dayConcurrency(4, false)).toBe(4);
    expect(dayConcurrency(6, true)).toBe(5);
  });

  it("returns a bounded, finite concurrency for every realistic household size", () => {
    for (let members = 1; members <= 6; members++) {
      for (const hasTranslation of [false, true]) {
        const c = dayConcurrency(members, hasTranslation);
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(5);
      }
    }
  });
});
