import "server-only";

import {
  getSubscription,
  listSubscriptionInvoices,
  cancelSubscription,
  updateSubscription,
} from "@lemonsqueezy/lemonsqueezy.js";
import * as Sentry from "@sentry/nextjs";
import { setupLemonsqueezy } from "./client";

export interface LSSubscriptionDetails {
  status: string;
  renews_at: string | null;
  ends_at: string | null;
  card_brand: string | null;
  card_last_four: string | null;
  variant_id: number | null;
  product_name: string | null;
  variant_name: string | null;
}

export interface LSInvoice {
  id: string;
  created_at: string;
  total_formatted: string;
  status: string;
  invoice_url: string | null;
}

/**
 * Live subscription details from Lemonsqueezy (authoritative status + card on
 * file). Returns null on any failure — callers fall back to our DB cache.
 */
export async function getLSSubscription(
  subscriptionId: string,
): Promise<LSSubscriptionDetails | null> {
  setupLemonsqueezy();
  try {
    const { data, error } = await getSubscription(subscriptionId);
    if (error || !data?.data) return null;
    const a = data.data.attributes;
    return {
      status: a.status,
      renews_at: a.renews_at ?? null,
      ends_at: a.ends_at ?? null,
      card_brand: a.card_brand ?? null,
      card_last_four: a.card_last_four ?? null,
      variant_id: a.variant_id ?? null,
      product_name: a.product_name ?? null,
      variant_name: a.variant_name ?? null,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "ls-get-subscription" },
    });
    return null;
  }
}

/**
 * Recent invoices for a subscription (newest first, capped at 12). Returns []
 * on failure or when LS has none.
 */
export async function getLSSubscriptionInvoices(
  subscriptionId: string,
): Promise<LSInvoice[]> {
  setupLemonsqueezy();
  try {
    const { data, error } = await listSubscriptionInvoices({
      filter: { subscriptionId },
    });
    if (error || !data?.data) return [];
    return data.data.slice(0, 12).map((row) => {
      const a = row.attributes as typeof row.attributes & {
        urls?: { invoice_url?: string | null };
      };
      return {
        id: String(row.id),
        created_at: a.created_at,
        total_formatted: a.total_formatted,
        status: a.status,
        invoice_url: a.urls?.invoice_url ?? null,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "ls-list-invoices" },
    });
    return [];
  }
}

/**
 * Cancel a subscription at period end. Returns when access actually ends so the
 * caller can reflect it immediately.
 */
export async function cancelLSSubscription(
  subscriptionId: string,
): Promise<{ success: boolean; ends_at: string | null }> {
  setupLemonsqueezy();
  try {
    const { data, error } = await cancelSubscription(subscriptionId);
    if (error || !data?.data) return { success: false, ends_at: null };
    return { success: true, ends_at: data.data.attributes.ends_at ?? null };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "ls-cancel-subscription" },
    });
    return { success: false, ends_at: null };
  }
}

/**
 * Pause billing (استراحة) instead of cancelling. mode "void" suspends both
 * charges and access until resumes_at; LS auto-resumes billing then. This is
 * the churn-deflection primitive: ~25% of would-be cancellers take a pause
 * where offered, and ~75% of pausers return.
 */
export async function pauseLSSubscription(
  subscriptionId: string,
  resumesAtIso: string,
): Promise<{ success: boolean }> {
  setupLemonsqueezy();
  try {
    const { error } = await updateSubscription(subscriptionId, {
      pause: { mode: "void", resumesAt: resumesAtIso },
    });
    return { success: !error };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "ls-pause-subscription" },
    });
    return { success: false };
  }
}

/** Lift a pause immediately («عدتُ مبكراً») — billing resumes on LS's side. */
export async function resumeLSSubscription(
  subscriptionId: string,
): Promise<{ success: boolean }> {
  setupLemonsqueezy();
  try {
    const { error } = await updateSubscription(subscriptionId, {
      pause: null,
    });
    return { success: !error };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "ls-resume-subscription" },
    });
    return { success: false };
  }
}

/**
 * Change an existing subscription's tier by swapping its variant. LS handles
 * proration + any SCA re-auth. Used for active subscribers (trial/new users go
 * through checkout instead).
 */
export async function changeLSSubscriptionTier(
  subscriptionId: string,
  variantId: string,
): Promise<{ success: boolean }> {
  setupLemonsqueezy();
  try {
    const { error } = await updateSubscription(subscriptionId, {
      variantId: Number(variantId),
    });
    return { success: !error };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "ls-update-subscription" },
    });
    return { success: false };
  }
}
