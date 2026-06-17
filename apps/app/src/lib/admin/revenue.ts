/**
 * Revenue math for the admin dashboard. Pure + dependency-light (only the
 * pricing config), so it's unit-testable.
 *
 * MRR = monthly run-rate of currently-paying ("active") subscriptions. Annual
 * subscriptions contribute price_annual_sar / 12. Trialing subscriptions are
 * NOT yet paying, so they are excluded from MRR. Prices are in SAR; convert to
 * USD with SAR_TO_USD_RATE for the AI-cost-as-%-of-revenue margin signal.
 */

import { PRICING_TIERS, SAR_TO_USD_RATE, type Tier } from "@fitlife/config";

/** Normalized monthly revenue (SAR) for one subscription's (tier, cadence). */
export function monthlyRevenueSar(
  tier: string | null,
  cadence: string | null,
): number {
  if (!tier || !(tier in PRICING_TIERS)) return 0;
  const def = PRICING_TIERS[tier as Tier];
  if (cadence === "annual") return Math.round(def.price_annual_sar / 12);
  // Default to monthly pricing when cadence is missing/unknown.
  return def.price_monthly_sar;
}

export function sarToUsd(sar: number): number {
  return Math.round(sar * SAR_TO_USD_RATE * 100) / 100;
}

/**
 * Convert a USD amount to SAR at the platform rate. Inverse of `sarToUsd`.
 * Returned unrounded — the formatter (`fmtSar`) applies display precision so
 * small per-account/per-member figures keep their cents.
 */
export function usdToSar(usd: number): number {
  return usd / SAR_TO_USD_RATE;
}

export interface MrrBreakdown {
  mrrSar: number;
  arrSar: number;
  mrrUsd: number;
  arrUsd: number;
}

/** Sum MRR over a set of subscriptions already filtered to status === 'active'. */
export function computeMrr(
  activeSubs: Array<{ tier: string | null; cadence: string | null }>,
): MrrBreakdown {
  const mrrSar = activeSubs.reduce(
    (sum, s) => sum + monthlyRevenueSar(s.tier, s.cadence),
    0,
  );
  const arrSar = mrrSar * 12;
  return {
    mrrSar,
    arrSar,
    mrrUsd: sarToUsd(mrrSar),
    arrUsd: sarToUsd(arrSar),
  };
}
