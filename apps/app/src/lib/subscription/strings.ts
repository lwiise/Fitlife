import { PRICING_TIERS, type Tier } from "@fitlife/config";

/**
 * Mirror of PRICING_TIERS[t].name_ar, exported here for convenient access
 * outside of the @fitlife/config import path.
 */
export const TIER_DISPLAY_NAMES_AR: Record<Tier, string> = {
  starter: PRICING_TIERS.starter.name_ar,
  pro: PRICING_TIERS.pro.name_ar,
  family: PRICING_TIERS.family.name_ar,
  premium: PRICING_TIERS.premium.name_ar,
};

/**
 * Simplified Arabic plural — uses "بعد X يوم" uniformly across all values.
 * (Per the prompt's MVP allowance; a proper Arabic dual/plural variant can
 * come later.)
 */
export function buildTrialEndsMessage(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return "انتهت فترتك التجريبية";
  }
  return `تجربتك المجانية تنتهي بعد ${daysRemaining} يوم`;
}

export function buildPersonLimitMessage(
  current: number,
  max: number,
  tierName: string,
): string {
  return `خطتك (${tierName}) تسمح بـ ${max} أشخاص فقط. عائلتك ${current} أشخاص. ترقي للفاميلي`;
}

export function buildUpgradeRequiredMessage(tierName: string): string {
  return `يلزم الترقية إلى ${tierName} للوصول`;
}
