import { describe, it, expect, afterEach } from "vitest";
import {
  getVariantId,
  getTierCadenceByVariantId,
  variantEnvVar,
  usingLiveVariantIds,
  getAnnualMonthlyEquivalent,
  PRICING_TIERS,
  ANNUAL_DISCOUNT_PERCENT,
  type Tier,
  type Cadence,
} from "@fitlife/config";

const TIERS: Tier[] = ["starter", "pro", "family", "premium"];
const CADENCES: Cadence[] = ["monthly", "annual"];
const ALL_VARS = TIERS.flatMap((t) => CADENCES.map((c) => variantEnvVar(t, c)));

afterEach(() => {
  for (const v of ALL_VARS) delete process.env[v];
});

describe("variant id override", () => {
  // The shipped ids are LIVE and charge real cards (verified 2026-07-26). The
  // env overrides let one (tier, cadence) pair be pointed elsewhere — e.g. at a
  // genuine test-mode variant — without a code change. usingLiveVariantIds()
  // reports whether all eight overrides are set; it does NOT detect the store's
  // mode, which is Lemonsqueezy-side state this process cannot see.
  it("falls back to the built-in ids when nothing is configured", () => {
    expect(getVariantId("family", "monthly")).toBe(
      PRICING_TIERS.family.lemonsqueezy_variant_id_monthly,
    );
    expect(usingLiveVariantIds()).toBe(false);
  });

  it("prefers a live override for exactly the pair it names", () => {
    process.env[variantEnvVar("family", "monthly")] = "999111";
    expect(getVariantId("family", "monthly")).toBe("999111");
    // Its own annual pair, and every other tier, are untouched.
    expect(getVariantId("family", "annual")).toBe(
      PRICING_TIERS.family.lemonsqueezy_variant_id_annual,
    );
    expect(getVariantId("pro", "monthly")).toBe(
      PRICING_TIERS.pro.lemonsqueezy_variant_id_monthly,
    );
  });

  it("reports live mode only when ALL eight pairs are configured", () => {
    for (const v of ALL_VARS.slice(0, -1)) process.env[v] = "1";
    expect(usingLiveVariantIds()).toBe(false); // half-migrated store
    process.env[ALL_VARS[ALL_VARS.length - 1]!] = "1";
    expect(usingLiveVariantIds()).toBe(true);
  });

  it("ignores an override that is blank or whitespace", () => {
    process.env[variantEnvVar("starter", "monthly")] = "   ";
    expect(getVariantId("starter", "monthly")).toBe(
      PRICING_TIERS.starter.lemonsqueezy_variant_id_monthly,
    );
  });
});

describe("getTierCadenceByVariantId", () => {
  it("resolves the built-in ids", () => {
    expect(getTierCadenceByVariantId(PRICING_TIERS.pro.lemonsqueezy_variant_id_annual)).toEqual({
      tier: "pro",
      cadence: "annual",
    });
  });

  // Without this the moment live ids are configured every webhook would fail to
  // map a real subscription back to a tier.
  it("resolves a LIVE override id too", () => {
    process.env[variantEnvVar("premium", "monthly")] = "555000";
    expect(getTierCadenceByVariantId("555000")).toEqual({
      tier: "premium",
      cadence: "monthly",
    });
  });

  it("still resolves built-in ids after an override is set, for pre-existing subscriptions", () => {
    process.env[variantEnvVar("premium", "monthly")] = "555000";
    expect(
      getTierCadenceByVariantId(PRICING_TIERS.premium.lemonsqueezy_variant_id_monthly),
    ).toEqual({ tier: "premium", cadence: "monthly" });
  });

  it("returns null for an unknown variant", () => {
    expect(getTierCadenceByVariantId("does-not-exist")).toBeNull();
  });
});

describe("annual pricing arithmetic", () => {
  it("keeps price_annual_sar as the real total, matching the documented formula", () => {
    for (const t of TIERS) {
      const tier = PRICING_TIERS[t];
      expect(tier.price_annual_sar).toBe(
        Math.round(tier.price_monthly_sar * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100)),
      );
    }
  });

  // The landing page used to render annualPrice * 12, which re-introduces the
  // rounding in the per-month equivalent and under-quoted every tier.
  it("shows that the per-month equivalent x12 is NOT the annual total", () => {
    const family = PRICING_TIERS.family;
    expect(getAnnualMonthlyEquivalent(family) * 12).not.toBe(family.price_annual_sar);
  });
});
