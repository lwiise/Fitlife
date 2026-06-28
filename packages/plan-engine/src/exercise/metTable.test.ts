import { describe, it, expect } from "vitest";
import { selectMet } from "./metTable";
import { MODALITIES } from "./types";
import type { IntensityBand, IntensityCeiling } from "./types";

describe("selectMet — ceiling gate", () => {
  it("drops a vigorous request to moderate for a capped member (can't bypass via tier)", () => {
    expect(selectMet("cycling", "vigorous", "light_moderate")).toBe(7.0); // never 9.5
  });

  it("allows vigorous when the ceiling permits it", () => {
    expect(selectMet("cycling", "vigorous", "can_progress_to_vigorous")).toBe(9.5);
  });

  it("keeps a moderate request as moderate under a light_moderate ceiling", () => {
    expect(selectMet("walking", "moderate", "light_moderate")).toBe(3.5);
  });

  it("falls back across a sparse row (yoga has light only)", () => {
    expect(selectMet("yoga", "moderate", "can_progress_to_vigorous")).toBe(2.5);
    expect(selectMet("yoga", "vigorous", "can_progress_to_vigorous")).toBe(2.5);
  });

  it("returns a finite MET for high_impact_aerobics under a light/moderate ceiling", () => {
    // Regression: high_impact_aerobics defines ONLY a `vigorous` MET. A light/moderate
    // ceiling clamps the request to moderate, which the row lacks — the old fallback
    // (`row.moderate ?? row.light!`) returned undefined → NaN kcal → a schema-parse crash
    // that failed the whole meal plan. It must now resolve to a finite number.
    const met = selectMet("high_impact_aerobics", "vigorous", "light_moderate");
    expect(Number.isFinite(met)).toBe(true);
    expect(met).toBeGreaterThan(0);
  });

  it("never returns a non-finite MET across every modality × band × ceiling", () => {
    const bands: IntensityBand[] = ["light", "moderate", "vigorous"];
    const ceilings: IntensityCeiling[] = ["light_moderate", "can_progress_to_vigorous"];
    for (const m of MODALITIES)
      for (const band of bands)
        for (const ceiling of ceilings) {
          const met = selectMet(m, band, ceiling);
          expect(Number.isFinite(met), `${m}/${band}/${ceiling}`).toBe(true);
          expect(met).toBeGreaterThan(0);
        }
  });
});
