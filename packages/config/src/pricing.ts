/**
 * Single source of truth for pricing across the marketing site and the SaaS app.
 *
 * Annual prices follow the formula: round(monthly * 12 * 0.80).
 * - starter:  29 * 12 * 0.80 =  278.4 → 278
 * - pro:      59 * 12 * 0.80 =  566.4 → 566
 * - family:  129 * 12 * 0.80 = 1238.4 → 1238
 * - premium: 249 * 12 * 0.80 = 2390.4 → 2390
 *
 * Arabic display names match the landing page (البداية, المتقدمة, العائلة, البريميوم).
 */

export const TRIAL_DAYS = 7;
export const ANNUAL_DISCOUNT_PERCENT = 20;

export type Tier = "starter" | "pro" | "family" | "premium";
export type Cadence = "monthly" | "annual";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export interface TierDefinition {
  id: Tier;
  name_ar: string;
  /** Max number of beneficiaries (Mom + family members, excluding housekeeper). null = unlimited. */
  max_people: number | null;
  price_monthly_sar: number;
  price_annual_sar: number;
  highlighted: boolean;
  features_ar: string[];
}

export const PRICING_TIERS: Record<Tier, TierDefinition> = {
  starter: {
    id: "starter",
    name_ar: "البداية",
    max_people: 1,
    price_monthly_sar: 29,
    price_annual_sar: 278,
    highlighted: false,
    features_ar: [
      "خطة غذائية شخصية",
      "5 أسئلة يومياً للمساعد الذكي",
      "تتبع الوزن والقياسات",
      "وصفات خليجية أساسية",
      "بالعربي",
    ],
  },
  pro: {
    id: "pro",
    name_ar: "المتقدمة",
    max_people: 2,
    price_monthly_sar: 59,
    price_annual_sar: 566,
    highlighted: false,
    features_ar: [
      "كل ميزات البداية",
      "محادثات غير محدودة مع الذكاء الاصطناعي",
      "تكامل مع Apple Watch و Fitbit",
      "صور قبل/بعد",
      "تقارير أسبوعية",
    ],
  },
  family: {
    id: "family",
    name_ar: "العائلة",
    max_people: 6,
    price_monthly_sar: 129,
    price_annual_sar: 1238,
    highlighted: true,
    features_ar: [
      "كل ميزات المتقدمة لكل فرد",
      "حتى 6 أفراد في الباقة",
      "حساب منفصل للخادمة بلغتها",
      "خطط للأولاد حسب أعمارهم",
      "تقارير عائلية شهرية",
      "أولوية في الدعم",
    ],
  },
  premium: {
    id: "premium",
    name_ar: "البريميوم",
    max_people: null,
    price_monthly_sar: 249,
    price_annual_sar: 2390,
    highlighted: false,
    features_ar: [
      "كل ميزات العائلة",
      "جلستان شهرياً مع خبيرة تغذية معتمدة",
      "خطط مخصصة لحالات خاصة (حمل، سكري، ضغط)",
      "تقارير صحية يومية",
    ],
  },
};

/**
 * Returns the per-month equivalent when paying annually (for display on toggles
 * that show "X SAR/month" but bill the full year up front). Rounded to nearest SAR.
 */
export function getAnnualMonthlyEquivalent(tier: TierDefinition): number {
  return Math.round(tier.price_annual_sar / 12);
}
