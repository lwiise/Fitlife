import { describe, expect, it } from "vitest";
import {
  computeAiCostInRange,
  computeBeneficiaryTotal,
  computeMetricSeries,
  computeMetricView,
  headlineOf,
  makeBuckets,
  parseMetric,
  parseMetrics,
  priorRangeOf,
  resolveRange,
  shiftBuckets,
  toYmd,
  type Bucket,
} from "./timeseries";
import type { SubLike } from "./metrics";

const NOW = new Date("2026-06-10T12:00:00.000Z");

function sub(partial: Partial<SubLike> & { user_id: string }): SubLike {
  return {
    status: "active",
    tier: "pro", // monthly = 59 SAR
    cadence: "monthly",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trial_ends_at: null,
    current_period_end: null,
    cancelled_at: null,
    ...partial,
  };
}

function dayBucket(ymd: string): Bucket {
  const start = new Date(`${ymd}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000), iso: start.toISOString() };
}
// Three daily buckets: Jun 3, 4, 5 (each [day, day+1)).
const BUCKETS = [dayBucket("2026-06-03"), dayBucket("2026-06-04"), dayBucket("2026-06-05")];

describe("parseMetric / parseMetrics", () => {
  it("defaults and validates", () => {
    expect(parseMetric(undefined)).toBe("gross_revenue");
    expect(parseMetric("mrr")).toBe("mrr");
    expect(parseMetric("bogus")).toBe("gross_revenue");
  });
  it("parses the shown set, dedupes, caps at 4, drops junk", () => {
    expect(parseMetrics(undefined)).toEqual(["gross_revenue", "mrr", "active_subs", "new_signups"]);
    expect(parseMetrics("mrr,trials,mrr")).toEqual(["mrr", "trials"]);
    expect(parseMetrics("a,b,c,d,e,f,g")).toEqual(["gross_revenue", "mrr", "active_subs", "new_signups"]);
  });
});

describe("resolveRange", () => {
  it("defaults to 30d / day", () => {
    const r = resolveRange({}, NOW);
    expect(r.preset).toBe("30d");
    expect(r.interval).toBe("day");
  });
  it("24h → hour", () => {
    const r = resolveRange({ range: "24h" }, NOW);
    expect(r.preset).toBe("24h");
    expect(r.interval).toBe("hour");
  });
  it("90d auto → week", () => {
    expect(resolveRange({ range: "90d" }, NOW).interval).toBe("week");
  });
  it("interval override wins", () => {
    expect(resolveRange({ range: "30d", interval: "month" }, NOW).interval).toBe("month");
  });
  it("guards hour on a long span (falls back to day)", () => {
    expect(resolveRange({ range: "30d", interval: "hour" }, NOW).interval).toBe("day");
  });
  it("custom is inclusive of `to` and falls back to 30d when invalid", () => {
    const r = resolveRange({ range: "custom", from: "2026-06-01", to: "2026-06-07" }, NOW);
    expect(r.preset).toBe("custom");
    expect(r.range.end.toISOString()).toBe("2026-06-08T00:00:00.000Z");
    expect(resolveRange({ range: "custom", from: "x", to: "" }, NOW).preset).toBe("30d");
  });
});

describe("priorRangeOf / shiftBuckets", () => {
  it("prior range is the immediately-preceding equal window", () => {
    const range = { start: new Date("2026-06-03T00:00:00.000Z"), end: new Date("2026-06-06T00:00:00.000Z") };
    const prior = priorRangeOf(range);
    expect(toYmd(prior.start)).toBe("2026-05-31");
    expect(toYmd(prior.end)).toBe("2026-06-03");
  });
  it("shiftBuckets keeps count and shifts back", () => {
    const shifted = shiftBuckets(BUCKETS, 3 * 86_400_000);
    expect(shifted).toHaveLength(3);
    expect(toYmd(shifted[0]!.start)).toBe("2026-05-31");
  });
});

describe("makeBuckets", () => {
  it("hour buckets tile a short range", () => {
    const buckets = makeBuckets(
      { start: new Date("2026-06-10T09:30:00.000Z"), end: new Date("2026-06-10T12:00:00.000Z") },
      "hour",
    );
    expect(buckets.map((b) => b.start.getUTCHours())).toEqual([9, 10, 11]);
  });
  it("month buckets align to first-of-month", () => {
    const buckets = makeBuckets(
      { start: new Date("2026-01-15T00:00:00.000Z"), end: new Date("2026-03-10T00:00:00.000Z") },
      "month",
    );
    expect(buckets.map((b) => toYmd(b.start))).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });
});

describe("computeMetricSeries", () => {
  it("mrr (stock) = run-rate as-of each bucket end", () => {
    const subs = [sub({ user_id: "a", tier: "pro" })];
    expect(computeMetricSeries("mrr", subs, [], BUCKETS)).toEqual([59, 59, 59]);
  });
  it("active_subs (stock) counts the paying base", () => {
    expect(computeMetricSeries("active_subs", [sub({ user_id: "a" })], [], BUCKETS)).toEqual([1, 1, 1]);
  });
  it("excludes trialing subs from paying metrics", () => {
    const subs = [sub({ user_id: "a", status: "trialing" })];
    expect(computeMetricSeries("mrr", subs, [], BUCKETS)).toEqual([0, 0, 0]);
  });
  it("drops a churned sub from the stock after it churns", () => {
    const subs = [sub({ user_id: "a", status: "cancelled", cancelled_at: "2026-06-04T12:00:00.000Z" })];
    // active as-of Jun 4 end, gone by Jun 5 / Jun 6 ends
    expect(computeMetricSeries("active_subs", subs, [], BUCKETS)).toEqual([1, 0, 0]);
  });
  it("churned (flow) counts the churn in its bucket", () => {
    const subs = [sub({ user_id: "a", status: "cancelled", cancelled_at: "2026-06-04T12:00:00.000Z" })];
    expect(computeMetricSeries("churned", subs, [], BUCKETS)).toEqual([0, 1, 0]);
  });
  it("trials (stock) counts trialing as-of bucket end", () => {
    const subs = [
      sub({ user_id: "a", status: "trialing", created_at: "2026-06-01T00:00:00.000Z", trial_ends_at: "2026-06-05T06:00:00.000Z" }),
    ];
    // trialing through Jun 4 end + Jun 5 end (trial ends Jun 5 06:00 ≥ Jun 5 00:00), expired by Jun 6 end
    expect(computeMetricSeries("trials", subs, [], BUCKETS)).toEqual([1, 1, 0]);
  });
  it("new_signups (flow) counts profiles created in the bucket", () => {
    const profiles = [{ created_at: "2026-06-04T08:00:00.000Z" }, { created_at: "2026-06-04T20:00:00.000Z" }];
    expect(computeMetricSeries("new_signups", [], profiles, BUCKETS)).toEqual([0, 2, 0]);
  });
  it("gross_revenue (flow) prorates the monthly rate to the bucket length", () => {
    // pro monthly 59 over a 1-day bucket ≈ round(59/30) = 2
    expect(computeMetricSeries("gross_revenue", [sub({ user_id: "a", tier: "pro" })], [], BUCKETS)).toEqual([2, 2, 2]);
  });
});

describe("headlineOf / computeMetricView", () => {
  it("flow headline sums, stock headline is the last point", () => {
    expect(headlineOf([1, 2, 3], "flow")).toBe(6);
    expect(headlineOf([5, 7, 9], "stock")).toBe(9);
  });
  it("delta compares current vs prior headline; null when comparison off", () => {
    const subs = [sub({ user_id: "a", tier: "pro" })];
    const prior = shiftBuckets(BUCKETS, 3 * 86_400_000);
    const on = computeMetricView("mrr", subs, [], BUCKETS, prior, true);
    expect(on.headline).toBe(59);
    expect(on.prior).toBe(59);
    expect(on.delta.pct).toBe(0);

    const off = computeMetricView("mrr", subs, [], BUCKETS, prior, false);
    expect(off.comparison).toEqual([]);
    expect(off.delta.pct).toBeNull();
  });
});

describe("computeAiCostInRange", () => {
  const range = { start: new Date("2026-06-01T00:00:00.000Z"), end: new Date("2026-06-08T00:00:00.000Z") };
  it("sums generation + chat cost inside the range only", () => {
    const total = computeAiCostInRange(
      [
        { created_at: "2026-06-02T00:00:00.000Z", cost_usd: 0.5 },
        { created_at: "2026-05-30T00:00:00.000Z", cost_usd: 9 },
        { created_at: "2026-06-09T00:00:00.000Z", cost_usd: 9 },
      ],
      [{ created_at: "2026-06-03T00:00:00.000Z", cost_usd: 0.25 }],
      range,
    );
    expect(total).toBeCloseTo(0.75, 5);
  });
});

describe("computeBeneficiaryTotal", () => {
  it("counts one owner per account plus non-housekeeper members", () => {
    expect(computeBeneficiaryTotal(3, [{ role: "daughter" }, { role: "son" }, { role: "housekeeper" }])).toBe(5);
  });
});
