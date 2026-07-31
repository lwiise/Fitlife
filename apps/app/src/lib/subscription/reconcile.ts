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
 * the user's subscriptions and reconciles our row to the real state — so a
 * successful payment always unlocks generation even without the webhook.
 *
 * Matched by the stored LemonSqueezy CUSTOMER ID where we have one, falling
 * back to email only for a genuine cold start (and then only for a
 * subscription whose custom_data names this user).
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
  const known = await getCurrentSubscription(userId);

  try {
    setupLemonsqueezy();
    const storeId = getLemonsqueezyStoreId();

    // Prefer IDENTITY over email. Checkout deliberately does not prefill the
    // email (LS 422s the whole checkout on addresses it cannot validate), so
    // the address on the LemonSqueezy side is whatever the customer typed —
    // frequently not their FitLife account email. Matching on it therefore
    // missed exactly the people this self-heal exists for: someone who paid,
    // whose webhook was missed, and who is still being asked to subscribe.
    //
    // It is also a join on an attribute the user controls rather than on
    // user_id, so any account whose email happened to equal the address used on
    // SOMEONE ELSE'S checkout inherited that subscription — including the
    // subscription id that /cancel, /pause and /change then act upon.
    //
    // The customer id is ours, recorded from a verified webhook. Email is kept
    // only for the genuine cold start (no ids yet), and that path now requires
    // the matched subscription's own custom_data.user_id to name this user.
    const byCustomer = known?.lemonsqueezy_customer_id;
    const filter = byCustomer
      ? { storeId, customerId: byCustomer }
      : email
        ? { storeId, userEmail: email }
        : null;
    if (!filter) return known;

    const res = await listSubscriptions({ filter, page: { size: 100 } });

    const all = res.data?.data ?? [];
    // Cold-start email path only: require the subscription to name this user.
    // A subscription created by our checkout always carries custom_data.user_id
    // (see /api/checkout), so this rejects someone else's subscription without
    // rejecting our own.
    const subs = byCustomer
      ? all
      : all.filter((s) => {
          const cd = (
            s.attributes as unknown as {
              first_subscription_item?: unknown;
              custom_data?: { user_id?: string };
            }
          ).custom_data;
          return cd?.user_id === userId;
        });
    if (subs.length === 0) return known;

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
    if (!best) return known;

    const attrs = best.attributes;
    const mappedStatus = mapLemonsqueezyStatus(attrs.status);
    // Unknown LS status → don't risk writing garbage; leave the row as-is.
    if (!mappedStatus) return known;

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
    // 00024 adds unique(user_id), so this names exactly one row.
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
