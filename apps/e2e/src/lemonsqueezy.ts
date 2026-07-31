/**
 * LemonSqueezy sandbox helpers.
 *
 * Payment in this app is a hosted redirect: `/api/checkout` mints a checkout URL,
 * the customer pays on LemonSqueezy's own page, and the subscription only becomes
 * `active` when LemonSqueezy POSTs an HMAC-signed webhook back to
 * `/api/webhooks/lemonsqueezy`. That webhook is the ONLY thing that flips our row
 * to active, so a faithful, deterministic payment test signs a real webhook with
 * the app's real secret and sends it to the real route — no mocks, no stubbed
 * modules, and the app's own signature verification stands between us and it.
 *
 * Nothing here can produce a charge: no card is ever submitted, and the variant
 * ids are guarded as test-mode by `guards.assertSandboxVariant`.
 */

import { createHmac, randomInt } from "node:crypto";

export const WEBHOOK_PATH = "/api/webhooks/lemonsqueezy";

/**
 * Exactly mirrors the route's verification: hex HMAC-SHA256 over the RAW body.
 * The body must be transmitted byte-for-byte as signed, so callers pass this
 * string straight to the request — never a re-serialized object.
 */
export function signWebhook(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export interface SubscriptionEventInput {
  lsSubscriptionId: string;
  userId: string;
  tier: string;
  cadence: string;
  variantId: string;
  customerId?: string;
  /** ISO timestamp the subscription next renews / is paid through. */
  renewsAt?: string;
  status?: string;
  cancelled?: boolean;
}

/** `subscription_created` — the event that activates a fresh purchase. */
export function subscriptionCreatedPayload(input: SubscriptionEventInput): string {
  return JSON.stringify({
    meta: {
      event_name: "subscription_created",
      custom_data: {
        user_id: input.userId,
        tier: input.tier,
        cadence: input.cadence,
      },
    },
    data: {
      id: input.lsSubscriptionId,
      type: "subscriptions",
      attributes: {
        status: input.status ?? "active",
        customer_id: input.customerId ?? "e2e-customer-1",
        variant_id: input.variantId,
        renews_at: input.renewsAt ?? isoInDays(30),
        cancelled: false,
      },
    },
  });
}

/**
 * `subscription_payment_success` — an INVOICE event. Its `data.id` is the invoice
 * id and the real subscription id lives at `attributes.subscription_id`; the route
 * has a dedicated branch for that, which this exercises.
 */
export function paymentSuccessPayload(
  input: SubscriptionEventInput & { invoiceId?: string },
): string {
  return JSON.stringify({
    meta: {
      event_name: "subscription_payment_success",
      custom_data: {
        user_id: input.userId,
        tier: input.tier,
        cadence: input.cadence,
      },
    },
    data: {
      id: input.invoiceId ?? "e2e-invoice-1",
      type: "subscription-invoices",
      attributes: {
        status: "paid",
        subscription_id: input.lsSubscriptionId,
        customer_id: input.customerId ?? "e2e-customer-1",
      },
    },
  });
}

/** Generic subscription lifecycle event (`subscription_updated`, `_expired`, …). */
export function lifecyclePayload(
  eventName: string,
  input: SubscriptionEventInput,
): string {
  return JSON.stringify({
    meta: {
      event_name: eventName,
      custom_data: {
        user_id: input.userId,
        tier: input.tier,
        cadence: input.cadence,
      },
    },
    data: {
      id: input.lsSubscriptionId,
      type: "subscriptions",
      attributes: {
        status: input.status ?? "active",
        customer_id: input.customerId ?? "e2e-customer-1",
        variant_id: input.variantId,
        renews_at: input.renewsAt ?? isoInDays(30),
        cancelled: input.cancelled ?? false,
      },
    },
  });
}

/** `subscription_payment_failed` — also an invoice event; drives status → past_due. */
export function paymentFailedPayload(input: SubscriptionEventInput): string {
  return JSON.stringify({
    meta: {
      event_name: "subscription_payment_failed",
      custom_data: { user_id: input.userId },
    },
    data: {
      id: "e2e-invoice-failed-1",
      type: "subscription-invoices",
      attributes: {
        status: "failed",
        subscription_id: input.lsSubscriptionId,
      },
    },
  });
}

export function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * A synthetic LemonSqueezy subscription id.
 *
 * Must be unique WITHIN a run, not just across runs: the webhook route falls back
 * to `lemonsqueezy_subscription_id` when no user id is carried, so two accounts
 * sharing an id would make that lookup ambiguous and could update the wrong row.
 * A timestamp alone is not enough — several accounts are created inside the same
 * millisecond — so a process-lifetime counter guarantees uniqueness and the random
 * block keeps ids from being guessable across runs.
 */
let subscriptionIdCounter = 0;

export function newLsSubscriptionId(): string {
  const counter = String(++subscriptionIdCounter).padStart(4, "0");
  const random = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // LS ids are numeric strings; the leading 9 keeps the shape realistic while
  // staying obviously synthetic.
  return `9${Date.now().toString().slice(-8)}${counter}${random}`;
}

export interface VariantPrice {
  variantId: string;
  /** Price in the store's minor units (cents/halalas) as LemonSqueezy reports it. */
  priceMinorUnits: number | null;
  name: string | null;
  isSubscription: boolean | null;
  /** LemonSqueezy marks test-mode objects explicitly; null when not reported. */
  testMode: boolean | null;
}

/**
 * Read the variant back from the LemonSqueezy API so the "correct amount"
 * assertion is checked against the payment provider, not only against our own
 * pricing config. Optional: skipped when no API key is configured.
 */
export async function fetchVariant(
  variantId: string,
  apiKey: string,
): Promise<VariantPrice> {
  const res = await fetch(`https://api.lemonsqueezy.com/v1/variants/${variantId}`, {
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(
      `LemonSqueezy variant lookup failed (${res.status}) for variant ${variantId}: ${await res.text()}`,
    );
  }
  const body = (await res.json()) as {
    data?: {
      attributes?: {
        price?: number;
        name?: string;
        is_subscription?: boolean;
        test_mode?: boolean;
      };
    };
  };
  const attrs = body.data?.attributes ?? {};
  return {
    variantId,
    priceMinorUnits: attrs.price ?? null,
    name: attrs.name ?? null,
    isSubscription: attrs.is_subscription ?? null,
    testMode: attrs.test_mode ?? null,
  };
}
