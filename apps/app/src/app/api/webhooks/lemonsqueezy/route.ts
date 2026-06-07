import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLemonsqueezyWebhookSecret } from "@/lib/env";
import { mapLemonsqueezyStatus, deriveCadence } from "./mapping";

export const runtime = "nodejs";

interface WebhookCustomData {
  user_id?: string;
  tier?: string;
  cadence?: string;
}

interface WebhookData {
  id: string;
  type: string;
  attributes: {
    status?: string;
    customer_id?: number | string;
    variant_id?: number | string;
    renews_at?: string | null;
    ends_at?: string | null;
    cancelled?: boolean;
    // Present on subscription-invoices (payment_success / payment_failed events)
    subscription_id?: number | string;
  };
}

interface WebhookPayload {
  meta: {
    event_name: string;
    custom_data?: WebhookCustomData;
  };
  data: WebhookData;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * POST /api/webhooks/lemonsqueezy
 *
 * Public endpoint — verifies HMAC signature before any DB writes.
 * Uses the service-role Supabase client (bypasses RLS) because LS doesn't
 * authenticate as a user.
 *
 * Always returns 200 on valid signatures (even for unhandled events) so LS
 * doesn't retry. Returns 401 on signature mismatch. Returns 500 on DB errors
 * so LS retries.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-signature") ?? "";

  let secret: string;
  try {
    secret = getLemonsqueezyWebhookSecret();
  } catch {
    console.error("[lemonsqueezy-webhook] secret env var not configured");
    return new NextResponse(null, { status: 500 });
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (!safeEqual(signatureHeader, computed)) {
    return new NextResponse(null, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  const attrs = payload.data?.attributes;

  if (!eventName || !payload.data || !attrs) {
    console.error("[lemonsqueezy-webhook] malformed payload", { eventName });
    return new NextResponse(null, { status: 200 });
  }

  // For subscription-invoices events (payment_success / payment_failed), the
  // real subscription id is at attributes.subscription_id; data.id is the
  // INVOICE id. For subscription events, data.id IS the subscription id.
  const isInvoiceEvent = payload.data.type === "subscription-invoices";
  const lsSubscriptionId = isInvoiceEvent
    ? attrs.subscription_id != null
      ? String(attrs.subscription_id)
      : null
    : String(payload.data.id);

  const userId = payload.meta.custom_data?.user_id;
  const customerId =
    attrs.customer_id != null ? String(attrs.customer_id) : undefined;

  const admin = createAdminClient();

  // Apply an update to the user's subscription row. Prefer user_id (carried in
  // checkout custom_data, present on all subscription events) and fall back to
  // the LS subscription id. This also lets a payment_success event activate the
  // subscription even if subscription_created was missed.
  async function applyUpdate(update: Record<string, unknown>) {
    const q = admin.from("subscriptions").update(update);
    return userId
      ? await q.eq("user_id", userId)
      : await q.eq("lemonsqueezy_subscription_id", lsSubscriptionId ?? "");
  }

  try {
    switch (eventName) {
      case "subscription_created":
      case "subscription_payment_success": {
        // Both fully activate the subscription. created carries variant + renews_at;
        // payment_success (invoice) does not, so only set fields we actually have.
        const tier = payload.meta.custom_data?.tier;
        const cadence =
          (payload.meta.custom_data?.cadence as
            | "monthly"
            | "annual"
            | undefined) ??
          (attrs.variant_id != null
            ? (deriveCadence(attrs.variant_id) ?? undefined)
            : undefined);

        const update: Record<string, unknown> = {
          status: "active",
          cancel_at_period_end: false,
        };
        if (lsSubscriptionId) update.lemonsqueezy_subscription_id = lsSubscriptionId;
        if (customerId) update.lemonsqueezy_customer_id = customerId;
        if (attrs.variant_id != null)
          update.lemonsqueezy_variant_id = String(attrs.variant_id);
        if (attrs.renews_at) update.current_period_end = attrs.renews_at;
        if (tier) update.tier = tier;
        if (cadence) update.cadence = cadence;

        const { error } = await applyUpdate(
          update,
        );
        if (error) {
          console.error("[lemonsqueezy-webhook] activate failed", { eventName, error });
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", {
          eventName,
          lsSubscriptionId,
          userId,
          status: "active",
        });
        break;
      }

      case "subscription_updated": {
        const mapped = mapLemonsqueezyStatus(attrs.status ?? "");
        const update: Record<string, unknown> = {
          cancel_at_period_end: !!attrs.cancelled,
        };
        if (attrs.renews_at) update.current_period_end = attrs.renews_at;
        if (mapped) update.status = mapped;
        if (attrs.variant_id != null) {
          const dc = deriveCadence(attrs.variant_id);
          if (dc) update.cadence = dc;
        }

        const { error } = await applyUpdate(
          update,
        );
        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_updated failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, lsSubscriptionId, status: mapped });
        break;
      }

      case "subscription_cancelled": {
        // Sub remains 'active' until current_period_end; just flag the intent.
        const { error } = await applyUpdate({
          cancel_at_period_end: true,
        });
        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_cancelled failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, lsSubscriptionId });
        break;
      }

      case "subscription_expired": {
        const { error } = await applyUpdate({
          status: "expired",
        });
        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_expired failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, lsSubscriptionId });
        break;
      }

      case "subscription_payment_failed": {
        const { error } = await applyUpdate({
          status: "past_due",
        });
        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_payment_failed failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, lsSubscriptionId });
        break;
      }

      default:
        // Unknown event — ack with 200 so LS doesn't retry.
        console.log("[lemonsqueezy-webhook] unhandled event", { eventName });
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[lemonsqueezy-webhook] unexpected error", err);
    // Never pass the raw body, signature, or secret to Sentry.
    Sentry.captureException(err, {
      tags: { area: "lemonsqueezy-webhook", event_name: eventName },
      extra: { subscription_id: lsSubscriptionId },
    });
    return new NextResponse(null, { status: 500 });
  }
}
