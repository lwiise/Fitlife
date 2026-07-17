/**
 * Pure mapping helpers for the LemonSqueezy webhook.
 *
 * Extracted from route.ts so the mapping logic can be unit-tested in isolation
 * without importing the route module (which pulls in the Supabase admin client,
 * env access, and Sentry at module load). Behavior is unchanged — route.ts
 * imports these back.
 */

import { PRICING_TIERS } from "@fitlife/config";

/**
 * Map a LemonSqueezy subscription status to our internal subscription status.
 * Returns null for unknown statuses.
 */
export function mapLemonsqueezyStatus(
  lsStatus: string,
): "trialing" | "active" | "paused" | "past_due" | "cancelled" | "expired" | null {
  switch (lsStatus) {
    case "on_trial":
      return "trialing";
    case "active":
      return "active";
    // A pause is a deliberate «استراحة» (churn deflection), NOT a payment
    // failure — mapping it to past_due showed pausers the red billing banner.
    case "paused":
      return "paused";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return null;
  }
}

/**
 * Derive the billing cadence from a LemonSqueezy variant id.
 * Returns null for unknown variant ids.
 */
export function deriveCadence(
  variantId: string | number,
): "monthly" | "annual" | null {
  // Derived from the pricing config — the single source of variant IDs — so
  // the pre-launch swap to LIVE-mode variants happens in pricing.ts ONCE and
  // this mapping follows automatically. (A previous hardcoded duplicate list
  // here would have silently broken cadence sync on that swap.)
  const id = String(variantId);
  for (const tier of Object.values(PRICING_TIERS)) {
    if (tier.lemonsqueezy_variant_id_monthly === id) return "monthly";
    if (tier.lemonsqueezy_variant_id_annual === id) return "annual";
  }
  return null;
}
