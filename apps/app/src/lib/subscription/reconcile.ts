import "server-only";

import { listSubscriptions } from "@lemonsqueezy/lemonsqueezy.js";
import { getTierCadenceByVariantId } from "@fitlife/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLemonsqueezyStoreId } from "@/lib/env";
import { setupLemonsqueezy } from "@/lib/lemonsqueezy/client";
import { mapLemonsqueezyStatus } from "@/app/api/webhooks/lemonsqueezy/mapping";
import {
  getCurrentSubscription,
  getCurrentSubscriptionFresh,
  type SubscriptionRow,
} from "./state";

/**
 * Direct-from-Lemonsqueezy reconciliation — the safety net for a missed or
 * delayed `subscription_created` webhook.
 *
 * Normally the webhook is the ONLY thing that flips a row from the signup trial
 * to `active`/paid. If it never arrives (mis-configured endpoint, signature
 * mismatch, transient failure), a user who actually paid stays on the trial row
 * and keeps getting asked to subscribe. This queries the Lemonsqueezy API for
 * the user's subscriptions by email and reconciles our row to the real state —
 * so a successful payment always unlocks generation even without the webhook.
 *
 * Idempotent and best-effort: any failure (no email, API error, unknown
 * variant) logs and returns the current row unchanged. Never throws — callers
 * use it as a self-heal and fall back to whatever the DB already has.
 *
 * Picks the user's best subscription (active > on_trial > past_due > other,
 * newest first) so an old cancelled row can never shadow a live one.
 */
export async function reconcileSubscriptionFromLemonSqueezy(
  userId: string,
  email: string | null | undefined,
): Promise<SubscriptionRow | null> {
  if (!email) return getCurrentSubscription(userId);

  try {
    setupLemonsqueezy();
    const storeId = getLemonsqueezyStoreId();

    const res = await listSubscriptions({
      filter: { storeId, userEmail: email },
      page: { size: 100 },
    });

    const subs = res.data?.data ?? [];
    if (subs.length === 0) return getCurrentSubscription(userId);

    const rank = (status: string): number => {
      switch (status) {
        case "active":
          return 4;
        case "on_trial":
          return 3;
        case "past_due":
        case "paused":
        case "unpaid":
          return 2;
        default:
          return 1; // cancelled / expired
      }
    };

    const best = [...subs].sort((a, b) => {
      const byRank = rank(b.attributes.status) - rank(a.attributes.status);
      if (byRank !== 0) return byRank;
      return (
        new Date(b.attributes.created_at).getTime() -
        new Date(a.attributes.created_at).getTime()
      );
    })[0];
    if (!best) return getCurrentSubscription(userId);

    const attrs = best.attributes;
    const mappedStatus = mapLemonsqueezyStatus(attrs.status);
    // Unknown LS status → don't risk writing garbage; leave the row as-is.
    if (!mappedStatus) return getCurrentSubscription(userId);

    const tierCadence = getTierCadenceByVariantId(attrs.variant_id);

    const update: Record<string, unknown> = {
      status: mappedStatus,
      lemonsqueezy_subscription_id: String(best.id),
      cancel_at_period_end: !!attrs.cancelled,
    };
    if (attrs.customer_id != null)
      update.lemonsqueezy_customer_id = String(attrs.customer_id);
    if (attrs.variant_id != null)
      update.lemonsqueezy_variant_id = String(attrs.variant_id);
    if (attrs.renews_at) update.current_period_end = attrs.renews_at;
    if (attrs.trial_ends_at) update.trial_ends_at = attrs.trial_ends_at;
    // Only set tier/cadence when the variant is recognized — never downgrade a
    // paid tier to a guess just because a variant id is unmapped.
    if (tierCadence) {
      update.tier = tierCadence.tier;
      update.cadence = tierCadence.cadence;
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("subscriptions")
      .update(update)
      .eq("user_id", userId);
    if (error) {
      console.error("[reconcileSubscription] update failed", { userId, error });
    } else {
      console.log("[reconcileSubscription] reconciled", {
        userId,
        lsSubscriptionId: String(best.id),
        status: mappedStatus,
        tier: tierCadence?.tier,
      });
    }
  } catch (err) {
    console.error("[reconcileSubscription] error", err);
  }

  // Always return the freshest row (post-update if it succeeded). Must bypass
  // the request-scoped memoization — the caller may have already read the
  // pre-update row in this same request.
  return getCurrentSubscriptionFresh(userId);
}
