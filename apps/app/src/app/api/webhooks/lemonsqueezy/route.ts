import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLemonsqueezyWebhookSecret } from "@/lib/env";

export const runtime = "nodejs";

interface WebhookCustomData {
  user_id?: string;
  tier?: string;
  cadence?: string;
}

interface WebhookData {
  id: string;
  attributes: {
    status: string;
    customer_id: number | string;
    variant_id: number | string;
    renews_at: string | null;
    ends_at: string | null;
    cancelled: boolean;
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

function mapLemonsqueezyStatus(
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

function deriveCadence(
  variantId: string | number,
): "monthly" | "annual" | null {
  const id = String(variantId);
  const monthly = ["1677645", "1677648", "1677653", "1677655"];
  const annual = ["1677781", "1677755", "1677675", "1677749"];
  if (monthly.includes(id)) return "monthly";
  if (annual.includes(id)) return "annual";
  return null;
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
  const subscriptionId = payload.data?.id;
  const attrs = payload.data?.attributes;

  if (!eventName || !subscriptionId || !attrs) {
    console.error("[lemonsqueezy-webhook] malformed payload", { eventName });
    return new NextResponse(null, { status: 200 });
  }

  const admin = createAdminClient();

  try {
    switch (eventName) {
      case "subscription_created": {
        const userId = payload.meta.custom_data?.user_id;
        const tier = payload.meta.custom_data?.tier;
        const cadenceFromCustom = payload.meta.custom_data?.cadence;
        const cadence =
          (cadenceFromCustom as "monthly" | "annual" | undefined) ??
          deriveCadence(attrs.variant_id) ??
          undefined;

        if (!userId) {
          console.error("[lemonsqueezy-webhook] subscription_created missing user_id custom data", { subscriptionId });
          return new NextResponse(null, { status: 200 });
        }

        const update: Record<string, unknown> = {
          status: mapLemonsqueezyStatus(attrs.status) ?? "active",
          lemonsqueezy_subscription_id: String(subscriptionId),
          lemonsqueezy_customer_id: String(attrs.customer_id),
          lemonsqueezy_variant_id: String(attrs.variant_id),
          current_period_end: attrs.renews_at,
          cancel_at_period_end: false,
        };
        if (tier) update.tier = tier;
        if (cadence) update.cadence = cadence;

        const { error } = await admin
          .from("subscriptions")
          .update(update)
          .eq("user_id", userId);

        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_created update failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, subscriptionId, userId, status: update.status });
        break;
      }

      case "subscription_updated": {
        const mapped = mapLemonsqueezyStatus(attrs.status);
        const update: Record<string, unknown> = {
          current_period_end: attrs.renews_at,
          cancel_at_period_end: !!attrs.cancelled,
        };
        if (mapped) update.status = mapped;
        const derivedCadence = deriveCadence(attrs.variant_id);
        if (derivedCadence) update.cadence = derivedCadence;

        const { error } = await admin
          .from("subscriptions")
          .update(update)
          .eq("lemonsqueezy_subscription_id", String(subscriptionId));

        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_updated failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, subscriptionId, status: mapped });
        break;
      }

      case "subscription_cancelled": {
        // Sub remains 'active' until current_period_end; just flag the intent.
        const { error } = await admin
          .from("subscriptions")
          .update({ cancel_at_period_end: true })
          .eq("lemonsqueezy_subscription_id", String(subscriptionId));

        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_cancelled failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, subscriptionId });
        break;
      }

      case "subscription_expired": {
        const { error } = await admin
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("lemonsqueezy_subscription_id", String(subscriptionId));

        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_expired failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, subscriptionId });
        break;
      }

      case "subscription_payment_success": {
        const { error } = await admin
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: attrs.renews_at,
          })
          .eq("lemonsqueezy_subscription_id", String(subscriptionId));

        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_payment_success failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, subscriptionId, renews_at: attrs.renews_at });
        break;
      }

      case "subscription_payment_failed": {
        const { error } = await admin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("lemonsqueezy_subscription_id", String(subscriptionId));

        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_payment_failed failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, subscriptionId });
        break;
      }

      default:
        // Unknown event — ack with 200 so LS doesn't retry.
        console.log("[lemonsqueezy-webhook] unhandled event", { eventName, subscriptionId });
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[lemonsqueezy-webhook] unexpected error", err);
    return new NextResponse(null, { status: 500 });
  }
}
