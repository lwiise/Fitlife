/**
 * Gross-margin estimate for the admin unit-economics cluster. Pure + testable.
 *
 * IMPORTANT — these are ESTIMATES, not booked figures. LemonSqueezy is the
 * Merchant of Record, and neither its payout fees nor our infrastructure cost
 * are stored anywhere in the data model. The numbers below are the assumptions
 * the UI surfaces (the margin tile is labeled "est." and lists them). Edit them
 * here as real fee/infra figures land — this constant is the single knob.
 *
 *   ls_fee_pct                  — LemonSqueezy MoR cut, ~5% of revenue.
 *   ls_fee_fixed_usd            — fixed per-transaction fee (~$0.50). Applied
 *                                 only to monthly-cadence active subs; annual
 *                                 subs transact once/year, so amortized monthly
 *                                 the fixed fee is negligible — they contribute
 *                                 the percentage fee only.
 *   infra_usd_per_active_user_mo — rough hosting/DB/egress per active user/mo.
 */
export const MARGIN_ASSUMPTIONS = {
  ls_fee_pct: 0.05,
  ls_fee_fixed_usd: 0.5,
  infra_usd_per_active_user_mo: 0.3,
} as const;

export interface GrossMargin {
  revenueUsd: number;
  lsFeesUsd: number;
  aiCostUsd: number;
  infraUsd: number;
  grossProfitUsd: number;
  /** Gross profit ÷ revenue, as a percent. Null when there's no revenue. */
  marginPct: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Estimated monthly gross margin. `mrrUsd` is the monthly run-rate revenue;
 * `activeMonthlyCount` is active subs on monthly cadence (for the fixed fee);
 * `activeCount` is all active subs (for infra); `aiCostUsd` is the period's AI
 * spend. marginPct may be negative on test data (AI cost > revenue) — that's
 * honest, not a bug.
 */
export function computeGrossMargin(input: {
  mrrUsd: number;
  activeCount: number;
  activeMonthlyCount: number;
  aiCostUsd: number;
}): GrossMargin {
  const { mrrUsd, activeCount, activeMonthlyCount, aiCostUsd } = input;
  const lsFeesUsd = round2(
    mrrUsd * MARGIN_ASSUMPTIONS.ls_fee_pct +
      activeMonthlyCount * MARGIN_ASSUMPTIONS.ls_fee_fixed_usd,
  );
  const infraUsd = round2(activeCount * MARGIN_ASSUMPTIONS.infra_usd_per_active_user_mo);
  const ai = round2(aiCostUsd);
  const grossProfitUsd = round2(mrrUsd - lsFeesUsd - ai - infraUsd);
  const marginPct =
    mrrUsd > 0 ? Math.round((grossProfitUsd / mrrUsd) * 1000) / 10 : null;
  return {
    revenueUsd: round2(mrrUsd),
    lsFeesUsd,
    aiCostUsd: ai,
    infraUsd,
    grossProfitUsd,
    marginPct,
  };
}
