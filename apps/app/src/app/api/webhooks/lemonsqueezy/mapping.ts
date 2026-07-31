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
