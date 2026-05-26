import "server-only";

import { cancelSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { setupLemonsqueezy } from "./client";

/**
 * Cancel a Lemonsqueezy subscription by its LS subscription id.
 *
 * Used during account deletion. Throws on failure so the caller can decide
 * what to do — for PDPL erasure the caller logs and PROCEEDS with deletion
 * regardless (an LS error must never block the right to be deleted).
 */
export async function cancelLemonsqueezySubscription(
  subscriptionId: string,
): Promise<void> {
  setupLemonsqueezy();
  const { error } = await cancelSubscription(subscriptionId);
  if (error) {
    throw new Error(error.message ?? "Lemonsqueezy cancel failed");
  }
}
