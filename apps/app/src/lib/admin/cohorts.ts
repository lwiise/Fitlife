/**
 * Month-bucketed retention/movement approximations. Pure + testable.
 *
 * HONESTY: with no subscription event-history table, all three below are
 * SNAPSHOT approximations and the UI labels them so:
 *  - MRR movement: new/churned only — expansion/contraction need upgrade/
 *    downgrade events that don't exist, so they're 0/omitted.
 *  - Churn series: churned-in-month over the *current* active base (a stable
 *    proxy for "base at risk"), not the true start-of-month base.
 *  - Cohort matrix: a current-survival triangle (same value across observable
 *    ages) — it sharpens into real decay once status history accrues.
 */

import { monthlyRevenueSar } from "@/lib/admin/revenue";
import {
  inRange,
  lastMonths,
  monthKey,
  type DateRange,
} from "@/lib/admin/period";
import {
  churnIsoOf,
  isChurnedStatus,
  latestSubByUser,
  type SubLike,
} from "@/lib/admin/metrics";

function monthRange(monthStartIso: string): DateRange {
  const start = new Date(monthStartIso);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

// ── MRR movement (waterfall) ────────────────────────────────────────────────

export interface MrrMovementPoint {
  monthStart: string;
  /** MRR of subs created in-month that are currently active. */
  newSar: number;
  /** MRR (current tier) of subs that churned in-month. */
  churnedSar: number;
  netSar: number;
}

/** New − churned MRR over an arbitrary range (used by the overview hero too). */
export function mrrMovementForRange(
  currentSubs: SubLike[],
  range: DateRange,
): { newSar: number; churnedSar: number; netSar: number } {
  let newSar = 0;
  let churnedSar = 0;
  for (const s of currentSubs) {
    const mrr = monthlyRevenueSar(s.tier, s.cadence);
    if (s.status === "active" && inRange(s.created_at, range)) newSar += mrr;
    if (isChurnedStatus(s.status) && inRange(churnIsoOf(s), range)) churnedSar += mrr;
  }
  return { newSar, churnedSar, netSar: newSar - churnedSar };
}

export function computeMrrMovement(
  currentSubs: SubLike[],
  months = 6,
  now: Date = new Date(),
): MrrMovementPoint[] {
  return lastMonths(Math.max(1, months), now).map((b) => {
    const { newSar, churnedSar, netSar } = mrrMovementForRange(
      currentSubs,
      monthRange(b.monthStart),
    );
    return { monthStart: b.monthStart, newSar, churnedSar, netSar };
  });
}

// ── Churn series ──────────────────────────────────────────────────────────────

export interface ChurnPoint {
  monthStart: string;
  /** Churned customers in-month ÷ current active base. */
  grossPct: number | null;
  /** Churned MRR in-month ÷ current active MRR. */
  netRevenuePct: number | null;
}

export function computeChurnSeries(
  currentSubs: SubLike[],
  base: { activeCount: number; activeMrrSar: number },
  months = 6,
  now: Date = new Date(),
): ChurnPoint[] {
  return lastMonths(Math.max(1, months), now).map((b) => {
    const range = monthRange(b.monthStart);
    let churnedCount = 0;
    let churnedMrr = 0;
    for (const s of currentSubs) {
      if (isChurnedStatus(s.status) && inRange(churnIsoOf(s), range)) {
        churnedCount += 1;
        churnedMrr += monthlyRevenueSar(s.tier, s.cadence);
      }
    }
    return {
      monthStart: b.monthStart,
      grossPct:
        base.activeCount > 0
          ? Math.round((churnedCount / base.activeCount) * 1000) / 10
          : null,
      netRevenuePct:
        base.activeMrrSar > 0
          ? Math.round((churnedMrr / base.activeMrrSar) * 1000) / 10
          : null,
    };
  });
}

// ── Cohort retention matrix (current-snapshot triangle) ────────────────────────

export interface CohortRow {
  cohortMonth: string;
  size: number;
  /** index = months since signup; % currently active|trialing; null = future. */
  cells: Array<number | null>;
}

export function computeCohortMatrix(
  profiles: Array<{ id: string; created_at: string }>,
  currentSubs: SubLike[],
  months = 6,
  now: Date = new Date(),
): CohortRow[] {
  const subByUser = latestSubByUser(currentSubs);
  const isSurvivor = (userId: string): boolean => {
    const st = subByUser.get(userId)?.status ?? null;
    return st === "active" || st === "trialing";
  };

  const buckets = lastMonths(Math.max(1, months), now);
  const monthsN = buckets.length;

  // Group profiles by signup month.
  const byMonth = new Map<string, string[]>();
  for (const p of profiles) {
    const k = monthKey(new Date(p.created_at));
    const arr = byMonth.get(k);
    if (arr) arr.push(p.id);
    else byMonth.set(k, [p.id]);
  }

  return buckets.map((b, i) => {
    const ids = byMonth.get(b.key) ?? [];
    const size = ids.length;
    const age = monthsN - 1 - i; // current month → 0, oldest → monthsN-1
    const survived = ids.filter(isSurvivor).length;
    const survivalPct = size > 0 ? Math.round((survived / size) * 1000) / 10 : 0;
    const cells: Array<number | null> = [];
    for (let k = 0; k < monthsN; k++) {
      cells.push(k <= age ? survivalPct : null);
    }
    return { cohortMonth: b.monthStart, size, cells };
  });
}
