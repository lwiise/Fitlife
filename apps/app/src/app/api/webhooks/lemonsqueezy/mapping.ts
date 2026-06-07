/**
 * Pure mapping helpers for the LemonSqueezy webhook.
 *
 * Extracted from route.ts so the mapping logic can be unit-tested in isolation
 * without importing the route module (which pulls in the Supabase admin client,
 * env access, and Sentry at module load). Behavior is unchanged — route.ts
 * imports these back.
 */

/**
 * Map a LemonSqueezy subscription status to our internal subscription status.
 * Returns null for unknown statuses.
 */
export function mapLemonsqueezyStatus(
  lsStatus: string,
): "trialing" | "active" | "past_due" | "cancelled" | "expired" | null {
  switch (lsStatus) {
    case "on_trial":
      return "trialing";
    case "active":
      return "active";
    case "paused":
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
  const id = String(variantId);
  const monthly = ["1677645", "1677648", "1677653", "1677655"];
  const annual = ["1677781", "1677755", "1677675", "1677749"];
  if (monthly.includes(id)) return "monthly";
  if (annual.includes(id)) return "annual";
  return null;
}
