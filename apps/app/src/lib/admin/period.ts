/**
 * Period math for KPI "this period vs prior period" trends. Pure + dependency
 * free so it can be unit-tested without a server context.
 *
 * A period is a trailing window of `days` ending now; the prior period is the
 * equally-sized window immediately before it.
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PeriodPair {
  current: DateRange;
  prior: DateRange;
  days: number;
}

const DAY_MS = 86_400_000;

export function getPeriodPair(days = 30, now: Date = new Date()): PeriodPair {
  const end = now;
  const start = new Date(end.getTime() - days * DAY_MS);
  const priorEnd = start;
  const priorStart = new Date(start.getTime() - days * DAY_MS);
  return {
    current: { start, end },
    prior: { start: priorStart, end: priorEnd },
    days,
  };
}

/** Inclusive-start, exclusive-end membership test against an ISO timestamp. */
export function inRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

export interface Trend {
  /** Signed percentage change vs prior period; null when prior is 0 (n/a). */
  pct: number | null;
  direction: "up" | "down" | "flat";
}

/** Compare a current value to its prior-period value. */
export function trend(current: number, prior: number): Trend {
  if (current === prior) return { pct: prior === 0 ? null : 0, direction: "flat" };
  if (prior === 0) return { pct: null, direction: current > 0 ? "up" : "flat" };
  const pct = Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
  return { pct, direction: current > prior ? "up" : "down" };
}

// ── Month bucketing (shared by trends, cohorts, MRR movement) ─────────────────
// Lives here (a pure, server-free module) so cohorts.ts / insights.ts can reuse
// it without dragging in `server-only`.

/** One value at a month boundary — the unit of every monthly trend series. */
export interface MonthPoint {
  /** ISO timestamp of the first day of the month (UTC). */
  monthStart: string;
  value: number;
}

/** UTC year-month key, e.g. "2026-06". */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The trailing `n` months ending in `now`'s month, oldest first. */
export function lastMonths(
  n: number,
  now: Date,
): Array<{ key: string; monthStart: string }> {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out: Array<{ key: string; monthStart: string }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push({ key: monthKey(d), monthStart: d.toISOString() });
  }
  return out;
}

/**
 * Bucket timestamped items into `buckets` equal slices across a range — the
 * cheap per-KPI series behind a sparkline. Counts items by default; pass
 * `getValue` to sum a quantity instead (e.g. AI cost). Returns a fixed-length
 * number[] (length === buckets), zero-filled where there's no data.
 */
export function bucketSeries<T>(
  items: T[],
  range: DateRange,
  buckets: number,
  getIso: (t: T) => string | null | undefined,
  getValue?: (t: T) => number,
): number[] {
  const n = Math.max(1, buckets);
  const out = new Array<number>(n).fill(0);
  const startMs = range.start.getTime();
  const span = range.end.getTime() - startMs;
  if (span <= 0) return out;
  for (const it of items) {
    const iso = getIso(it);
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (t < startMs || t >= range.end.getTime()) continue;
    const idx = Math.min(n - 1, Math.floor(((t - startMs) / span) * n));
    out[idx] = (out[idx] ?? 0) + (getValue ? getValue(it) : 1);
  }
  return out;
}
