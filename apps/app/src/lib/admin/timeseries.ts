/**
 * Time-series reconstruction for the Overview "Revenue & subscriptions by tier"
 * chart. Pure + dependency-light (no `server-only`, no DB) so it's unit-testable.
 *
 * HONESTY: subscriptions are a current snapshot (status + date columns, no event
 * history). So historical "active in bucket" is RECONSTRUCTED and approximated:
 * a subscription's paying window is [paidStart, churnEnd) where
 *   paidStart = trial_ends_at ?? created_at  (paid from trial end, else signup)
 *   churnEnd  = churnIsoOf(sub) ?? +∞        (best-available churn timestamp)
 * Tier and cadence are assumed constant at their current values, and trialing
 * subs are excluded (paying base only). The UI labels the chart as approximate.
 * The AI-cost sum (computeAiCostInRange) is EXACT — real timestamps + cost.
 */

import { monthlyRevenueSar } from "@/lib/admin/revenue";
import { churnIsoOf, type SubLike } from "@/lib/admin/metrics";
import { inRange, type DateRange } from "@/lib/admin/period";

const DAY_MS = 86_400_000;

export type RangePreset = "week" | "month" | "custom";
export type Granularity = "day" | "week" | "month";

export interface Bucket {
  start: Date;
  end: Date;
  /** ISO timestamp of the bucket start (the x-axis anchor). */
  iso: string;
}

export interface ResolvedRange {
  range: DateRange;
  preset: RangePreset;
  granularity: Granularity;
}

/** Canonical tier order so colours/legend stay stable across metrics & ranges. */
const TIER_ORDER = ["starter", "pro", "family", "premium"];

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

function granularityForSpan(ms: number): Granularity {
  const days = ms / DAY_MS;
  if (days <= 14) return "day";
  if (days <= 70) return "week";
  return "month";
}

/**
 * Resolve the selected window + x-axis granularity from URL params.
 * `week` → trailing 7d daily; `month` (default) → trailing 30d weekly; `custom`
 * adapts granularity to the span and falls back to `month` on invalid input.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  now: Date,
): ResolvedRange {
  if (params.range === "week") {
    return {
      range: { start: new Date(now.getTime() - 7 * DAY_MS), end: now },
      preset: "week",
      granularity: "day",
    };
  }

  if (params.range === "custom") {
    const from = parseYmd(params.from);
    const to = parseYmd(params.to);
    if (from && to) {
      // `to` is inclusive → exclusive end at the next midnight, capped at now.
      const end = new Date(Math.min(to.getTime() + DAY_MS, now.getTime()));
      if (from.getTime() < end.getTime()) {
        return {
          range: { start: from, end },
          preset: "custom",
          granularity: granularityForSpan(end.getTime() - from.getTime()),
        };
      }
    }
    // invalid custom range → fall through to the month default
  }

  return {
    range: { start: new Date(now.getTime() - 30 * DAY_MS), end: now },
    preset: "month",
    granularity: "week",
  };
}

/** Split a range into contiguous buckets on UTC calendar boundaries. */
export function makeBuckets(range: DateRange, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  const endMs = range.end.getTime();

  if (granularity === "month") {
    let cur = startOfUtcMonth(range.start);
    while (cur.getTime() < endMs) {
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      buckets.push({ start: cur, end: next, iso: cur.toISOString() });
      cur = next;
    }
    return buckets;
  }

  const step = (granularity === "week" ? 7 : 1) * DAY_MS;
  let curMs = startOfUtcDay(range.start).getTime();
  while (curMs < endMs) {
    const start = new Date(curMs);
    buckets.push({ start, end: new Date(curMs + step), iso: start.toISOString() });
    curMs += step;
  }
  return buckets;
}

export interface TierTimeSeries {
  /** Tiers with data, canonical order; drives legend + colour mapping. */
  tiers: string[];
  /** Per-tier monthly-rate SAR, one value per bucket. */
  revenueByTier: Record<string, number[]>;
  /** Per-tier active (paying) subscription count, one value per bucket. */
  countByTier: Record<string, number[]>;
}

/**
 * Reconstruct revenue (monthly-rate SAR) and active-paid count per tier across
 * the buckets. Trialing subs are excluded (paying base only); see file note on
 * the snapshot approximation.
 */
export function computeTierTimeSeries(
  subs: SubLike[],
  buckets: Bucket[],
): TierTimeSeries {
  const n = buckets.length;
  const revenueByTier: Record<string, number[]> = {};
  const countByTier: Record<string, number[]> = {};
  const seen = new Set<string>();

  for (const s of subs) {
    if (!s.tier || s.status === "trialing") continue;
    const mrr = monthlyRevenueSar(s.tier, s.cadence);
    if (mrr <= 0) continue; // unknown tier → no meaningful revenue/count

    const paidStart = new Date(s.trial_ends_at ?? s.created_at).getTime();
    const churnIso = churnIsoOf(s);
    const churnEnd = churnIso ? new Date(churnIso).getTime() : Number.POSITIVE_INFINITY;

    let rev = revenueByTier[s.tier];
    let cnt = countByTier[s.tier];
    if (!rev || !cnt) {
      rev = new Array<number>(n).fill(0);
      cnt = new Array<number>(n).fill(0);
      revenueByTier[s.tier] = rev;
      countByTier[s.tier] = cnt;
    }

    for (let i = 0; i < n; i++) {
      const b = buckets[i];
      if (!b) continue;
      // Paying during this bucket? (window overlaps [bucket.start, bucket.end))
      if (paidStart < b.end.getTime() && churnEnd >= b.start.getTime()) {
        rev[i] = (rev[i] ?? 0) + mrr;
        cnt[i] = (cnt[i] ?? 0) + 1;
        seen.add(s.tier);
      }
    }
  }

  const tiers = TIER_ORDER.filter((tier) => seen.has(tier));
  for (const tier of seen) if (!tiers.includes(tier)) tiers.push(tier);
  return { tiers, revenueByTier, countByTier };
}

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
