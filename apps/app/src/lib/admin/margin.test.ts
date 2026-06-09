import { describe, expect, it } from "vitest";

import { MARGIN_ASSUMPTIONS, computeGrossMargin } from "./margin";

describe("computeGrossMargin", () => {
  it("subtracts LS fees (pct + per-monthly-sub fixed), AI cost, and infra", () => {
    const m = computeGrossMargin({
      mrrUsd: 1000,
      activeCount: 100,
      activeMonthlyCount: 80,
      aiCostUsd: 50,
    });
    // fees = 1000*0.05 + 80*0.50 = 90 ; infra = 100*0.30 = 30
    expect(m.lsFeesUsd).toBe(90);
    expect(m.infraUsd).toBe(30);
    expect(m.grossProfitUsd).toBe(830);
    expect(m.marginPct).toBe(83);
  });

  it("returns null margin when there's no revenue", () => {
    const m = computeGrossMargin({
      mrrUsd: 0,
      activeCount: 0,
      activeMonthlyCount: 0,
      aiCostUsd: 0,
    });
    expect(m.marginPct).toBeNull();
  });

  it("reports a negative margin honestly when costs exceed revenue", () => {
    const m = computeGrossMargin({
      mrrUsd: 10,
      activeCount: 1,
      activeMonthlyCount: 1,
      aiCostUsd: 100,
    });
    expect(m.grossProfitUsd).toBeLessThan(0);
    expect(m.marginPct).toBeLessThan(0);
  });

  it("exposes editable assumptions", () => {
    expect(MARGIN_ASSUMPTIONS.ls_fee_pct).toBeGreaterThan(0);
    expect(MARGIN_ASSUMPTIONS.ls_fee_fixed_usd).toBeGreaterThan(0);
    expect(MARGIN_ASSUMPTIONS.infra_usd_per_active_user_mo).toBeGreaterThan(0);
  });
});
