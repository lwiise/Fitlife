import { describe, expect, it } from "vitest";

import {
  computeChurnSeries,
  computeCohortMatrix,
  computeMrrMovement,
  mrrMovementForRange,
} from "./cohorts";
import type { SubLike } from "./metrics";

const NOW = new Date("2026-06-15T00:00:00.000Z");

function sub(p: Partial<SubLike> & { user_id: string }): SubLike {
  return {
    status: "active",
    tier: "family",
    cadence: "monthly",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trial_ends_at: null,
    current_period_end: null,
    cancelled_at: null,
    ...p,
  };
}

describe("mrrMovementForRange", () => {
  it("nets new active MRR against churned MRR in the range", () => {
    const range = {
      start: new Date("2026-06-01T00:00:00.000Z"),
      end: new Date("2026-07-01T00:00:00.000Z"),
    };
    const subs = [
      sub({ user_id: "a", status: "active", created_at: "2026-06-05T00:00:00.000Z", tier: "family" }),
      sub({
        user_id: "b",
        status: "cancelled",
        tier: "starter",
        cancelled_at: "2026-06-10T00:00:00.000Z",
      }),
    ];
    const m = mrrMovementForRange(subs, range);
    expect(m.newSar).toBe(129);
    expect(m.churnedSar).toBe(29);
    expect(m.netSar).toBe(100);
  });
});

describe("computeMrrMovement", () => {
  it("produces one point per month", () => {
    const points = computeMrrMovement([], 6, NOW);
    expect(points).toHaveLength(6);
    expect(points.every((p) => p.netSar === 0)).toBe(true);
  });
});

describe("computeChurnSeries", () => {
  it("computes gross and net-revenue churn against the current base", () => {
    const subs = [
      sub({
        user_id: "b",
        status: "cancelled",
        tier: "family",
        cancelled_at: "2026-06-10T00:00:00.000Z",
      }),
    ];
    const series = computeChurnSeries(
      subs,
      { activeCount: 10, activeMrrSar: 1290 },
      6,
      NOW,
    );
    const june = series[series.length - 1];
    expect(june?.grossPct).toBe(10); // 1 of 10
    expect(june?.netRevenuePct).toBe(10); // 129 of 1290
  });
});

describe("computeCohortMatrix", () => {
  it("builds a current-survival triangle (future cells null)", () => {
    const profiles = [
      { id: "p1", created_at: "2026-04-10T00:00:00.000Z" },
      { id: "p2", created_at: "2026-04-20T00:00:00.000Z" },
      { id: "p3", created_at: "2026-06-05T00:00:00.000Z" },
    ];
    const subs = [
      sub({ user_id: "p1", status: "active" }),
      sub({ user_id: "p2", status: "cancelled" }),
      sub({ user_id: "p3", status: "trialing" }),
    ];
    const matrix = computeCohortMatrix(profiles, subs, 3, NOW);
    // buckets: 2026-04 (age2), 2026-05 (age1), 2026-06 (age0)
    expect(matrix[0]?.size).toBe(2);
    expect(matrix[0]?.cells).toEqual([50, 50, 50]); // 1 of 2 survives, all observable
    expect(matrix[2]?.size).toBe(1);
    expect(matrix[2]?.cells).toEqual([100, null, null]); // newest cohort, future null
  });
});
