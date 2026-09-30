/**
 * The overview's view model: OverviewView + EngagementStats turned into the
 * plain, JSON-safe, already-formatted shapes the components render.
 *
 * Built on the server (it reads the admin dictionary). Everything a first
 * paint shows is formatted here — tile values, deltas, axis ticks, x labels,
 * end labels, date ranges — so the server render and hydration always agree.
 * The client only formats numbers for the tooltip and the table, from the
 * display-unit series below.
 */

import {
  fmtBucketLabel,
  fmtMetricValue,
  fmtMoney,
  fmtNumber,
  fmtPct,
  fmtPctInt,
  type AdminLocale,
  type Currency,
} from "@/lib/admin/format";
import { intervalLabel, metricLabel, t, type AdminStringKey } from "@/lib/admin/i18n";
import { joinText } from "@/lib/admin/separators";
import { METRIC_POOL, type MetricUnit } from "@/lib/admin/timeseries";
import type { EngagementStats } from "@/lib/admin/engagement";
import type {
  Granularity,
  MetricKey,
  MetricView,
  OverviewView,
  RangePreset,
  Trend,
} from "@/lib/admin/types";
import { axisMax, labelIndices, runningTotal } from "./chartMath";
import { fill, fmtTick, keepTogether, toDisplay } from "./display";
import { PRESETS, type Preset } from "./urls";

/**
 * Locale tags for the dates formatted here. Arabic pins the Gregorian calendar
 * (as the family blocks do): a bare "ar-SA" is Gregorian in Node's ICU but Umm
 * al-Qura in Chromium, so pinning keeps these labels identical wherever they
 * are rendered. Digits stay Arabic-Indic.
 */
const TAG: Record<AdminLocale, string> = { ar: "ar-SA-u-ca-gregory", en: "en-US" };

/** Values longer than this get the smaller figure size (they would clip). */
const LONG_VALUE = 12;

// ── Shapes ────────────────────────────────────────────────────────────────

export type DeltaTone = "good" | "bad" | "flat";

export interface OvDelta {
  tone: DeltaTone;
  dir: "up" | "down" | "flat";
  /** What the pill shows: «١٦٪», «من الصفر». */
  text: string;
  /** The whole comparison, for the title and screen readers. */
  label: string;
}

export interface OvMetric {
  key: MetricKey;
  label: string;
  unit: MetricUnit;
  /** The headline: sum over the range (flows) or the latest level (stocks). */
  value: string;
  long: boolean;
  /** Null when the comparison is switched off (`cmp=off`). */
  delta: OvDelta | null;
  /** The prior value in words for the tile («مقابل ٨١٥ ر.س»); null without comparison. */
  vs: string | null;
  /** Plotted series in display units — running totals for flows. */
  cur: number[];
  /** A flow's own amount per bucket (display units) — what the running total
   * adds at each point. Null for a stock, whose plotted value is the level. */
  step: number[] | null;
  /** The prior window, aligned bucket-for-bucket; null without comparison. */
  pri: number[] | null;
  yMax: number;
  /** Five tick labels, baseline first. */
  ticks: string[];
  /** What the line plots and over which range — «Running total over the
   * period», «Last 30 days». The card draws a separator between the two. */
  subParts: string[];
  /** The same as one text, for the chart's accessible name: joined with
   * listSep («…، آخر ٣٠ يوم» — never «·», which beside an Arabic digit reads «٠»). */
  sub: string;
}

export interface OvXLabel {
  i: number;
  text: string;
  /** In the label set for a wide chart (about six labels). */
  wide: boolean;
  /** In the label set for a narrow chart (about three). */
  narrow: boolean;
  /** In the set for the narrowest phones: first, middle, last. */
  tiny: boolean;
}

export interface OvChartMeta {
  n: number;
  /** One full label per bucket (tooltip title, table date). */
  points: string[];
  /** Names a flow's per-bucket amount: «خلال اليوم», «خلال الأسبوع»… */
  stepLabel: string;
  xLabels: OvXLabel[];
  comparisonOn: boolean;
  curRange: string;
  priRange: string | null;
}

export interface OvBoard {
  selected: MetricKey;
  shown: MetricKey[];
  metrics: OvMetric[];
  chart: OvChartMeta;
}

export interface OvHead {
  preset: RangePreset;
  interval: Granularity;
  fromValue: string;
  toValue: string;
  /** Latest selectable date (UTC `YYYY-MM-DD`). */
  maxDate: string;
  /** «Custom: 2 Sep – 29 Sep» when the range is custom, else null. */
  customText: string | null;
  shown: MetricKey[];
}

export interface OvCostTile {
  key: "per_account" | "per_member" | "per_plan" | "per_member_plan";
  label: string;
  value: string;
  hint: string;
}

export interface OvCost {
  title: string;
  range: string;
  total: { label: string; value: string; long: boolean; delta: OvDelta | null; spark: number[] };
  tiles: OvCostTile[];
  /** The footnote's sentences (share of revenue, how averages are taken, the
   * currency) — drawn with a separator between them. */
  notes: string[];
}

export interface OvEngageTile {
  key: string;
  label: string;
  value: string;
  hint: string | null;
}

export interface OvEngagement {
  title: string;
  tiles: OvEngageTile[];
  /** The 00017 tables are missing — the figures are zeros, not activity. */
  missing: { before: string; code: string; after: string } | null;
  /** The stats could not be loaded at all. */
  unavailable: string | null;
}

export interface OverviewModel {
  head: OvHead;
  board: OvBoard;
  cost: OvCost;
  engagement: OvEngagement;
  /** The range in words, for section subtitles. */
  rangeText: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const PRESET_KEY: Record<Preset, AdminStringKey> = {
  "24h": "range_24h",
  "7d": "range_7d",
  "30d": "period_30",
  "90d": "period_90",
};

/** A preset's name («آخر ٣٠ يوم»). */
export function presetLabel(preset: Preset, locale: AdminLocale): string {
  return t(PRESET_KEY[preset], locale);
}

const LEVEL_KEY: Record<Granularity, AdminStringKey> = {
  hour: "ov_level_end_hour",
  day: "ov_level_end_day",
  week: "ov_level_end_week",
  month: "ov_level_end_month",
};

const STEP_KEY: Record<Granularity, AdminStringKey> = {
  hour: "ov_step_hour",
  day: "ov_step_day",
  week: "ov_step_week",
  month: "ov_step_month",
};

function isPreset(p: RangePreset): p is Preset {
  return (PRESETS as readonly string[]).includes(p);
}

/** The admin reads times in Riyadh, as the rail's clock and the family pages do. */
const RIYADH = "Asia/Riyadh";

/**
 * The time zone a bucket reads in. Hour buckets are UTC hours, and Riyadh is
 * UTC+3 all year (no daylight saving), so each one is exactly one Riyadh hour
 * and is labelled there — «٣ م» at 3 PM in Riyadh, not the UTC «١٢ م». Day,
 * week and month buckets are UTC calendar periods that do not line up with
 * Riyadh days, so they keep UTC labels (as fmtBucketLabel does).
 */
export function bucketZone(interval: Granularity): string {
  return interval === "hour" ? RIYADH : "UTC";
}

const FORMATS = new Map<string, Intl.DateTimeFormat>();

/**
 * A shared date formatter. Building one costs far more than using it, and a
 * long custom range labels hundreds of buckets; the keys are a handful of
 * option shapes × two locales × two zones, so the cache stays tiny.
 */
function dateFormat(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tag}|${JSON.stringify(options)}`;
  let format = FORMATS.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(tag, options);
    FORMATS.set(key, format);
  }
  return format;
}

function yearIn(ms: number, timeZone: string): number {
  return Number(dateFormat("en-US", { year: "numeric", timeZone }).format(new Date(ms)));
}

const isValidDate = (d: Date | undefined): d is Date => d != null && Number.isFinite(d.getTime());

function dayText(ms: number, withYear: boolean, locale: AdminLocale, timeZone: string): string {
  return dateFormat(TAG[locale], {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone,
  }).format(new Date(ms));
}

/**
 * «30 Aug – 28 Sep» for [startIso, endIso) — the end is exclusive, so the last
 * day shown is the one holding endIso − 1ms. Both ends carry the year when
 * they fall in different years, or in a year other than `now`'s, so a range
 * from an earlier year never reads as this year's.
 */
export function fmtRangeDates(
  startIso: string,
  endIso: string,
  locale: AdminLocale,
  { now, timeZone = "UTC" }: { now?: Date; timeZone?: string } = {},
): string {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso) - 1;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const end = Math.max(a, b);
  const startYear = yearIn(a, timeZone);
  const thisYear = isValidDate(now) ? yearIn(now.getTime(), timeZone) : startYear;
  const withYear = startYear !== yearIn(end, timeZone) || startYear !== thisYear;
  return `${dayText(a, withYear, locale, timeZone)} – ${dayText(end, withYear, locale, timeZone)}`;
}

/** The label a bucket gets in the tooltip and the table — fuller than the
 * axis: the day with its hour, the weekday, the week, the month with its year.
 * A day or week outside `now`'s year carries its year too. */
export function pointLabel(
  iso: string,
  interval: Granularity,
  locale: AdminLocale,
  now?: Date,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const timeZone = bucketZone(interval);
  const year =
    isValidDate(now) && yearIn(d.getTime(), timeZone) !== yearIn(now.getTime(), timeZone)
      ? { year: "numeric" as const }
      : {};
  const fmt = (o: Intl.DateTimeFormatOptions) => dateFormat(TAG[locale], { ...o, timeZone }).format(d);
  switch (interval) {
    case "hour":
      return fmt({ day: "numeric", month: "short", ...year, hour: "numeric" });
    case "day":
      return fmt({ weekday: "short", day: "numeric", month: "short", ...year });
    case "week":
      return fill(t("ov_week_of", locale), { date: fmt({ day: "numeric", month: "short", ...year }) });
    case "month":
      return fmt({ month: "long", year: "numeric" });
  }
}

/** An x-axis label: the hour in Riyadh for hour buckets (see bucketZone),
 * otherwise the console's UTC bucket label. */
export function axisLabel(
  iso: string | undefined,
  interval: Granularity,
  locale: AdminLocale,
): string {
  if (interval !== "hour") return fmtBucketLabel(iso, interval, locale);
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormat(TAG[locale], { hour: "numeric", timeZone: RIYADH }).format(d);
}

/**
 * A period-over-period change as a pill. `polarity` says which way is good:
 * +1 for revenue and signups, −1 for churn and AI cost. Changes under half a
 * percent read as flat; a rise from nothing reads «من الصفر» (no percentage
 * exists).
 */
export function deltaOf(
  trend: Trend,
  polarity: 1 | -1,
  priorText: string,
  locale: AdminLocale,
): OvDelta {
  const { pct, direction } = trend;
  const flat = direction === "flat" || (pct !== null && Math.abs(pct) < 0.5);
  const dir: OvDelta["dir"] = flat ? "flat" : direction;
  const good = (dir === "up" && polarity > 0) || (dir === "down" && polarity < 0);
  const tone: DeltaTone = dir === "flat" ? "flat" : good ? "good" : "bad";
  const text =
    pct === null
      ? direction === "up"
        ? t("ov_from_zero", locale)
        : fmtPctInt(0, locale)
      : fmtPctInt(Math.abs(pct), locale);
  const dirWord = t(dir === "up" ? "trend_up" : dir === "down" ? "trend_down" : "trend_flat", locale);
  return {
    tone,
    dir,
    text,
    label: fill(t("ov_delta_sr", locale), { dir: dirWord, pct: text, prior: priorText }),
  };
}

/** Rising churn is bad; every other metric is good when it rises. */
export function metricPolarity(key: MetricKey): 1 | -1 {
  return key === "churned" ? -1 : 1;
}

function metricModel(
  mv: MetricView,
  view: OverviewView,
  rangeText: string,
  locale: AdminLocale,
  currency: Currency,
): OvMetric {
  const flow = mv.kind === "flow";
  const display = (series: number[]) => series.map((v) => toDisplay(v, mv.unit, currency));
  const plot = (series: number[]) => display(flow ? runningTotal(series) : series);
  const cur = plot(mv.current);
  const pri = view.comparisonOn && mv.comparison.length > 0 ? plot(mv.comparison) : null;
  const yMax = axisMax(cur, pri, mv.unit === "count");
  const value = keepTogether(fmtMetricValue(mv.headline, mv.unit, locale, currency));
  const priorText = keepTogether(fmtMetricValue(mv.prior, mv.unit, locale, currency));
  const kind = flow ? t("ov_running_total", locale) : t(LEVEL_KEY[view.interval], locale);
  return {
    key: mv.key,
    label: metricLabel(mv.key, locale),
    unit: mv.unit,
    value,
    long: value.length > LONG_VALUE,
    delta: view.comparisonOn ? deltaOf(mv.delta, metricPolarity(mv.key), priorText, locale) : null,
    vs: view.comparisonOn ? fill(t("ov_vs_value", locale), { prior: priorText }) : null,
    cur,
    step: flow ? display(mv.current) : null,
    pri,
    yMax,
    ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => fmtTick(yMax * f, yMax, locale)),
    subParts: [kind, rangeText],
    sub: joinText([kind, rangeText], locale),
  };
}

function money(usd: number | null, currency: Currency, locale: AdminLocale, prec: number): string {
  return usd == null ? "—" : keepTogether(fmtMoney(usd, currency, locale, prec));
}

function costModel(view: OverviewView, rangeText: string, locale: AdminLocale, currency: Currency): OvCost {
  const total = money(view.aiCostUsd, currency, locale, 0);
  const prior = money(view.aiCostPriorUsd, currency, locale, 0);
  const notes = [
    view.aiPctOfRevenue != null
      ? fill(t("ov_cost_pct", locale), { pct: fmtPct(view.aiPctOfRevenue, locale) })
      : null,
    t("ov_cost_note_avg", locale),
    t(currency === "usd" ? "ov_cost_note_usd" : "ov_cost_note_sar", locale),
  ].filter((s): s is string => !!s);
  return {
    title: t("cost_efficiency", locale),
    range: rangeText,
    total: {
      label: t("stat_total_ai", locale),
      value: total,
      long: total.length > LONG_VALUE,
      // AI spend rising is bad.
      delta: view.comparisonOn ? deltaOf(view.aiCostDelta, -1, prior, locale) : null,
      spark: view.aiCostSeries,
    },
    tiles: [
      {
        key: "per_account",
        label: t("ai_cost_per_account", locale),
        value: money(view.aiCostPerAccountUsd, currency, locale, 2),
        hint: fill(t("ov_hint_per_account", locale), {
          n: fmtNumber(view.activeUsersInRange, locale),
        }),
      },
      {
        key: "per_member",
        label: t("ai_cost_per_member", locale),
        value: money(view.aiCostPerMemberUsd, currency, locale, 2),
        hint: t("ov_hint_per_member", locale),
      },
      {
        key: "per_plan",
        label: t("ai_cost_per_plan", locale),
        value: money(view.aiCostPerPlanUsd, currency, locale, 2),
        hint: t("ov_hint_per_plan", locale),
      },
      {
        key: "per_member_plan",
        label: t("ai_cost_per_member_plan", locale),
        value: money(view.aiCostPerMemberPlanUsd, currency, locale, 2),
        hint: t("ov_hint_per_member_plan", locale),
      },
    ],
    notes,
  };
}

const MIGRATION = "00017";

/** Engagement tiles; `stats` null = the stats failed to load. */
export function engagementModel(stats: EngagementStats | null, locale: AdminLocale): OvEngagement {
  const n = (v: number | undefined) => (stats ? fmtNumber(v ?? 0, locale) : "—");
  const changes =
    stats && stats.plansWithChangesPct !== null ? fmtPctInt(stats.plansWithChangesPct, locale) : "—";
  const renewal =
    stats && stats.paidTotal > 0
      ? `${fmtNumber(stats.renewedOnce, locale)}/${fmtNumber(stats.paidTotal, locale)}`
      : "—";
  const [before = "", after = ""] = t("ov_e_missing", locale).split("{code}");
  return {
    title: t("ov_engage_title", locale),
    tiles: [
      { key: "checkins", label: t("ov_e_checkins", locale), value: n(stats?.checkins7d), hint: null },
      {
        key: "households",
        label: t("ov_e_households", locale),
        value: n(stats?.activeCheckinHouseholds7d),
        hint: null,
      },
      { key: "verdicts", label: t("ov_e_verdicts", locale), value: n(stats?.verdicts7d), hint: null },
      { key: "weighins", label: t("ov_e_weighins", locale), value: n(stats?.weighIns7d), hint: null },
      { key: "changes", label: t("ov_e_changes", locale), value: changes, hint: t("ov_e_changes_h", locale) },
      { key: "renewal", label: t("ov_e_renewal", locale), value: renewal, hint: t("ov_e_renewal_h", locale) },
    ],
    missing: stats && !stats.eventsAvailable ? { before, code: MIGRATION, after } : null,
    unavailable: stats ? null : t("ov_e_unavailable", locale),
  };
}

function toYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Build the overview model. `now` sets the latest date the custom range may
 * pick and the year a date is read against (a date in another year carries
 * it); everything else comes from the view.
 */
export function buildOverviewModel({
  view,
  engagement,
  locale,
  currency,
  now = new Date(),
}: {
  view: OverviewView;
  engagement: EngagementStats | null;
  locale: AdminLocale;
  currency: Currency;
  now?: Date;
}): OverviewModel {
  const custom = !isPreset(view.preset);
  // A custom range is the calendar days the operator picked (UTC dates); a
  // preset window reads in the zone its buckets are labelled in.
  const dates = { now, timeZone: custom ? "UTC" : bucketZone(view.interval) };
  const curRange = fmtRangeDates(view.rangeStartIso, view.rangeEndIso, locale, dates);
  const priRange = view.comparisonOn
    ? fmtRangeDates(view.priorStartIso, view.priorEndIso, locale, dates)
    : null;
  const rangeText = custom ? curRange : presetLabel(view.preset as Preset, locale);

  const byKey = new Map(view.metrics.map((m) => [m.key, m]));
  // Tiles in display order, then the selected metric if it is not a tile.
  const order = [...view.shownMetrics, view.selectedMetric].filter(
    (k, i, all) => all.indexOf(k) === i && byKey.has(k),
  );
  const metrics = order.map((k) => metricModel(byKey.get(k)!, view, rangeText, locale, currency));

  const n = view.bucketIsos.length;
  const wide = new Set(labelIndices(n, 6));
  const narrow = new Set(labelIndices(n, 3));
  const tiny = new Set(labelIndices(n, 2));
  const xLabels: OvXLabel[] = [...new Set([...wide, ...narrow, ...tiny])]
    .sort((a, b) => a - b)
    .map((i) => ({
      i,
      text: axisLabel(view.bucketIsos[i], view.interval, locale),
      wide: wide.has(i),
      narrow: narrow.has(i),
      tiny: tiny.has(i),
    }));

  return {
    rangeText,
    head: {
      preset: view.preset,
      interval: view.interval,
      fromValue: view.fromValue,
      toValue: view.toValue,
      maxDate: toYmd(now.getTime()),
      customText: custom ? fill(t("ov_custom_active", locale), { range: curRange }) : null,
      shown: view.shownMetrics,
    },
    board: {
      selected: view.selectedMetric,
      shown: view.shownMetrics.filter((k) => byKey.has(k)),
      metrics,
      chart: {
        n,
        points: view.bucketIsos.map((iso) => pointLabel(iso, view.interval, locale, now)),
        stepLabel: t(STEP_KEY[view.interval], locale),
        xLabels,
        comparisonOn: view.comparisonOn,
        curRange,
        priRange,
      },
    },
    cost: costModel(view, rangeText, locale, currency),
    engagement: engagementModel(engagement, locale),
  };
}

// ── Labels for the client components ─────────────────────────────────────
// Resolved here so the client bundle carries plain strings, not the dictionary.

export interface RangeLabels {
  period: string;
  presets: Record<Preset, string>;
  custom: string;
  customTitle: string;
  from: string;
  to: string;
  apply: string;
  invalid: string;
  interval: string;
  intervals: Record<Granularity, string>;
  customize: string;
  customizeCap: string;
  customizeFull: string;
  customizeMin: string;
  metrics: Record<MetricKey, string>;
}

export function rangeLabels(locale: AdminLocale): RangeLabels {
  const metrics = {} as Record<MetricKey, string>;
  for (const k of METRIC_POOL) metrics[k] = metricLabel(k, locale);
  return {
    period: t("period_label", locale),
    presets: {
      "24h": presetLabel("24h", locale),
      "7d": presetLabel("7d", locale),
      "30d": presetLabel("30d", locale),
      "90d": presetLabel("90d", locale),
    },
    custom: t("range_custom", locale),
    customTitle: t("ov_custom_title", locale),
    from: t("date_from", locale),
    to: t("date_to", locale),
    apply: t("range_apply", locale),
    invalid: t("ov_custom_invalid", locale),
    interval: t("interval_label", locale),
    intervals: {
      hour: intervalLabel("hour", locale),
      day: intervalLabel("day", locale),
      week: intervalLabel("week", locale),
      month: intervalLabel("month", locale),
    },
    customize: t("customize_metrics", locale),
    customizeCap: t("ov_customize_cap", locale),
    customizeFull: t("ov_customize_full", locale),
    customizeMin: t("ov_customize_min", locale),
    metrics,
  };
}

export interface BoardLabels {
  kpiGroup: string;
  curPeriod: string;
  priorPeriod: string;
  asTable: string;
  asChart: string;
  colDate: string;
  approx: string;
  empty: string;
  keys: string;
  chartRole: string;
  /** Spoken when the keyboard reaches a point. Contains {date} and {values}. */
  pointSr: string;
  /** Joins the «label value» parts of {values}. */
  srSep: string;
}

export function boardLabels(locale: AdminLocale): BoardLabels {
  return {
    kpiGroup: t("kpi_strip_label", locale),
    curPeriod: t("ov_cur_period", locale),
    priorPeriod: t("ov_prior_period", locale),
    asTable: t("ov_as_table", locale),
    asChart: t("ov_as_chart", locale),
    colDate: t("ov_col_date", locale),
    approx: t("approx_snapshot", locale),
    empty: t("ov_chart_empty", locale),
    keys: t("ov_chart_keys", locale),
    chartRole: t("ov_chart_role", locale),
    pointSr: t("ov_point_sr", locale),
    srSep: t("ov_sr_sep", locale),
  };
}
