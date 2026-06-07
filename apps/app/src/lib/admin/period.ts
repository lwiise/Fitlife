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
