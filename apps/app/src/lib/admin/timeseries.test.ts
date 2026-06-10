import { describe, expect, it } from "vitest";
import {
  computeAiCostInRange,
  computeBeneficiaryTotal,
  computeTierTimeSeries,
  makeBuckets,
  resolveRange,
  toYmd,
} from "./timeseries";
import type { SubLike } from "./metrics";

const NOW = new Date("2026-06-10T12:00:00.000Z");

function sub(partial: Partial<SubLike> & { user_id: string }): SubLike {
  return {
    status: "active",
    tier: "pro",
    cadence: "monthly",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trial_ends_at: null,
    current_period_end: null,
    cancelled_at: null,
    ...partial,
  };
}

describe("resolveRange", () => {
  it("defaults to a trailing-month window with weekly granularity", () => {
    const r = resolveRange({}, NOW);
    expect(r.preset).toBe("month");
    expect(r.granularity).toBe("week");
    expect(r.range.end).toEqual(NOW);
    expect(toYmd(r.range.start)).toBe("2026-05-11");
  });

  it("week preset → trailing 7d, daily", () => {
    const r = resolveRange({ range: "week" }, NOW);
    expect(r.preset).toBe("week");
    expect(r.granularity).toBe("day");
    expect(toYmd(r.range.start)).toBe("2026-06-03");
  });

  it("custom range adapts granularity to span and is inclusive of `to`", () => {
    const r = resolveRange({ range: "custom", from: "2026-06-01", to: "2026-06-07" }, NOW);
    expect(r.preset).toBe("custom");
    expect(r.granularity).toBe("day"); // 7d span ≤ 14d
    // `to` inclusive → end is the next midnight after Jun 7.
    expect(r.range.end.toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  it("custom over ~3 months → monthly granularity", () => {
    const r = resolveRange({ range: "custom", from: "2026-01-01", to: "2026-03-31" }, NOW);
    expect(r.granularity).toBe("month");
  });

  it("falls back to month on invalid custom input", () => {
    expect(resolveRange({ range: "custom", from: "nope", to: "" }, NOW).preset).toBe("month");
    // start after end → invalid → month
    expect(
      resolveRange({ range: "custom", from: "2026-06-09", to: "2026-06-01" }, NOW).preset,
    ).toBe("month");
  });

  it("caps a future `to` at now", () => {
    const r = resolveRange({ range: "custom", from: "2026-06-01", to: "2026-12-31" }, NOW);
    expect(r.range.end.getTime()).toBe(NOW.getTime());
  });
});

describe("makeBuckets", () => {
  it("daily buckets tile the range on UTC day boundaries", () => {
    const buckets = makeBuckets(
      { start: new Date("2026-06-03T12:00:00.000Z"), end: new Date("2026-06-06T00:00:00.000Z") },
      "day",
    );
    expect(buckets.map((b) => toYmd(b.start))).toEqual(["2026-06-03", "2026-06-04", "2026-06-05"]);
  });

  it("monthly buckets align to first-of-month", () => {
    const buckets = makeBuckets(
      { start: new Date("2026-01-15T00:00:00.000Z"), end: new Date("2026-03-10T00:00:00.000Z") },
      "month",
    );
    expect(buckets.map((b) => toYmd(b.start))).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });
});

describe("computeTierTimeSeries", () => {
  const buckets = makeBuckets(
    { start: new Date("2026-06-03T00:00:00.000Z"), end: new Date("2026-06-06T00:00:00.000Z") },
    "day",
  ); // 3 daily buckets: Jun 3, 4, 5

  it("counts a steadily-active sub in every bucket and sums tier revenue", () => {
    const { tiers, revenueByTier, countByTier } = computeTierTimeSeries(
      [sub({ user_id: "a", tier: "pro", created_at: "2026-01-01T00:00:00.000Z" })],
      buckets,
    );
    expect(tiers).toEqual(["pro"]);
    expect(countByTier.pro).toEqual([1, 1, 1]);
    expect(revenueByTier.pro).toEqual([59, 59, 59]); // pro monthly = 59 SAR
  });

  it("excludes trialing subs (paying base only)", () => {
    const { tiers } = computeTierTimeSeries(
      [sub({ user_id: "a", status: "trialing" })],
      buckets,
    );
    expect(tiers).toEqual([]);
  });

  it("drops a sub from buckets after it churns", () => {
    const { countByTier } = computeTierTimeSeries(
      [
        sub({
          user_id: "a",
          status: "cancelled",
          tier: "family",
          cancelled_at: "2026-06-04T12:00:00.000Z",
        }),
      ],
      buckets,
    );
    // active Jun 3 + Jun 4 (churn mid-day-4), gone Jun 5
    expect(countByTier.family).toEqual([1, 1, 0]);
  });

  it("starts a sub from trial_ends_at, not signup", () => {
    const { countByTier } = computeTierTimeSeries(
      [sub({ user_id: "a", tier: "starter", trial_ends_at: "2026-06-05T00:00:00.000Z" })],
      buckets,
    );
    // paid only from Jun 5
    expect(countByTier.starter).toEqual([0, 0, 1]);
  });

  it("stacks multiple tiers in canonical order", () => {
    const { tiers } = computeTierTimeSeries(
      [
        sub({ user_id: "a", tier: "premium" }),
        sub({ user_id: "b", tier: "starter" }),
        sub({ user_id: "c", tier: "family" }),
      ],
      buckets,
    );
    expect(tiers).toEqual(["starter", "family", "premium"]);
  });
});

describe("computeAiCostInRange", () => {
  const range = { start: new Date("2026-06-01T00:00:00.000Z"), end: new Date("2026-06-08T00:00:00.000Z") };

  it("sums generation + chat cost inside the range only", () => {
    const total = computeAiCostInRange(
      [
        { created_at: "2026-06-02T00:00:00.000Z", cost_usd: 0.5 },
        { created_at: "2026-05-30T00:00:00.000Z", cost_usd: 9 }, // before range
        { created_at: "2026-06-09T00:00:00.000Z", cost_usd: 9 }, // after range
      ],
      [{ created_at: "2026-06-03T00:00:00.000Z", cost_usd: 0.25 }],
      range,
    );
    expect(total).toBeCloseTo(0.75, 5);
  });

  it("treats null cost as zero", () => {
    expect(
      computeAiCostInRange([{ created_at: "2026-06-02T00:00:00.000Z", cost_usd: null }], [], range),
    ).toBe(0);
  });
});

describe("computeBeneficiaryTotal", () => {
  it("counts one owner per account plus non-housekeeper members", () => {
    const members = [
      { role: "daughter" },
      { role: "son" },
      { role: "housekeeper" }, // excluded
    ];
    expect(computeBeneficiaryTotal(3, members)).toBe(3 + 2);
  });
});
