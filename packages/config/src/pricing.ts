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
 *
 * The Lemonsqueezy variant IDs below are TEST MODE. Verified 2026-07-27 against
 * the hosted checkout the app itself generated: both the order object and the
 * product variant report `test_mode: true`, and card 4242…4242 completes.
 *
 * Do NOT read the `isTestMode` field on that page as the answer — it belongs to
 * the Lemonsqueezy DASHBOARD VIEWER's session (it sits beside `isImpersonating`
 * and `can.manageBilling`) and is false for any anonymous visitor. Mistaking it
 * for the payment mode is how this comment briefly claimed the opposite.
 *
 * The mode is Lemonsqueezy-side state and can change without touching this repo,
 * so treat the above as "verified on that date", not as an invariant. The env
 * overrides (see variantEnvVar) point a (tier, cadence) pair at a different
 * variant without a code change; usingLiveVariantIds() reports only whether all
 * eight overrides are SET, which is not the same question.
 *
 *   LEMONSQUEEZY_VARIANT_STARTER_MONTHLY   LEMONSQUEEZY_VARIANT_STARTER_ANNUAL
 *   LEMONSQUEEZY_VARIANT_PRO_MONTHLY       LEMONSQUEEZY_VARIANT_PRO_ANNUAL
 *   LEMONSQUEEZY_VARIANT_FAMILY_MONTHLY    LEMONSQUEEZY_VARIANT_FAMILY_ANNUAL
 *   LEMONSQUEEZY_VARIANT_PREMIUM_MONTHLY   LEMONSQUEEZY_VARIANT_PREMIUM_ANNUAL
 */

export const TRIAL_DAYS = 7;
export const ANNUAL_DISCOUNT_PERCENT = 20;

export type Tier = "starter" | "pro" | "family" | "premium";
export type Cadence = "monthly" | "annual";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  // Billing suspended via the LemonSqueezy pause API (churn deflection);
  // auto-resumes at resumes_at. Not active: plan access gates off while paused.
  | "paused"
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
  /** Lemonsqueezy variant IDs. TEST MODE as of 2026-07-27 — see the file header. */
  lemonsqueezy_variant_id_monthly: string;
  lemonsqueezy_variant_id_annual: string;
}

export const PRICING_TIERS: Record<Tier, TierDefinition> = {
  starter: {
    id: "starter",
    name_ar: "البداية",
    max_people: 1,
    price_monthly_sar: 29,
    price_annual_sar: 278,
    highlighted: false,
    // HONESTY RULE (07/2026): every line here must name something the product
    // actually does today. Tier gates exactly ONE thing — max_people — so a
    // line that implies a per-tier capability is a promise no code keeps.
    // Audited against the codebase after a QA pass found five advertised
    // features with no implementation (wearable sync, unlimited chat, monthly
    // family reports, daily health reports, dietitian sessions) and two that
    // were real but available on every tier (before/after photos, weekly
    // recap). Before adding a line, either gate it or don't sell it.
    features_ar: [
      "خطة غذائية أسبوعية شخصية",
      "برنامج تمارين أسبوعي",
      "30 رسالة يومياً مع المستشارة الذكية",
      "تتبع الوزن والقياسات مع صور التقدّم",
      "رسالة أسبوعية تلخّص أسبوعك",
      "وصفات خليجية، بالعربي",
      "لفرد واحد",
    ],
    lemonsqueezy_variant_id_monthly: "1677645",
    lemonsqueezy_variant_id_annual: "1677781",
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
      "لفردين — خطة لكل واحد",
      "وجبات مشتركة منسّقة بين الفردين",
      "خطط للحمل والرضاعة والحالات الصحية",
    ],
    lemonsqueezy_variant_id_monthly: "1677648",
    lemonsqueezy_variant_id_annual: "1677755",
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
      "تعليمات طبخ بلغة الخدامة",
      "خطط للأولاد حسب أعمارهم",
      "لوحة «موسم بيتنا» للعائلة",
      "أولوية في الدعم",
    ],
    lemonsqueezy_variant_id_monthly: "1677653",
    lemonsqueezy_variant_id_annual: "1677675",
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
      "أفراد بلا حد — لكل فرد خطته",
      "أولوية قصوى في الدعم",
    ],
    lemonsqueezy_variant_id_monthly: "1677655",
    lemonsqueezy_variant_id_annual: "1677749",
  },
};

/**
 * Env var holding the LIVE variant id for a (tier, cadence) pair, e.g.
 * LEMONSQUEEZY_VARIANT_FAMILY_MONTHLY. Exported so ops tooling and tests can
 * name the same variables without restating the convention.
 */
export function variantEnvVar(tier: Tier, cadence: Cadence): string {
  return `LEMONSQUEEZY_VARIANT_${tier.toUpperCase()}_${cadence.toUpperCase()}`;
}

/**
 * Resolve the Lemonsqueezy variant ID for a (tier, cadence) pair.
 * Used by the checkout API to look up the variant to charge.
 *
 * The ids baked into PRICING_TIERS are TEST MODE as of 2026-07-27 (see the file
 * header). Setting the matching env var (see variantEnvVar) overrides one pair
 * without a code change. Per-pair rather than a single mode flag, so tiers can
 * be migrated one at a time instead of flipping the whole store at once.
 *
 * Read lazily on each call — not at module load — because this module is also
 * imported by the marketing client bundle, where process.env is not populated.
 * The client only ever reads prices, never variant ids.
 */
export function getVariantId(tier: Tier, cadence: Cadence): string {
  const override =
    typeof process !== "undefined"
      ? process.env?.[variantEnvVar(tier, cadence)]?.trim()
      : undefined;
  if (override) return override;

  const t = PRICING_TIERS[tier];
  return cadence === "annual"
    ? t.lemonsqueezy_variant_id_annual
    : t.lemonsqueezy_variant_id_monthly;
}

/**
 * True when every (tier, cadence) pair has an env override configured.
 *
 * ⚠️ This says NOTHING about the store's mode. It answers "are all eight
 * overrides set", not "are we in test mode" — the mode belongs to Lemonsqueezy
 * and this process cannot see it. It was once documented (and logged) as if it
 * DID detect the mode, and that framing then got the answer wrong in both
 * directions on consecutive days. Whatever it returns, verify the store.
 *
 * Its actual use: spotting a HALF-configured store, where some pairs resolve to
 * an override and others fall back, before a customer finds the inconsistency.
 */
export function usingLiveVariantIds(): boolean {
  if (typeof process === "undefined") return false;
  const tiers: Tier[] = ["starter", "pro", "family", "premium"];
  const cadences: Cadence[] = ["monthly", "annual"];
  return tiers.every((t) =>
    cadences.every((c) => Boolean(process.env?.[variantEnvVar(t, c)]?.trim())),
  );
}

/**
 * Reverse of getVariantId: resolve the (tier, cadence) a Lemonsqueezy variant ID
 * maps to. Used when reconciling a subscription directly from the Lemonsqueezy
 * API (the webhook gets tier from checkout custom_data, but listSubscriptions
 * only exposes the variant id). Returns null for an unrecognized variant.
 */
export function getTierCadenceByVariantId(
  variantId: string | number,
): { tier: Tier; cadence: Cadence } | null {
  const id = String(variantId);
  // Live overrides FIRST. This is the reverse of getVariantId and must honour
  // the same env vars — otherwise, the moment live ids are configured, every
  // webhook and reconciliation would fail to map a real subscription back to a
  // tier and silently fall through to null.
  for (const t of Object.values(PRICING_TIERS)) {
    for (const cadence of ["monthly", "annual"] as Cadence[]) {
      if (getVariantId(t.id, cadence) === id) return { tier: t.id, cadence };
    }
  }
  // Built-in test ids, still matched even when overrides are set, so a
  // subscription created before the live switch keeps resolving.
  for (const t of Object.values(PRICING_TIERS)) {
    if (t.lemonsqueezy_variant_id_monthly === id)
      return { tier: t.id, cadence: "monthly" };
    if (t.lemonsqueezy_variant_id_annual === id)
      return { tier: t.id, cadence: "annual" };
  }
  return null;
}

/**
 * Returns the per-month equivalent when paying annually (for display on toggles
 * that show "X SAR/month" but bill the full year up front). Rounded to nearest SAR.
 */
export function getAnnualMonthlyEquivalent(tier: TierDefinition): number {
  return Math.round(tier.price_annual_sar / 12);
}
