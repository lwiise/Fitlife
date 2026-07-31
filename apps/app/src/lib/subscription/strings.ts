import { PRICING_TIERS, type Tier } from "@fitlife/config";

import { countAr, DAY_FORMS, PERSON_FORMS } from "@/lib/copy/plural";

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
 * The trial countdown. Previously "بعد X يوم" for every value — the MVP
 * shortcut this file used to document — which renders «بعد 7 يوم» on a 7-day
 * trial. Now agrees properly (يوم واحد / يومين / 5 أيام / 15 يوماً).
 */
export function buildTrialEndsMessage(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return "انتهت فترتك التجريبية";
  }
  return `تجربتك المجانية تنتهي بعد ${countAr(daysRemaining, DAY_FORMS)}`;
}

export function buildPersonLimitMessage(
  current: number,
  max: number,
  tierName: string,
): string {
  // Same agreement problem: a Starter cap read «تسمح بـ 1 أشخاص».
  return `خطتك (${tierName}) تسمح بـ ${countAr(max, PERSON_FORMS)} فقط. عائلتك ${countAr(current, PERSON_FORMS)}. ترقي للفاميلي`;
}

export function buildUpgradeRequiredMessage(tierName: string): string {
  return `يلزم الترقية إلى ${tierName} للوصول`;
}
