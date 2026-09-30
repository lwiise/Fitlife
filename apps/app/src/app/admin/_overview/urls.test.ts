import { describe, expect, it } from "vitest";
import { DEFAULT_METRICS, parseMetric, parseMetrics } from "@/lib/admin/timeseries";
import {
  METRIC_CAP,
  clampYmd,
  customPatch,
  expectedInterval,
  flattenParams,
  intervalsFor,
  isValidCustomRange,
  metricFromParam,
  metricParam,
  metricsParam,
  metricsPatch,
  overviewAuditDetail,
  paramOf,
  patchQuery,
  pickSettled,
  presetPatch,
  preservedFields,
  queryOf,
  toggleMetric,
  withParams,
  withPickedMetric,
} from "./urls";

describe("flattenParams", () => {
  it("keeps the first value of a repeated parameter and drops empties", () => {
    expect(flattenParams({ range: "7d", metric: ["mrr", "trials"], cmp: undefined })).toEqual({
      range: "7d",
      metric: "mrr",
    });
  });
});

describe("withParams", () => {
  it("sets, removes and keeps parameters", () => {
    expect(withParams("/admin", "range=7d&metric=mrr", { range: "90d" })).toBe(
      "/admin?range=90d&metric=mrr",
    );
    expect(withParams("/admin", "range=7d&metric=mrr", { range: null })).toBe("/admin?metric=mrr");
    expect(withParams("/admin", new URLSearchParams("cmp=off"), { interval: "week" })).toBe(
      "/admin?cmp=off&interval=week",
    );
  });
  it("returns the bare path when nothing is left", () => {
    expect(withParams("/admin", "range=7d", { range: null })).toBe("/admin");
    expect(withParams("/admin", "", { from: "" })).toBe("/admin");
  });
});

describe("patchQuery / queryOf / paramOf", () => {
  it("patches a query string the way withParams patches a URL", () => {
    expect(patchQuery("range=90d&metric=mrr", { interval: "month" })).toBe(
      "range=90d&metric=mrr&interval=month",
    );
    expect(patchQuery("metric=mrr", { metric: null })).toBe("");
  });
  it("reads the query back out of an href, fragment excluded", () => {
    expect(queryOf("/admin?range=90d&interval=month")).toBe("range=90d&interval=month");
    expect(queryOf("/admin")).toBe("");
    expect(queryOf("/admin?metric=mrr#chart")).toBe("metric=mrr");
  });
  it("stacks a second change on a first one still loading", () => {
    // «٩٠ يوم» is loading; «شهر» must keep it rather than fall back to 30 days.
    const loading = queryOf(withParams("/admin", "metric=mrr", presetPatch("90d", null)));
    expect(withParams("/admin", loading, { interval: "month" })).toBe(
      "/admin?metric=mrr&range=90d&interval=month",
    );
    // «٧ أيام» is loading; «٣٠ يوم» is a real change back, not a no-op.
    const seven = queryOf(withParams("/admin", "", presetPatch("7d", null)));
    expect(withParams("/admin", seven, presetPatch("30d", paramOf(seven, "interval")))).toBe("/admin");
    expect(paramOf("range=90d&interval=week", "interval")).toBe("week");
    expect(paramOf("", "interval")).toBeNull();
  });
});

describe("a tile's pick", () => {
  it("rides every link built while it waits for the URL", () => {
    // Picked mid-load: the next change must carry it, not the metric it replaced.
    expect(withPickedMetric("metric=mrr&range=90d", "active_subs")).toBe("metric=active_subs&range=90d");
    expect(withPickedMetric("range=90d", "trials")).toBe("range=90d&metric=trials");
    expect(withPickedMetric("metric=mrr&range=90d", "gross_revenue")).toBe("range=90d");
    expect(withPickedMetric("metric=mrr", null)).toBe("metric=mrr");
  });
  it("settles once the URL says the same, and is void once the page drops it", () => {
    const plotted = ["gross_revenue", "mrr", "active_subs"] as const;
    expect(pickSettled("active_subs", "metric=mrr&range=90d", plotted)).toBe(false);
    expect(pickSettled("active_subs", "range=90d&metric=active_subs", plotted)).toBe(true);
    expect(pickSettled("gross_revenue", "range=90d", plotted)).toBe(true);
    expect(pickSettled("trials", "metric=mrr", plotted)).toBe(true);
  });
});

describe("intervals", () => {
  it("offers hours only for 24 hours", () => {
    expect(intervalsFor("24h")).toEqual(["hour", "day"]);
    expect(intervalsFor("30d")).toEqual(["day", "week", "month"]);
    expect(intervalsFor("custom")).toEqual(["day", "week", "month"]);
  });
  it("predicts the interval the server resolves after a preset change", () => {
    expect(expectedInterval("24h", null)).toBe("hour");
    expect(expectedInterval("7d", null)).toBe("day");
    expect(expectedInterval("30d", null)).toBe("day");
    expect(expectedInterval("90d", null)).toBe("week");
    expect(expectedInterval("7d", "month")).toBe("month");
    expect(expectedInterval("24h", "day")).toBe("day");
    expect(expectedInterval("30d", "hour")).toBe("day");
    expect(expectedInterval("24h", "week")).toBe("hour");
  });
});

describe("presetPatch", () => {
  it("leaves 30 days out of the URL and drops the custom dates", () => {
    expect(presetPatch("30d", null)).toEqual({ range: null, from: null, to: null, interval: null });
    expect(presetPatch("7d", null)).toMatchObject({ range: "7d", from: null, to: null });
  });
  it("keeps an interval that still fits and drops one that does not", () => {
    expect(presetPatch("7d", "week").interval).toBe("week");
    expect(presetPatch("24h", "week").interval).toBeNull();
    expect(presetPatch("90d", "hour").interval).toBeNull();
    expect(presetPatch("24h", "hour").interval).toBe("hour");
  });
  it("produces the URLs the page has always used", () => {
    const current = "range=custom&from=2026-09-01&to=2026-09-10&metric=mrr";
    expect(withParams("/admin", current, presetPatch("30d", null))).toBe("/admin?metric=mrr");
    expect(withParams("/admin", current, presetPatch("90d", null))).toBe("/admin?range=90d&metric=mrr");
  });
});

describe("custom range", () => {
  it("accepts two dates in order (or the same day)", () => {
    expect(isValidCustomRange("2026-09-01", "2026-09-10")).toBe(true);
    expect(isValidCustomRange("2026-09-10", "2026-09-10")).toBe(true);
  });
  it("refuses reversed or malformed dates", () => {
    expect(isValidCustomRange("2026-09-10", "2026-09-01")).toBe(false);
    expect(isValidCustomRange("2026-9-1", "2026-09-10")).toBe(false);
    expect(isValidCustomRange("", "2026-09-10")).toBe(false);
    expect(isValidCustomRange("2026-13-45", "2026-12-01")).toBe(false);
  });
  it("treats a date past today as today", () => {
    expect(clampYmd("2026-10-15", "2026-09-30")).toBe("2026-09-30");
    expect(clampYmd("2026-09-01", "2026-09-30")).toBe("2026-09-01");
    expect(clampYmd("", "2026-09-30")).toBe("");
  });
  it("sets range=custom with both dates", () => {
    expect(withParams("/admin", "metric=trials&page=3", customPatch("2026-09-01", "2026-09-10"))).toBe(
      "/admin?metric=trials&range=custom&from=2026-09-01&to=2026-09-10",
    );
  });
  it("hands a GET form every other parameter", () => {
    expect(
      preservedFields("range=7d&from=a&to=b&metrics=mrr%2Ctrials&page=2", ["range", "from", "to", "page"]),
    ).toEqual([["metrics", "mrr,trials"]]);
  });
});

describe("metric parameters", () => {
  it("leaves gross revenue (the default) out of the URL", () => {
    expect(metricParam("gross_revenue")).toBeNull();
    expect(metricParam("churned")).toBe("churned");
  });
  it("reads the URL the way the server does", () => {
    for (const v of [null, "", "nope", "mrr", "churned"]) {
      expect(metricFromParam(v)).toBe(parseMetric(v ?? undefined));
    }
  });
  it("leaves the default set out of the URL, in order", () => {
    expect(metricsParam(DEFAULT_METRICS)).toBeNull();
    expect(metricsParam([])).toBeNull();
    const reordered = [...DEFAULT_METRICS].reverse();
    expect(metricsParam(reordered)).toBe(reordered.join(","));
    expect(parseMetrics(metricsParam(["trials", "mrr"]) ?? undefined)).toEqual(["trials", "mrr"]);
  });
});

describe("toggleMetric", () => {
  const four = [...DEFAULT_METRICS];

  it("refuses a fifth metric", () => {
    expect(four).toHaveLength(METRIC_CAP);
    expect(toggleMetric(four, "trials", "mrr")).toBeNull();
  });
  it("refuses to remove the last metric", () => {
    expect(toggleMetric(["mrr"], "mrr", "mrr")).toBeNull();
  });
  it("appends an added metric and keeps the selection", () => {
    expect(toggleMetric(["mrr", "trials"], "churned", "trials")).toEqual({
      shown: ["mrr", "trials", "churned"],
      selected: "trials",
    });
  });
  it("selects the first metric left when the selected one is removed", () => {
    const result = toggleMetric(four, "gross_revenue", "gross_revenue")!;
    expect(result).toEqual({ shown: ["mrr", "active_subs", "new_signups"], selected: "mrr" });
    expect(metricsPatch(result)).toEqual({ metrics: "mrr,active_subs,new_signups", metric: "mrr" });
  });
  it("round-trips back to the default URL", () => {
    const back = toggleMetric(["gross_revenue", "mrr", "active_subs"], "new_signups", "gross_revenue")!;
    expect(metricsPatch(back)).toEqual({ metrics: null, metric: null });
  });
});

describe("overviewAuditDetail", () => {
  it("records the raw parameters and the currency, nothing resolved", () => {
    expect(
      overviewAuditDetail({ metric: "mrr", range: "7d", interval: "day", other: "x" }, "usd"),
    ).toEqual({
      section: "overview",
      metric: "mrr",
      metrics: null,
      range: "7d",
      interval: "day",
      cmp: null,
      cur: "usd",
    });
  });
  it("clips values that come from the URL", () => {
    const long = "x".repeat(500);
    expect(overviewAuditDetail({ metrics: long }, "sar").metrics).toHaveLength(64);
  });
});
