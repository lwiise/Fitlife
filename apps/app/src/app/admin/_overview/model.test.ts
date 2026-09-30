import { describe, expect, it } from "vitest";
import { fmtMetricValue } from "@/lib/admin/format";
import type { EngagementStats } from "@/lib/admin/engagement";
import type { MetricKey, MetricView, OverviewView } from "@/lib/admin/types";
import { OVERVIEW_STRINGS } from "@/lib/admin/strings/overview";
import {
  boardLabels,
  buildOverviewModel,
  deltaOf,
  engagementModel,
  fmtRangeDates,
  pointLabel,
  rangeLabels,
} from "./model";
import { fill, fmtDisplay, fmtTick, keepTogether, tickDigits, toDisplay } from "./display";

const NBSP = " ";

function mv(
  key: MetricKey,
  kind: "stock" | "flow",
  unit: "sar" | "count",
  current: number[],
  comparison: number[],
  pct: number | null,
  direction: "up" | "down" | "flat",
): MetricView {
  const head = (s: number[]) => (kind === "flow" ? s.reduce((a, b) => a + b, 0) : (s[s.length - 1] ?? 0));
  return {
    key,
    kind,
    unit,
    headline: head(current),
    prior: head(comparison),
    delta: { pct, direction },
    current,
    comparison,
  };
}

const BUCKETS = ["2026-09-27T00:00:00.000Z", "2026-09-28T00:00:00.000Z", "2026-09-29T00:00:00.000Z"];

function makeView(over: Partial<OverviewView> = {}): OverviewView {
  return {
    subscriberCount: 10,
    totalActive: 6,
    selectedMetric: "mrr",
    shownMetrics: ["gross_revenue", "mrr", "active_subs", "new_signups"],
    metrics: [
      mv("gross_revenue", "flow", "sar", [100, 0, 50], [60, 0, 60], 25, "up"),
      mv("mrr", "stock", "sar", [815, 874, 944], [700, 760, 815], 15.8, "up"),
      mv("active_subs", "stock", "count", [5, 6, 6], [4, 4, 5], 20, "up"),
      mv("new_signups", "flow", "count", [1, 0, 2], [1, 1, 1], 0, "flat"),
      mv("churned", "flow", "count", [0, 1, 1], [0, 0, 1], 100, "up"),
    ],
    preset: "30d",
    interval: "day",
    comparisonOn: true,
    rangeStartIso: "2026-08-31T09:00:00.000Z",
    rangeEndIso: "2026-09-30T09:00:00.000Z",
    priorStartIso: "2026-08-01T09:00:00.000Z",
    priorEndIso: "2026-08-31T09:00:00.000Z",
    fromValue: "2026-08-31",
    toValue: "2026-09-30",
    bucketIsos: BUCKETS,
    aiCostUsd: 38.03,
    aiCostPerAccountUsd: 4.7538,
    aiCostPerMemberUsd: 1.3,
    aiCostPerPlanUsd: 2.46,
    aiCostPerMemberPlanUsd: 0.52,
    aiPctOfRevenue: 12.5,
    beneficiaryTotal: 30,
    aiCostSeries: [10, 20, 8.03],
    aiCostPriorUsd: 30,
    aiCostDelta: { pct: 26.8, direction: "up" },
    activeUsersInRange: 8,
    approximated: true,
    ...over,
  };
}

const STATS: EngagementStats = {
  eventsAvailable: true,
  checkins7d: 94,
  activeCheckinHouseholds7d: 6,
  verdicts7d: 31,
  weighIns7d: 12,
  plansWithChangesPct: 64,
  paidTotal: 7,
  renewedOnce: 4,
};

const NOW = new Date("2026-09-30T09:00:00.000Z");

describe("buildOverviewModel — metrics", () => {
  it("orders the tiles as shown, then a selected metric that is not a tile", () => {
    const model = buildOverviewModel({
      view: makeView({ selectedMetric: "churned" }),
      engagement: STATS,
      locale: "en",
      currency: "sar",
      now: NOW,
    });
    expect(model.board.metrics.map((m) => m.key)).toEqual([
      "gross_revenue",
      "mrr",
      "active_subs",
      "new_signups",
      "churned",
    ]);
    expect(model.board.shown).toEqual(["gross_revenue", "mrr", "active_subs", "new_signups"]);
    expect(model.board.selected).toBe("churned");
  });

  it("plots flows as running totals whose last point is the headline", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "sar", now: NOW });
    const gross = model.board.metrics.find((m) => m.key === "gross_revenue")!;
    expect(gross.cur).toEqual([100, 100, 150]);
    expect(gross.pri).toEqual([60, 60, 120]);
    expect(gross.value).toBe(`SAR${NBSP}150`);
    expect(gross.subParts).toEqual(["Running total over the period", "Last 30 days"]);
    expect(gross.sub).toBe("Running total over the period · Last 30 days");
    const mrr = model.board.metrics.find((m) => m.key === "mrr")!;
    expect(mrr.cur).toEqual([815, 874, 944]);
    expect(mrr.sub).toBe("Level at the end of each day · Last 30 days");
  });

  it("carries a flow's per-bucket amounts beside its running total, and none for a stock", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "sar", now: NOW });
    const gross = model.board.metrics.find((m) => m.key === "gross_revenue")!;
    expect(gross.step).toEqual([100, 0, 50]);
    expect(model.board.metrics.find((m) => m.key === "new_signups")!.step).toEqual([1, 0, 2]);
    expect(model.board.metrics.find((m) => m.key === "mrr")!.step).toBeNull();
    expect(model.board.chart.stepLabel).toBe("That day");
    const usd = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "usd", now: NOW });
    expect(usd.board.metrics.find((m) => m.key === "gross_revenue")!.step).toEqual([27, 0, 13.5]);
    const weekly = buildOverviewModel({
      view: makeView({ interval: "week" }),
      engagement: STATS,
      locale: "ar",
      currency: "sar",
      now: NOW,
    });
    expect(weekly.board.chart.stepLabel).toBe("خلال الأسبوع");
  });

  it("states the prior value under each tile's change", () => {
    const en = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "sar", now: NOW });
    expect(en.board.metrics.find((m) => m.key === "mrr")!.vs).toBe(`vs SAR${NBSP}815`);
    expect(en.board.metrics.find((m) => m.key === "active_subs")!.vs).toBe("vs 5");
    const ar = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "ar", currency: "sar", now: NOW });
    const vs = ar.board.metrics.find((m) => m.key === "mrr")!.vs!;
    expect(vs.startsWith("مقابل ")).toBe(true);
    expect(vs).toMatch(/٨١٥/);
    expect(vs.slice("مقابل ".length)).not.toMatch(/ /);
  });

  it("converts revenue into the currency on screen once, so the end equals the headline", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "usd", now: NOW });
    const gross = model.board.metrics.find((m) => m.key === "gross_revenue")!;
    expect(gross.cur).toEqual([27, 27, 40.5]);
    expect(gross.value).toBe("$40.50");
    expect(fmtDisplay(gross.cur[gross.cur.length - 1]!, "sar", "usd", "en")).toBe(gross.value);
    // Counts never convert.
    const subs = model.board.metrics.find((m) => m.key === "active_subs")!;
    expect(subs.cur).toEqual([5, 6, 6]);
  });

  it("puts round, readable ticks on the axis", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "sar", now: NOW });
    const mrr = model.board.metrics.find((m) => m.key === "mrr")!;
    expect(mrr.yMax).toBe(1200);
    expect(mrr.ticks).toEqual(["0", "300", "600", "900", "1,200"]);
    const subs = model.board.metrics.find((m) => m.key === "active_subs")!;
    expect(subs.yMax).toBe(8);
    expect(subs.ticks).toEqual(["0", "2", "4", "6", "8"]);
  });

  it("colours each change by what is good for the business", () => {
    const model = buildOverviewModel({
      view: makeView({ selectedMetric: "churned" }),
      engagement: STATS,
      locale: "en",
      currency: "sar",
      now: NOW,
    });
    const by = (k: MetricKey) => model.board.metrics.find((m) => m.key === k)!.delta!;
    expect(by("mrr")).toMatchObject({ tone: "good", dir: "up", text: "16%" });
    expect(by("churned")).toMatchObject({ tone: "bad", dir: "up" });
    expect(by("new_signups")).toMatchObject({ tone: "flat", dir: "flat", text: "0%" });
    expect(by("mrr").label).toBe(`up 16% vs the prior period (SAR${NBSP}815)`);
  });

  it("drops the prior series and the deltas when the comparison is off", () => {
    const view = makeView({
      comparisonOn: false,
      metrics: makeView().metrics.map((m) => ({ ...m, comparison: [], prior: 0, delta: { pct: null, direction: "flat" } })),
      aiCostDelta: { pct: null, direction: "flat" },
    });
    const model = buildOverviewModel({ view, engagement: STATS, locale: "en", currency: "sar", now: NOW });
    for (const m of model.board.metrics) {
      expect(m.pri).toBeNull();
      expect(m.delta).toBeNull();
      expect(m.vs).toBeNull();
    }
    expect(model.board.chart.priRange).toBeNull();
    expect(model.cost.total.delta).toBeNull();
  });

  it("formats in Arabic with Arabic-Indic digits and unbreakable money", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "ar", currency: "sar", now: NOW });
    const mrr = model.board.metrics.find((m) => m.key === "mrr")!;
    expect(mrr.value).toMatch(/٩٤٤/);
    expect(mrr.value).not.toMatch(/ /);
    expect(mrr.ticks[4]).toBe("١٬٢٠٠");
    // Beside an Arabic-Indic digit «·» reads as «٠»: Arabic text joins with its comma.
    expect(mrr.subParts).toEqual(["المستوى في نهاية كل يوم", "آخر ٣٠ يوم"]);
    expect(mrr.sub).toBe("المستوى في نهاية كل يوم، آخر ٣٠ يوم");
    expect(JSON.stringify(model)).not.toContain("·");
    expect(mrr.delta!.text).toMatch(/١٦/);
  });
});

describe("buildOverviewModel — chart meta and head", () => {
  it("labels every bucket and picks the axis labels for both widths", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "sar", now: NOW });
    const { chart } = model.board;
    expect(chart.n).toBe(3);
    expect(chart.points).toEqual(["Sun, Sep 27", "Mon, Sep 28", "Tue, Sep 29"]);
    expect(chart.xLabels).toEqual([
      { i: 0, text: "Sep 27", wide: true, narrow: true, tiny: true },
      { i: 1, text: "Sep 28", wide: true, narrow: true, tiny: false },
      { i: 2, text: "Sep 29", wide: true, narrow: true, tiny: true },
    ]);
    expect(chart.curRange).toBe("Aug 31 – Sep 30");
    expect(chart.priRange).toBe("Aug 1 – Aug 31");
  });

  it("describes a custom range by its dates", () => {
    const view = makeView({
      preset: "custom",
      rangeStartIso: "2026-09-02T00:00:00.000Z",
      rangeEndIso: "2026-09-30T00:00:00.000Z",
    });
    const model = buildOverviewModel({ view, engagement: STATS, locale: "en", currency: "sar", now: NOW });
    expect(model.rangeText).toBe("Sep 2 – Sep 29");
    expect(model.head.customText).toBe("Custom: Sep 2 – Sep 29");
    expect(model.cost.range).toBe("Sep 2 – Sep 29");
  });

  it("labels hour buckets in Riyadh time — each UTC hour is exactly one Riyadh hour", () => {
    const view = makeView({
      preset: "24h",
      interval: "hour",
      bucketIsos: ["2026-09-29T09:00:00.000Z", "2026-09-29T10:00:00.000Z", "2026-09-29T11:00:00.000Z"],
      // A window that crosses midnight in Riyadh (UTC+3) but not in UTC.
      rangeStartIso: "2026-09-28T22:30:00.000Z",
      rangeEndIso: "2026-09-29T22:30:00.000Z",
      priorStartIso: "2026-09-27T22:30:00.000Z",
      priorEndIso: "2026-09-28T22:30:00.000Z",
    });
    const en = buildOverviewModel({ view, engagement: STATS, locale: "en", currency: "sar", now: NOW });
    expect(en.board.chart.xLabels.map((l) => l.text)).toEqual(["12 PM", "1 PM", "2 PM"]);
    expect(en.board.chart.points[0]).toBe("Sep 29, 12 PM");
    expect(en.board.chart.curRange).toBe("Sep 29 – Sep 30");
    expect(en.board.chart.priRange).toBe("Sep 28 – Sep 29");
    expect(en.board.chart.stepLabel).toBe("That hour");
    const ar = buildOverviewModel({ view, engagement: STATS, locale: "ar", currency: "sar", now: NOW });
    expect(ar.board.chart.xLabels[0]!.text).toBe("١٢ م");
    // Day buckets stay on UTC calendar days, like the rest of the console.
    const daily = buildOverviewModel({
      view: { ...view, interval: "day", bucketIsos: ["2026-09-28T00:00:00.000Z", "2026-09-29T00:00:00.000Z"] },
      engagement: STATS,
      locale: "en",
      currency: "sar",
      now: NOW,
    });
    expect(daily.board.chart.xLabels.map((l) => l.text)).toEqual(["Sep 28", "Sep 29"]);
    expect(daily.board.chart.curRange).toBe("Sep 28 – Sep 29");
  });

  it("gives a range from an earlier year its year everywhere it is named", () => {
    const view = makeView({
      preset: "custom",
      rangeStartIso: "2025-03-01T00:00:00.000Z",
      rangeEndIso: "2025-04-01T00:00:00.000Z",
      priorStartIso: "2025-01-29T00:00:00.000Z",
      priorEndIso: "2025-03-01T00:00:00.000Z",
      bucketIsos: ["2025-03-01T00:00:00.000Z", "2025-03-02T00:00:00.000Z"],
    });
    const en = buildOverviewModel({ view, engagement: STATS, locale: "en", currency: "sar", now: NOW });
    expect(en.head.customText).toBe("Custom: Mar 1, 2025 – Mar 31, 2025");
    expect(en.cost.range).toBe("Mar 1, 2025 – Mar 31, 2025");
    expect(en.board.chart.curRange).toBe("Mar 1, 2025 – Mar 31, 2025");
    expect(en.board.chart.priRange).toBe("Jan 29, 2025 – Feb 28, 2025");
    expect(en.board.chart.points).toEqual(["Sat, Mar 1, 2025", "Sun, Mar 2, 2025"]);
    const ar = buildOverviewModel({ view, engagement: STATS, locale: "ar", currency: "sar", now: NOW });
    expect(ar.head.customText).toMatch(/٢٠٢٥/);
    expect(ar.board.chart.points[0]).toMatch(/٢٠٢٥/);
  });

  it("carries what the range row needs", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "sar", now: NOW });
    expect(model.head).toEqual({
      preset: "30d",
      interval: "day",
      fromValue: "2026-08-31",
      toValue: "2026-09-30",
      maxDate: "2026-09-30",
      customText: null,
      shown: ["gross_revenue", "mrr", "active_subs", "new_signups"],
    });
  });
});

describe("buildOverviewModel — AI cost", () => {
  it("formats the total, the averages and their hints", () => {
    const model = buildOverviewModel({ view: makeView(), engagement: STATS, locale: "en", currency: "usd", now: NOW });
    const { cost } = model;
    expect(cost.total.value).toBe("$38.03");
    expect(cost.total.delta).toMatchObject({ tone: "bad", dir: "up", text: "27%" });
    expect(cost.total.spark).toEqual([10, 20, 8.03]);
    expect(cost.tiles.map((t) => t.value)).toEqual(["$4.75", "$1.30", "$2.46", "$0.52"]);
    expect(cost.tiles[0]!.hint).toBe("Accounts that used AI: 8");
    expect(cost.notes).toEqual([
      "12.5% of revenue (est.)",
      "Averages cover the accounts that used AI in the period",
      "Billed in USD",
    ]);
  });

  it("says SAR is converted, and leaves out a share of revenue it cannot compute", () => {
    const model = buildOverviewModel({
      view: makeView({ aiPctOfRevenue: null, aiCostPerPlanUsd: null }),
      engagement: STATS,
      locale: "en",
      currency: "sar",
      now: NOW,
    });
    expect(model.cost.notes).toEqual([
      "Averages cover the accounts that used AI in the period",
      "Billed in USD, shown in SAR at the platform rate",
    ]);
    expect(model.cost.tiles[2]!.value).toBe("—");
  });
});

describe("engagementModel", () => {
  it("formats the six figures with their hints", () => {
    const e = engagementModel(STATS, "en");
    expect(e.tiles.map((t) => t.value)).toEqual(["94", "6", "31", "12", "64%", "4/7"]);
    expect(e.tiles.filter((t) => t.hint).map((t) => t.key)).toEqual(["changes", "renewal"]);
    expect(e.missing).toBeNull();
    expect(e.unavailable).toBeNull();
  });
  it("flags missing tables with the migration number kept as a code", () => {
    const e = engagementModel({ ...STATS, eventsAvailable: false }, "ar");
    expect(e.missing).toEqual({ before: "الجداول غير مفعّلة — يلزم تطبيق ", code: "00017", after: "" });
  });
  it("shows dashes when there is nothing to divide or no data at all", () => {
    const empty = engagementModel({ ...STATS, paidTotal: 0, renewedOnce: 0, plansWithChangesPct: null }, "en");
    expect(empty.tiles.find((t) => t.key === "renewal")!.value).toBe("—");
    expect(empty.tiles.find((t) => t.key === "changes")!.value).toBe("—");
    const failed = engagementModel(null, "en");
    expect(failed.tiles.every((t) => t.value === "—")).toBe(true);
    expect(failed.unavailable).toBeTruthy();
  });
});

describe("deltaOf", () => {
  it("reads a rise from nothing as «from zero», toned by polarity", () => {
    expect(deltaOf({ pct: null, direction: "up" }, 1, "0", "en")).toMatchObject({
      tone: "good",
      dir: "up",
      text: "from zero",
    });
    expect(deltaOf({ pct: null, direction: "up" }, -1, "0", "ar")).toMatchObject({
      tone: "bad",
      text: "من الصفر",
    });
  });
  it("treats changes under half a percent as flat", () => {
    expect(deltaOf({ pct: 0.4, direction: "up" }, 1, "x", "en")).toMatchObject({ tone: "flat", dir: "flat" });
    expect(deltaOf({ pct: -12, direction: "down" }, 1, "x", "en")).toMatchObject({
      tone: "bad",
      dir: "down",
      text: "12%",
    });
    expect(deltaOf({ pct: -12, direction: "down" }, -1, "x", "en").tone).toBe("good");
  });
});

describe("dates", () => {
  it("shows the last included day of an exclusive range, with years only when needed", () => {
    const now = { now: NOW };
    expect(fmtRangeDates("2026-09-01T00:00:00Z", "2026-09-11T00:00:00Z", "en", now)).toBe("Sep 1 – Sep 10");
    expect(fmtRangeDates("2025-12-20T00:00:00Z", "2026-01-05T00:00:00Z", "en", now)).toBe(
      "Dec 20, 2025 – Jan 4, 2026",
    );
    // Wholly in an earlier year: it must not read as this year's March.
    expect(fmtRangeDates("2025-03-01T00:00:00Z", "2025-04-01T00:00:00Z", "en", now)).toBe(
      "Mar 1, 2025 – Mar 31, 2025",
    );
    expect(
      fmtRangeDates("2025-03-01T00:00:00Z", "2025-04-01T00:00:00Z", "en", {
        now: new Date("2025-06-01T00:00:00Z"),
      }),
    ).toBe("Mar 1 – Mar 31");
    expect(fmtRangeDates("bad", "2026-01-05T00:00:00Z", "en", now)).toBe("—");
  });
  it("reads the dates in the zone it is given", () => {
    const [a, b] = ["2026-09-28T22:30:00Z", "2026-09-29T22:30:00Z"];
    expect(fmtRangeDates(a, b, "en", { now: NOW })).toBe("Sep 28 – Sep 29");
    expect(fmtRangeDates(a, b, "en", { now: NOW, timeZone: "Asia/Riyadh" })).toBe("Sep 29 – Sep 30");
  });
  it("gives the tooltip a fuller label per interval", () => {
    const iso = "2026-09-28T14:00:00.000Z";
    expect(pointLabel(iso, "day", "en", NOW)).toBe("Mon, Sep 28");
    expect(pointLabel(iso, "week", "en", NOW)).toBe("Week of Sep 28");
    expect(pointLabel(iso, "month", "en", NOW)).toBe("September 2026");
    // 14:00 UTC is 5 PM in Riyadh.
    expect(pointLabel(iso, "hour", "en", NOW)).toBe("Sep 28, 5 PM");
    expect(pointLabel(iso, "week", "ar", NOW)).toMatch(/^أسبوع /);
  });
  it("adds the year to a day or week outside the current one", () => {
    const iso = "2025-03-02T00:00:00.000Z";
    expect(pointLabel(iso, "day", "en", NOW)).toBe("Sun, Mar 2, 2025");
    expect(pointLabel(iso, "week", "en", NOW)).toBe("Week of Mar 2, 2025");
    expect(pointLabel(iso, "day", "en")).toBe("Sun, Mar 2");
    // New Year's Eve 22:00 UTC is already 1 AM on 1 January in Riyadh.
    expect(pointLabel("2025-12-31T22:00:00.000Z", "hour", "en", NOW)).toBe("Jan 1, 1 AM");
  });
});

describe("display helpers", () => {
  it("formats display values exactly like fmtMetricValue", () => {
    for (const raw of [0, 59, 944, 12345]) {
      for (const locale of ["ar", "en"] as const) {
        for (const currency of ["sar", "usd"] as const) {
          expect(fmtDisplay(toDisplay(raw, "sar", currency), "sar", currency, locale)).toBe(
            keepTogether(fmtMetricValue(raw, "sar", locale, currency)),
          );
        }
        expect(fmtDisplay(raw, "count", "usd", locale)).toBe(fmtMetricValue(raw, "count", locale, "usd"));
      }
    }
  });
  it("keeps money in one piece", () => {
    expect(keepTogether("SAR 944")).toBe(`SAR${NBSP}944`);
  });
  it("fills placeholders and leaves unknown ones", () => {
    expect(fill("{a} and {b}", { a: "1" })).toBe("1 and {b}");
  });
  it("shows every quarter of the axis exactly", () => {
    expect(tickDigits(1200)).toBe(0);
    expect(tickDigits(30)).toBe(1);
    expect(tickDigits(0.3)).toBe(2);
    expect(fmtTick(7.5, 30, "en")).toBe("7.5");
    expect(fmtTick(250_000, 1_000_000, "en")).toBe("250K");
  });
});

describe("labels", () => {
  it("resolves every client label in both languages", () => {
    for (const locale of ["ar", "en"] as const) {
      const range = rangeLabels(locale);
      const board = boardLabels(locale);
      const all = [
        ...Object.values(range).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v))),
        ...Object.values(board),
      ];
      for (const s of all) expect(s.trim().length).toBeGreaterThan(0);
    }
  });
  it("keeps the overview strings on their prefix, without exclamation marks", () => {
    for (const [key, entry] of Object.entries(OVERVIEW_STRINGS)) {
      expect(key.startsWith("ov_")).toBe(true);
      for (const text of [entry.ar, entry.en]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/[!！]/);
      }
    }
  });
});
