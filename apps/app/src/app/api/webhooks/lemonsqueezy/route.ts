import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLemonsqueezyWebhookSecret } from "@/lib/env";
import { getTierCadenceByVariantId } from "@fitlife/config";
import { mapLemonsqueezyStatus } from "./mapping";

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
    // When the change happened on LemonSqueezy's side. Drives the ordering
    // guard — see applyUpdate.
    updated_at?: string;
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
  // Drives the replay / out-of-order guard in applyUpdate. Only trusted when it
  // parses — a malformed value must not silently disable the guard's bookkeeping.
  const eventUpdatedAt =
    attrs.updated_at && !Number.isNaN(Date.parse(attrs.updated_at))
      ? attrs.updated_at
      : undefined;

  const admin = createAdminClient();

  // Apply an update to the user's subscription row. Prefer user_id (carried in
  // checkout custom_data, present on all subscription events) and fall back to
  // the LS subscription id. This also lets a payment_success event activate the
  // subscription even if subscription_created was missed.
  //
  // BUT a user_id match alone is too broad once a user has had more than one LS
  // subscription. We hold ONE row per user, so a late or out-of-order event
  // about a SUPERSEDED subscription would overwrite the current paid one: cancel
  // A, re-subscribe as B, then three weeks later A reaches its original period
  // end and subscription_expired for A — carrying the same custom_data.user_id —
  // writes status='expired' over B. The customer is billed for B every month and
  // has no access at all. The same clobbering applies to any duplicate or
  // out-of-order payment_failed / cancelled event for a dead subscription.
  //
  // So: when the event names a subscription AND our row already names a
  // DIFFERENT one, the event is about history. Ignore it. The user_id path stays
  // for the case its comment protects — a row that has no LS id yet because
  // subscription_created was missed.
  //
  // `takeover` is the exception, and it is what makes re-subscribing work:
  // subscription_created and payment_success are precisely the events by which a
  // NEW subscription claims the row, so they must be allowed to re-point it.
  // Without that carve-out this guard would reject every second subscription a
  // customer ever buys.
  /** True when our row already names some LemonSqueezy subscription. */
  async function rowHoldsASubscription(): Promise<boolean> {
    if (!userId) return false;
    const { data } = await admin
      .from("subscriptions")
      .select("lemonsqueezy_subscription_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<{ lemonsqueezy_subscription_id: string | null }[]>();
    return !!data?.[0]?.lemonsqueezy_subscription_id;
  }

  async function applyUpdate(
    update: Record<string, unknown>,
    opts?: { takeover?: boolean },
  ) {
    // ORDERING GUARD. Webhook delivery is at-least-once and unordered, so a
    // delayed or retried event about an EARLIER state can land after a later
    // one and undo it — a subscription_updated with status='active' arriving
    // after subscription_expired silently un-expires a dead subscription, and
    // a replayed payment_failed re-marks a recovered one past_due. LemonSqueezy
    // sends no event id, but attributes.updated_at is the moment the change
    // happened on their side, so anything at or before what we last applied is
    // stale by definition. Events without the field are applied as before.
    if (userId && eventUpdatedAt) {
      const { data: seen } = await admin
        .from("subscriptions")
        .select("last_event_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<{ last_event_at: string | null }[]>();
      const lastApplied = seen?.[0]?.last_event_at;
      if (lastApplied && Date.parse(eventUpdatedAt) <= Date.parse(lastApplied)) {
        console.warn("[lemonsqueezy-webhook] ignoring stale/replayed event", {
          eventName,
          eventUpdatedAt,
          lastApplied,
          userId,
        });
        return { error: null };
      }
      update.last_event_at = eventUpdatedAt;
    }

    if (userId && lsSubscriptionId && !opts?.takeover) {
      const { data: existing } = await admin
        .from("subscriptions")
        .select("lemonsqueezy_subscription_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<{ lemonsqueezy_subscription_id: string | null }[]>();
      const held = existing?.[0]?.lemonsqueezy_subscription_id ?? null;
      if (held && held !== lsSubscriptionId) {
        console.warn("[lemonsqueezy-webhook] ignoring event for a superseded subscription", {
          eventName,
          eventSubscription: lsSubscriptionId,
          rowHolds: held,
          userId,
        });
        return { error: null };
      }
    }
    // 00024 adds unique(user_id), so `.eq("user_id", …)` now names exactly one
    // row. Before it, this update had no limit and stamped EVERY row a user
    // held, while the supersession guard above inspected only the newest — so
    // the read path and the write path disagreed the moment a second row
    // existed. Keeping the scope explicit documents the invariant the guard
    // already relies on.
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
        //
        // TIER/CADENCE come from the VARIANT first and custom_data only as a
        // fallback. custom_data is frozen at the original checkout, but
        // /api/subscription/change swaps the variant on the EXISTING
        // LemonSqueezy subscription and cannot rewrite it — so a renewal
        // invoice carrying the old custom_data used to stamp the OLD tier back
        // onto the row. A customer who upgraded to `family` was billed for
        // family and, one billing cycle later, silently put back on `starter`,
        // which then tripped the person-count gate.
        const resolvedFromVariant =
          attrs.variant_id != null
            ? getTierCadenceByVariantId(attrs.variant_id)
            : null;
        const tier = resolvedFromVariant?.tier ?? payload.meta.custom_data?.tier;
        const cadence =
          resolvedFromVariant?.cadence ??
          (payload.meta.custom_data?.cadence as
            | "monthly"
            | "annual"
            | undefined);

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

        // Claiming the row is how a NEW subscription takes over from a dead one.
        // subscription_created always earns that. payment_success does NOT
        // earn it unconditionally: unlike created, it also fires for RENEWALS
        // of an old subscription, so a delayed or retried renewal invoice for a
        // superseded subscription could re-point the row at it and overwrite
        // the tier the customer is actually paying for. It may claim only a row
        // that names no subscription yet — the "subscription_created was
        // missed" case the carve-out exists for.
        const takeover =
          eventName === "subscription_created" || !(await rowHoldsASubscription());
        const { error } = await applyUpdate(update, { takeover });
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
        if (attrs.ends_at) update.ends_at = attrs.ends_at;
        if (mapped) update.status = mapped;
        // Resolve TIER as well as cadence from the variant id — a plan change
        // made outside our app (the
        // LemonSqueezy customer portal, which subscription/page.tsx links to,
        // or a merchant-side upgrade) moved the customer's cadence and price
        // while leaving `tier` untouched. A family→starter downgrade kept
        // getTierLimit at 6, so the household went on generating six members'
        // plans — six times the AI cost — on a 1-person subscription, and the
        // page displayed a price they were not being charged. The reverse
        // blocked a paying premium customer at 6 people.
        if (attrs.variant_id != null) {
          const resolved = getTierCadenceByVariantId(attrs.variant_id);
          if (resolved) {
            // All three together, or none: a partial write is what let tier and
            // cadence disagree in the first place.
            update.tier = resolved.tier;
            update.cadence = resolved.cadence;
            update.lemonsqueezy_variant_id = String(attrs.variant_id);
          }
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

      // Authoritative confirmation of the pause flow (/api/subscription/pause
      // mirrors optimistically; these events are the source of truth).
      case "subscription_paused": {
        const update: Record<string, unknown> = { status: "paused" };
        if (attrs.renews_at) {
          update.current_period_end = attrs.renews_at;
          update.ends_at = attrs.renews_at;
        }
        const { error } = await applyUpdate(update);
        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_paused failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, lsSubscriptionId });
        break;
      }

      case "subscription_unpaused":
      case "subscription_resumed": {
        const update: Record<string, unknown> = { status: "active", ends_at: null };
        if (attrs.renews_at) update.current_period_end = attrs.renews_at;
        const { error } = await applyUpdate(update);
        if (error) {
          console.error("[lemonsqueezy-webhook] subscription_unpaused failed", error);
          return new NextResponse(null, { status: 500 });
        }
        console.log("[lemonsqueezy-webhook]", { eventName, lsSubscriptionId });
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
