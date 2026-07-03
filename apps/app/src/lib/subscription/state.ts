import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  PRICING_TIERS,
  type Tier,
  type Cadence,
  type SubscriptionStatus,
} from "@fitlife/config";

/**
 * Subscription row shape, including the new columns added in migration 00004.
 * The generated database.types.ts is behind; we annotate explicitly via
 * `.returns<SubscriptionRow[]>()` to keep reads strongly typed without
 * regenerating types.
 */
export interface SubscriptionRow {
  id: string;
  user_id: string;
  tier: Tier;
  status: SubscriptionStatus;
  cadence: Cadence | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  lemonsqueezy_subscription_id: string | null;
  lemonsqueezy_customer_id: string | null;
  lemonsqueezy_variant_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the user's most recent subscription row (any status).
 * No `unique(user_id)` constraint, so we sort by created_at desc.
 */
export async function getCurrentSubscription(
  userId: string,
): Promise<SubscriptionRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, user_id, tier, status, cadence, trial_started_at, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, lemonsqueezy_subscription_id, lemonsqueezy_customer_id, lemonsqueezy_variant_id, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<SubscriptionRow[]>();

  if (error || !data || data.length === 0) return null;
  return data[0] ?? null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of whole days remaining in the trial (clamped to >= 0).
 * Returns 0 for non-trialing subscriptions or expired trials.
 */
export function getTrialDaysRemaining(sub: SubscriptionRow): number {
  if (sub.status !== "trialing" || !sub.trial_ends_at) return 0;
  const remainingMs = new Date(sub.trial_ends_at).getTime() - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / MS_PER_DAY);
}

export function isTrialExpired(sub: SubscriptionRow): boolean {
  if (sub.status !== "trialing") return false;
  if (!sub.trial_ends_at) return true;
  return new Date(sub.trial_ends_at).getTime() <= Date.now();
}

/**
 * True if the subscription should grant access right now:
 *   - status === 'active' AND current_period_end > now (handles the
 *     cancel-at-period-end case where the row stays 'active' until the
 *     paid-through date and then transitions to 'expired' via the webhook
 *     or a stale-period check)
 *   - status === 'trialing' AND trial_ends_at is in the future
 */
export function isSubscriptionActive(sub: SubscriptionRow): boolean {
  if (sub.status === "active") {
    // If we have a current_period_end, require it to be in the future.
    // Webhooks fill this; only legacy/seed rows may have it null — treat as active.
    if (!sub.current_period_end) return true;
    return new Date(sub.current_period_end).getTime() > Date.now();
  }
  if (sub.status === "trialing") return !isTrialExpired(sub);
  return false;
}

/**
 * True when a renewal payment has failed and the user needs to update their
 * card. Distinct from 'cancelled' / 'expired' — the user can recover by
 * paying, no need to start a new subscription.
 */
export function isPastDue(sub: SubscriptionRow): boolean {
  return sub.status === "past_due";
}

/**
 * True when the user already holds a LIVE Lemonsqueezy subscription — a new
 * checkout would create a SECOND LS subscription that keeps billing while our
 * single subscriptions row points at the newer one (orphaned, uncancellable
 * from the UI). Tier changes go through /api/subscription/change, which swaps
 * the variant on the EXISTING LS subscription instead.
 *
 * past_due counts as live: the LS sub is recoverable by paying — a second
 * checkout would orphan it. Internal trials never carry an LS id, so trial
 * users still check out normally; cancelled/expired/lapsed rows fall through
 * (starting a fresh subscription is the correct recovery there).
 */
export function hasLiveLemonsqueezySubscription(
  sub: SubscriptionRow | null,
): boolean {
  if (!sub?.lemonsqueezy_subscription_id) return false;
  return isSubscriptionActive(sub) || isPastDue(sub);
}

/**
 * Maximum number of beneficiaries the tier allows (Mom + family_members,
 * excluding the housekeeper). null means unlimited.
 */
export function getTierLimit(tier: Tier): number | null {
  return PRICING_TIERS[tier].max_people;
}
