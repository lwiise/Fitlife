import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isoInDays,
  lifecyclePayload,
  newLsSubscriptionId,
  paymentFailedPayload,
  paymentSuccessPayload,
  signWebhook,
  subscriptionCreatedPayload,
} from "./lemonsqueezy.js";

const SECRET = "test-webhook-secret";
const BASE = {
  lsSubscriptionId: "123456",
  userId: "11111111-2222-3333-4444-555555555555",
  tier: "family",
  cadence: "monthly",
  variantId: "1677653",
};

describe("webhook signing", () => {
  it("matches the algorithm the route verifies with", () => {
    const body = subscriptionCreatedPayload(BASE);
    const expected = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(signWebhook(body, SECRET)).toBe(expected);
  });

  it("produces a 64-char hex digest the route can hex-decode", () => {
    const signature = signWebhook("{}", SECRET);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    // The route does Buffer.from(sig, "hex") on both sides before timingSafeEqual,
    // so a digest of the wrong length would fail the length check, not crash.
    expect(Buffer.from(signature, "hex")).toHaveLength(32);
  });

  it("changes when a single byte of the body changes", () => {
    const honest = subscriptionCreatedPayload(BASE);
    const tampered = honest.replace('"tier":"family"', '"tier":"premium"');
    expect(tampered).not.toBe(honest);
    expect(signWebhook(tampered, SECRET)).not.toBe(signWebhook(honest, SECRET));
  });

  it("changes when the secret changes", () => {
    const body = subscriptionCreatedPayload(BASE);
    expect(signWebhook(body, SECRET)).not.toBe(signWebhook(body, "other-secret"));
  });
});

describe("payload shapes", () => {
  it("subscription_created carries the ids the route maps on", () => {
    const payload = JSON.parse(subscriptionCreatedPayload(BASE));
    expect(payload.meta.event_name).toBe("subscription_created");
    expect(payload.meta.custom_data).toMatchObject({
      user_id: BASE.userId,
      tier: "family",
      cadence: "monthly",
    });
    // For subscription events the route reads data.id AS the subscription id.
    expect(payload.data.id).toBe(BASE.lsSubscriptionId);
    expect(payload.data.type).toBe("subscriptions");
    expect(payload.data.attributes.status).toBe("active");
    expect(payload.data.attributes.variant_id).toBe(BASE.variantId);
    expect(new Date(payload.data.attributes.renews_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("payment_success is an invoice event with the subscription id nested", () => {
    const payload = JSON.parse(paymentSuccessPayload(BASE));
    expect(payload.data.type).toBe("subscription-invoices");
    // The route's isInvoiceEvent branch: data.id is the INVOICE, the real
    // subscription id lives at attributes.subscription_id.
    expect(payload.data.id).not.toBe(BASE.lsSubscriptionId);
    expect(payload.data.attributes.subscription_id).toBe(BASE.lsSubscriptionId);
  });

  it("payment_failed is also an invoice event", () => {
    const payload = JSON.parse(paymentFailedPayload(BASE));
    expect(payload.meta.event_name).toBe("subscription_payment_failed");
    expect(payload.data.type).toBe("subscription-invoices");
    expect(payload.data.attributes.subscription_id).toBe(BASE.lsSubscriptionId);
  });

  it("lifecycle events carry the cancelled flag", () => {
    const payload = JSON.parse(
      lifecyclePayload("subscription_cancelled", { ...BASE, cancelled: true }),
    );
    expect(payload.meta.event_name).toBe("subscription_cancelled");
    expect(payload.data.attributes.cancelled).toBe(true);
  });
});

describe("identifiers", () => {
  it("mints numeric ids that never collide within a run", () => {
    // Generated in a tight loop on purpose: several accounts really are created
    // inside the same millisecond, and a duplicate id would make the webhook
    // route's fallback lookup ambiguous.
    const ids = Array.from({ length: 5_000 }, () => newLsSubscriptionId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^9\d+$/);
  });

  it("isoInDays returns a future ISO timestamp", () => {
    const iso = isoInDays(30);
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now());
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
