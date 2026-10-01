import { describe, expect, it } from "vitest";
import {
  GEO,
  areaPath,
  axisMax,
  carryIndex,
  indexAt,
  labelIndices,
  niceMax,
  pct,
  physFrac,
  runningTotal,
  sparkGeometry,
  stepIndex,
  stepPath,
  timeFrac,
  valueFrac,
} from "./chartMath";

describe("runningTotal", () => {
  it("sums as it goes, so the last point is the range total", () => {
    expect(runningTotal([100, 0, 50])).toEqual([100, 100, 150]);
    expect(runningTotal([])).toEqual([]);
  });
  it("treats a non-finite value as zero", () => {
    expect(runningTotal([1, Number.NaN, 2])).toEqual([1, 1, 3]);
  });
});

describe("niceMax", () => {
  it("rounds counts up to a multiple of 4, at least 4", () => {
    expect(niceMax(0, true)).toBe(4);
    expect(niceMax(3.2, true)).toBe(4);
    expect(niceMax(6.36, true)).toBe(8);
    expect(niceMax(17, true)).toBe(20);
  });
  it("climbs the 1–1.2–1.6–2… ladder for amounts", () => {
    expect(niceMax(1063, false)).toBe(1200);
    expect(niceMax(1000, false)).toBe(1000);
    expect(niceMax(266.8, false)).toBe(300);
    expect(niceMax(0.35, false)).toBe(0.4);
    expect(niceMax(9.5, false)).toBe(10);
  });
  it("gives a usable axis for nothing at all", () => {
    expect(niceMax(0, false)).toBe(1);
    expect(niceMax(Number.NaN, false)).toBe(1);
    expect(niceMax(-5, true)).toBe(4);
  });
});

describe("axisMax", () => {
  it("leaves 6% headroom over the larger of both series", () => {
    expect(axisMax([944, 1003], [815], false)).toBe(1200);
    expect(axisMax([1, 2], [6], true)).toBe(8);
    expect(axisMax([0, 0], null, true)).toBe(4);
  });
});

describe("time and value positions", () => {
  it("runs time start → end and mirrors it for RTL", () => {
    expect(timeFrac(0, 5)).toBe(0);
    expect(timeFrac(4, 5)).toBe(1);
    expect(physFrac(0, 5, false)).toBe(0);
    expect(physFrac(0, 5, true)).toBe(1);
    expect(physFrac(4, 5, true)).toBe(0);
  });
  it("puts a lone point at the start edge", () => {
    expect(timeFrac(0, 1)).toBe(0);
    expect(physFrac(0, 1, true)).toBe(1);
  });
  it("clamps values into the axis", () => {
    expect(valueFrac(50, 100)).toBe(0.5);
    expect(valueFrac(150, 100)).toBe(1);
    expect(valueFrac(-3, 100)).toBe(0);
    expect(valueFrac(3, 0)).toBe(0);
  });
  it("writes SVG percentages", () => {
    expect(pct(0.425)).toBe("42.5%");
    expect(pct(1)).toBe("100%");
  });
});

describe("stepPath / areaPath", () => {
  it("draws a step-after line in GEO space (LTR)", () => {
    expect(stepPath([0, 10, 10], 20, false)).toBe("M0,1000 L500,1000 L500,500 L1000,500");
  });
  it("mirrors x for RTL", () => {
    expect(stepPath([0, 10, 10], 20, true)).toBe("M1000,1000 L500,1000 L500,500 L0,500");
  });
  it("closes the area down to the baseline", () => {
    expect(areaPath([0, 10], 20, false)).toBe(`M0,1000 L1000,1000 L1000,500 L1000,${GEO} L0,${GEO} Z`);
  });
  it("draws nothing it cannot", () => {
    expect(stepPath([], 10, false)).toBe("");
    expect(areaPath([5], 10, false)).toBe("");
    expect(stepPath([5], 10, false)).toBe("M0,500");
  });
});

describe("indexAt", () => {
  it("snaps a position along time to the nearest point", () => {
    expect(indexAt(0, 30)).toBe(0);
    expect(indexAt(1, 30)).toBe(29);
    expect(indexAt(0.49, 3)).toBe(1);
    expect(indexAt(0.24, 3)).toBe(0);
  });
  it("clamps outside the plot and survives bad input", () => {
    expect(indexAt(-0.3, 10)).toBe(0);
    expect(indexAt(1.7, 10)).toBe(9);
    expect(indexAt(Number.NaN, 10)).toBe(0);
    expect(indexAt(0.5, 1)).toBe(0);
  });
});

describe("carryIndex", () => {
  it("moves a reading to the same place in time when the series changes length", () => {
    // The finding: 90 days by day (91 points), the pointer near the newest
    // end, then 7 days (8 points) — the reading is the newest day, not an
    // index past the end.
    expect(carryIndex(88, 91, 8)).toBe(7);
    expect(carryIndex(0, 91, 8)).toBe(0);
    expect(carryIndex(45, 91, 31)).toBe(15);
    // And back to a longer series.
    expect(carryIndex(7, 8, 91)).toBe(90);
    expect(carryIndex(4, 8, 31)).toBe(17);
  });
  it("always names a point the new series has", () => {
    for (const [from, to] of [
      [91, 8],
      [8, 91],
      [25, 2],
      [31, 1],
    ] as const) {
      for (let i = 0; i < from; i++) {
        const j = carryIndex(i, from, to);
        expect(j).not.toBeNull();
        expect(j!).toBeGreaterThanOrEqual(0);
        expect(j!).toBeLessThan(to);
      }
    }
  });
  it("keeps a reading in place when the length is unchanged", () => {
    for (let i = 0; i < 31; i++) expect(carryIndex(i, 31, 31)).toBe(i);
  });
  it("keeps no reading as none, and has nowhere to carry one in an empty series", () => {
    expect(carryIndex(null, 91, 8)).toBeNull();
    expect(carryIndex(3, 8, 0)).toBeNull();
    expect(carryIndex(0, 1, 5)).toBe(0);
  });
});

describe("stepIndex", () => {
  it("follows the eye: ArrowRight goes forward in LTR, ArrowLeft in RTL", () => {
    expect(stepIndex(3, "ArrowRight", 10, false)).toBe(4);
    expect(stepIndex(3, "ArrowLeft", 10, false)).toBe(2);
    expect(stepIndex(3, "ArrowLeft", 10, true)).toBe(4);
    expect(stepIndex(3, "ArrowRight", 10, true)).toBe(2);
  });
  it("jumps with Home and End, and clamps at both ends", () => {
    expect(stepIndex(5, "Home", 10, false)).toBe(0);
    expect(stepIndex(5, "End", 10, true)).toBe(9);
    expect(stepIndex(9, "ArrowRight", 10, false)).toBe(9);
    expect(stepIndex(0, "ArrowRight", 10, true)).toBe(0);
  });
  it("starts from the newest point when none is active", () => {
    expect(stepIndex(null, "ArrowLeft", 10, false)).toBe(9);
    expect(stepIndex(null, "Home", 10, false)).toBe(0);
  });
  it("ignores other keys and empty charts", () => {
    expect(stepIndex(2, "ArrowUp", 10, false)).toBeNull();
    expect(stepIndex(2, "a", 10, false)).toBeNull();
    expect(stepIndex(null, "End", 0, false)).toBeNull();
  });
});

describe("labelIndices", () => {
  it("spaces about `target` labels, always first and last", () => {
    expect(labelIndices(30, 6)).toEqual([0, 5, 10, 15, 20, 25, 29]);
    expect(labelIndices(30, 3)).toEqual([0, 10, 20, 29]);
    expect(labelIndices(24, 6)).toEqual([0, 4, 8, 12, 16, 20, 23]);
    expect(labelIndices(7, 6)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it("drops a label that would crowd the last one", () => {
    expect(labelIndices(8, 3)).toEqual([0, 3, 7]);
  });
  it("handles tiny series", () => {
    expect(labelIndices(0, 6)).toEqual([]);
    expect(labelIndices(1, 6)).toEqual([0]);
    expect(labelIndices(2, 3)).toEqual([0, 1]);
  });
});

describe("sparkGeometry", () => {
  it("returns nothing for no values", () => {
    expect(sparkGeometry([], false)).toBeNull();
  });
  it("mirrors in RTL and ends on the last value", () => {
    const ltr = sparkGeometry([0, 4], false)!;
    const rtl = sparkGeometry([0, 4], true)!;
    expect(ltr.line.startsWith("M2,")).toBe(true);
    expect(rtl.line.startsWith("M86,")).toBe(true);
    expect(ltr.dot).toEqual([84, 3]);
    expect(rtl.dot).toEqual([4, 3]);
    expect(ltr.area.endsWith("Z")).toBe(true);
  });
  it("draws a flat baseline for all-zero data and no area for one point", () => {
    const flat = sparkGeometry([0, 0, 0], false)!;
    expect(flat.dot[1]).toBe(27);
    expect(sparkGeometry([5], false)!.area).toBe("");
  });
});
