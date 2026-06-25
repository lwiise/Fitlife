/**
 * Time-series reconstruction for the Overview chart (Kajabi-style spline). Pure
 * + dependency-light (no `server-only`, no DB) so it's unit-testable.
 *
 * HONESTY: subscriptions are a current snapshot (status + date columns, no event
 * history). So every period-over-period series is RECONSTRUCTED and approximated
 * from signup / trial-end / churn dates. A subscription's paying window is
 * [paidStart, churnEnd) where
 *   paidStart = trial_ends_at ?? created_at  (paid from trial end, else signup)
 *   churnEnd  = churnIsoOf(sub) ?? +∞        (best-available churn timestamp)
 * Tier/cadence are assumed constant at their current values, and trialing subs
 * are excluded from the paying metrics. The UI labels the chart approximate.
 * The AI-cost sum (computeAiCostInRange) is EXACT — real timestamps + cost.
 */

import { monthlyRevenueSar } from "@/lib/admin/revenue";
import { churnIsoOf, type SubLike } from "@/lib/admin/metrics";
import { inRange, trend, type DateRange, type Trend } from "@/lib/admin/period";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_BUCKETS = 372; // safety cap (e.g. a year of daily buckets)

export type RangePreset = "24h" | "7d" | "30d" | "90d" | "custom";
export type Granularity = "hour" | "day" | "week" | "month";

export interface Bucket {
  start: Date;
  end: Date;
  /** ISO timestamp of the bucket start (the x-axis anchor). */
  iso: string;
}

export interface ResolvedRange {
  range: DateRange;
  preset: RangePreset;
  interval: Granularity;
}

// ── Metric model ────────────────────────────────────────────────────────────

export type MetricKey =
  | "gross_revenue"
  | "mrr"
  | "active_subs"
  | "new_signups"
  | "trials"
  | "churned";

export type MetricKind = "stock" | "flow";
export type MetricUnit = "sar" | "count";

export const METRIC_POOL: MetricKey[] = [
  "gross_revenue",
  "mrr",
  "active_subs",
  "new_signups",
  "trials",
  "churned",
];
export const DEFAULT_METRICS: MetricKey[] = [
  "gross_revenue",
  "mrr",
  "active_subs",
  "new_signups",
];

const METRIC_META: Record<MetricKey, { kind: MetricKind; unit: MetricUnit }> = {
  gross_revenue: { kind: "flow", unit: "sar" },
  mrr: { kind: "stock", unit: "sar" },
  active_subs: { kind: "stock", unit: "count" },
  new_signups: { kind: "flow", unit: "count" },
  trials: { kind: "stock", unit: "count" },
  churned: { kind: "flow", unit: "count" },
};

export const metricKind = (k: MetricKey): MetricKind => METRIC_META[k].kind;
export const metricUnit = (k: MetricKey): MetricUnit => METRIC_META[k].unit;

const isMetric = (s: string): s is MetricKey => (METRIC_POOL as string[]).includes(s);

/** The single metric to plot (defaults to gross revenue). */
export function parseMetric(s: string | undefined): MetricKey {
  return s && isMetric(s) ? s : "gross_revenue";
}

/** The (≤4) metric tabs to show (defaults to the canonical four). */
export function parseMetrics(s: string | undefined): MetricKey[] {
  if (!s) return DEFAULT_METRICS;
  const picked = [...new Set(s.split(",").map((x) => x.trim()).filter(isMetric))].slice(0, 4);
  return picked.length > 0 ? picked : DEFAULT_METRICS;
}

// ── Range / buckets ───────────────────────────────────────────────────────────

function startOfUtcHour(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()));
}
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function parseYmd(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC `YYYY-MM-DD` (for <input type="date"> default values). */
export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const VALID_INTERVAL: Record<string, Granularity> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
};

function autoInterval(preset: RangePreset, spanMs: number): Granularity {
  if (preset === "24h") return "hour";
  const days = spanMs / DAY_MS;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/**
 * Resolve the selected window, preset, and x-axis interval from URL params.
 * Presets are trailing windows; `custom` adapts the interval to the span and
 * falls back to 30d on invalid input. `interval` overrides the auto choice.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string; interval?: string },
  now: Date,
): ResolvedRange {
  let preset: RangePreset;
  let range: DateRange;

  switch (params.range) {
    case "24h":
      preset = "24h";
      range = { start: new Date(now.getTime() - DAY_MS), end: now };
      break;
    case "7d":
      preset = "7d";
      range = { start: new Date(now.getTime() - 7 * DAY_MS), end: now };
      break;
    case "90d":
      preset = "90d";
      range = { start: new Date(now.getTime() - 90 * DAY_MS), end: now };
      break;
    case "custom": {
      const from = parseYmd(params.from);
      const to = parseYmd(params.to);
      if (from && to) {
        const end = new Date(Math.min(to.getTime() + DAY_MS, now.getTime()));
        if (from.getTime() < end.getTime()) {
          preset = "custom";
          range = { start: from, end };
          break;
        }
      }
      preset = "30d";
      range = { start: new Date(now.getTime() - 30 * DAY_MS), end: now };
      break;
    }
    default:
      preset = "30d";
      range = { start: new Date(now.getTime() - 30 * DAY_MS), end: now };
  }

  const spanMs = range.end.getTime() - range.start.getTime();
  const override = params.interval ? VALID_INTERVAL[params.interval] : undefined;
  let interval = override ?? autoInterval(preset, spanMs);
  // Guard against pathological bucket counts (hour only makes sense for ~a day).
  if (interval === "hour" && spanMs > 3 * DAY_MS) interval = "day";
  return { range, preset, interval };
}

/** The immediately-preceding equal-length window (for the comparison series). */
export function priorRangeOf(range: DateRange): DateRange {
  const dur = range.end.getTime() - range.start.getTime();
  return { start: new Date(range.start.getTime() - dur), end: new Date(range.start.getTime()) };
}

/** Split a range into contiguous buckets on UTC calendar boundaries. */
export function makeBuckets(range: DateRange, interval: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  const endMs = range.end.getTime();

  if (interval === "month") {
    let cur = startOfUtcMonth(range.start);
    while (cur.getTime() < endMs && buckets.length < MAX_BUCKETS) {
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      buckets.push({ start: cur, end: next, iso: cur.toISOString() });
      cur = next;
    }
    return buckets;
  }

  let curMs: number;
  let step: number;
  if (interval === "hour") {
    curMs = startOfUtcHour(range.start).getTime();
    step = HOUR_MS;
  } else if (interval === "week") {
    curMs = startOfUtcDay(range.start).getTime();
    step = 7 * DAY_MS;
  } else {
    curMs = startOfUtcDay(range.start).getTime();
    step = DAY_MS;
  }
  while (curMs < endMs && buckets.length < MAX_BUCKETS) {
    const start = new Date(curMs);
    buckets.push({ start, end: new Date(curMs + step), iso: start.toISOString() });
    curMs += step;
  }
  return buckets;
}

/** Shift buckets back by `deltaMs` (used to align the comparison series 1:1). */
export function shiftBuckets(buckets: Bucket[], deltaMs: number): Bucket[] {
  return buckets.map((b) => {
    const start = new Date(b.start.getTime() - deltaMs);
    return { start, end: new Date(b.end.getTime() - deltaMs), iso: start.toISOString() };
  });
}

// ── Per-subscription window tests (snapshot reconstruction) ────────────────────

function payingActiveAsOf(s: SubLike, asOfMs: number): boolean {
  if (s.status === "trialing" || !s.tier) return false;
  const paidStart = new Date(s.trial_ends_at ?? s.created_at).getTime();
  if (paidStart >= asOfMs) return false;
  const churnIso = churnIsoOf(s);
  const churnEnd = churnIso ? new Date(churnIso).getTime() : Number.POSITIVE_INFINITY;
  return churnEnd >= asOfMs;
}

function payingActiveInBucket(s: SubLike, b: Bucket): boolean {
  if (s.status === "trialing" || !s.tier) return false;
  const paidStart = new Date(s.trial_ends_at ?? s.created_at).getTime();
  const churnIso = churnIsoOf(s);
  const churnEnd = churnIso ? new Date(churnIso).getTime() : Number.POSITIVE_INFINITY;
  return paidStart < b.end.getTime() && churnEnd >= b.start.getTime();
}

function trialingAsOf(s: SubLike, asOfMs: number): boolean {
  if (s.status !== "trialing") return false;
  if (new Date(s.created_at).getTime() >= asOfMs) return false;
  const te = s.trial_ends_at ? new Date(s.trial_ends_at).getTime() : Number.POSITIVE_INFINITY;
  return te >= asOfMs;
}

/**
 * One metric's value per bucket. Stock metrics (mrr/active_subs/trials) are
 * point-in-time as-of the bucket end; flow metrics (gross_revenue/new_signups/
 * churned) are summed within the bucket. gross_revenue prorates monthly rate to
 * the bucket length.
 */
export function computeMetricSeries(
  metric: MetricKey,
  subs: SubLike[],
  profiles: Array<{ created_at: string }>,
  buckets: Bucket[],
): number[] {
  return buckets.map((b) => {
    const endMs = b.end.getTime();
    switch (metric) {
      case "mrr":
        return Math.round(
          subs.reduce(
            (sum, s) => sum + (payingActiveAsOf(s, endMs) ? monthlyRevenueSar(s.tier, s.cadence) : 0),
            0,
          ),
        );
      case "active_subs":
        return subs.reduce((n, s) => n + (payingActiveAsOf(s, endMs) ? 1 : 0), 0);
      case "trials":
        return subs.reduce((n, s) => n + (trialingAsOf(s, endMs) ? 1 : 0), 0);
      case "new_signups":
        return profiles.reduce((n, p) => n + (inRange(p.created_at, b) ? 1 : 0), 0);
      case "churned":
        return subs.reduce((n, s) => {
          const c = churnIsoOf(s);
          return n + (c && inRange(c, b) ? 1 : 0);
        }, 0);
      case "gross_revenue": {
        const bucketDays = (b.end.getTime() - b.start.getTime()) / DAY_MS;
        return Math.round(
          subs.reduce(
            (sum, s) =>
              sum +
              (payingActiveInBucket(s, b) ? monthlyRevenueSar(s.tier, s.cadence) * (bucketDays / 30) : 0),
            0,
          ),
        );
      }
    }
  });
}

/** Headline value for a metric tab: sum (flow) or last point (stock). */
export function headlineOf(series: number[], kind: MetricKind): number {
  if (kind === "flow") return series.reduce((a, b) => a + b, 0);
  return series.length > 0 ? (series[series.length - 1] ?? 0) : 0;
}

export interface MetricView {
  key: MetricKey;
  kind: MetricKind;
  unit: MetricUnit;
  /** Current-range headline (sum for flow, latest point for stock). */
  headline: number;
  /** Comparison-range headline (0 when comparison is off). */
  prior: number;
  /** % change current vs prior; pct is null when comparison is off. */
  delta: Trend;
  current: number[];
  comparison: number[];
}

export function computeMetricView(
  metric: MetricKey,
  subs: SubLike[],
  profiles: Array<{ created_at: string }>,
  curBuckets: Bucket[],
  priorBuckets: Bucket[],
  comparisonOn: boolean,
): MetricView {
  const kind = metricKind(metric);
  const current = computeMetricSeries(metric, subs, profiles, curBuckets);
  const comparison = comparisonOn ? computeMetricSeries(metric, subs, profiles, priorBuckets) : [];
  const headline = headlineOf(current, kind);
  const prior = comparisonOn ? headlineOf(comparison, kind) : 0;
  const delta: Trend = comparisonOn ? trend(headline, prior) : { pct: null, direction: "flat" };
  return { key: metric, kind, unit: metricUnit(metric), headline, prior, delta, current, comparison };
}

// ── AI-cost strip helpers (exact; unchanged) ───────────────────────────────────

/** Exact AI spend (USD) within the range: plan generations + chat messages. */
export function computeAiCostInRange(
  generations: Array<{ created_at: string; cost_usd: number | null }>,
  chats: Array<{ created_at: string; cost_usd: number | null }>,
  range: DateRange,
): number {
  let total = 0;
  for (const g of generations) if (inRange(g.created_at, range)) total += g.cost_usd ?? 0;
  for (const c of chats) if (inRange(c.created_at, range)) total += c.cost_usd ?? 0;
  return Math.round(total * 100) / 100;
}

/** Exact AI spend (USD) per bucket — same source as computeAiCostInRange, for
 * the cost-strip sparkline. A bucket is a DateRange, so reuse `inRange`. */
export function computeAiCostSeries(
  generations: Array<{ created_at: string; cost_usd: number | null }>,
  chats: Array<{ created_at: string; cost_usd: number | null }>,
  buckets: Bucket[],
): number[] {
  return buckets.map((b) => {
    let total = 0;
    for (const g of generations) if (inRange(g.created_at, b)) total += g.cost_usd ?? 0;
    for (const c of chats) if (inRange(c.created_at, b)) total += c.cost_usd ?? 0;
    return Math.round(total * 100) / 100;
  });
}

/**
 * Distinct user IDs with any AI activity (a plan generation or a chat message)
 * within the range. The set (not just the count) so callers can scope other
 * figures — e.g. the AI-cost-per-account average — to exactly the accounts that
 * incurred the cost.
 */
export function computeActiveUserIds(
  generations: Array<{ created_at: string; user_id: string }>,
  chats: Array<{ created_at: string; user_id: string }>,
  range: DateRange,
): Set<string> {
  const seen = new Set<string>();
  for (const g of generations) if (inRange(g.created_at, range)) seen.add(g.user_id);
  for (const c of chats) if (inRange(c.created_at, range)) seen.add(c.user_id);
  return seen;
}

/**
 * Count of distinct users with any AI activity in the range — the honest "active
 * users" engagement metric, separate from "active subscribers" (paying) and total
 * accounts.
 */
export function computeActiveUsersInRange(
  generations: Array<{ created_at: string; user_id: string }>,
  chats: Array<{ created_at: string; user_id: string }>,
  range: DateRange,
): number {
  return computeActiveUserIds(generations, chats, range).size;
}

/**
 * Total plan beneficiaries across all accounts, using the same definition as the
 * tier-limit logic (owner + non-housekeeper members): one owner per account plus
 * every non-housekeeper family member.
 */
export function computeBeneficiaryTotal(
  accountCount: number,
  members: Array<{ role: string }>,
): number {
  return accountCount + members.filter((m) => m.role !== "housekeeper").length;
}
