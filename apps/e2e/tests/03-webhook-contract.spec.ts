/**
 * The payment webhook is the only thing that can grant or revoke paid access, and
 * it is a PUBLIC endpoint. Its signature check is therefore a security boundary,
 * and its status mapping decides whether a paying family keeps their plan.
 *
 * Every event here is signed with the app's real secret and sent to the real
 * route — no module is stubbed.
 */

import { expect, test, verifies, freshAccount, postWebhook } from "../src/fixtures.js";
import { admin, waitFor } from "../src/supabase.js";
import { PLAN_CADENCE, PLAN_TIER, PLAN_VARIANT_ID } from "../src/scenario.js";
import {
  isoInDays,
  lifecyclePayload,
  newLsSubscriptionId,
  paymentFailedPayload,
  subscriptionCreatedPayload,
} from "../src/lemonsqueezy.js";

async function subscriptionRow(userId: string) {
  const { data, error } = await admin()
    .from("subscriptions")
    .select("status, tier, cadence, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data as {
    status: string;
    tier: string;
    cadence: string | null;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  };
}

test.describe("LemonSqueezy webhook contract", () => {
  test("an unsigned request cannot grant paid access", async ({ request, cfg }) => {
    verifies(
      "A forged webhook with a wrong signature is rejected with 401 and does NOT activate " +
        "the subscription — otherwise anyone could grant themselves a paid plan.",
    );

    const account = await freshAccount("webhook-forged");
    const payload = subscriptionCreatedPayload({
      lsSubscriptionId: newLsSubscriptionId(),
      userId: account.userId,
      tier: PLAN_TIER,
      cadence: PLAN_CADENCE,
      variantId: PLAN_VARIANT_ID,
    });

    const forged = await postWebhook(request, payload, cfg.webhookSecret, {
      signature: "0".repeat(64),
    });
    expect(forged.status()).toBe(401);

    // Unchanged: still the seeded trial, never activated.
    const row = await subscriptionRow(account.userId);
    expect(row.status).toBe("trialing");
    expect(row.tier).toBe("starter");
  });

  test("a tampered body invalidates the signature", async ({ request, cfg }) => {
    verifies(
      "The HMAC covers the RAW body: signing one payload and sending a modified one " +
        "(escalated to the premium tier) is rejected with 401.",
    );

    const account = await freshAccount("webhook-tampered");
    const honest = subscriptionCreatedPayload({
      lsSubscriptionId: newLsSubscriptionId(),
      userId: account.userId,
      tier: PLAN_TIER,
      cadence: PLAN_CADENCE,
      variantId: PLAN_VARIANT_ID,
    });
    const tampered = honest.replace(`"tier":"${PLAN_TIER}"`, '"tier":"premium"');
    expect(tampered).not.toBe(honest);

    // Signature computed over the honest body, tampered body transmitted.
    const { signWebhook } = await import("../src/lemonsqueezy.js");
    const res = await postWebhook(request, tampered, cfg.webhookSecret, {
      signature: signWebhook(honest, cfg.webhookSecret),
    });
    expect(res.status()).toBe(401);

    expect((await subscriptionRow(account.userId)).status).toBe("trialing");
  });

  test("a failed renewal moves the family to past_due", async ({ request, cfg }) => {
    verifies(
      "subscription_payment_failed sets status past_due — distinct from cancelled, because " +
        "the customer can recover by updating their card.",
    );

    const account = await freshAccount("webhook-pastdue");
    const lsSubscriptionId = newLsSubscriptionId();
    const base = {
      lsSubscriptionId,
      userId: account.userId,
      tier: PLAN_TIER,
      cadence: PLAN_CADENCE,
      variantId: PLAN_VARIANT_ID,
    };

    expect(
      (await postWebhook(request, subscriptionCreatedPayload(base), cfg.webhookSecret)).status(),
    ).toBe(200);
    await waitFor("activation", async () =>
      (await subscriptionRow(account.userId)).status === "active" ? true : null,
    );

    expect(
      (await postWebhook(request, paymentFailedPayload(base), cfg.webhookSecret)).status(),
    ).toBe(200);
    expect((await subscriptionRow(account.userId)).status).toBe("past_due");
  });

  test("cancelling keeps access until the paid-through date", async ({ request, cfg }) => {
    verifies(
      "subscription_cancelled only flags cancel_at_period_end; the row stays 'active' so a " +
        "family that cancels mid-month keeps the plan they paid for.",
    );

    const account = await freshAccount("webhook-cancel");
    const lsSubscriptionId = newLsSubscriptionId();
    const base = {
      lsSubscriptionId,
      userId: account.userId,
      tier: PLAN_TIER,
      cadence: PLAN_CADENCE,
      variantId: PLAN_VARIANT_ID,
      renewsAt: isoInDays(21),
    };

    await postWebhook(request, subscriptionCreatedPayload(base), cfg.webhookSecret);
    await waitFor("activation", async () =>
      (await subscriptionRow(account.userId)).status === "active" ? true : null,
    );

    const res = await postWebhook(
      request,
      lifecyclePayload("subscription_cancelled", { ...base, cancelled: true }),
      cfg.webhookSecret,
    );
    expect(res.status()).toBe(200);

    const row = await subscriptionRow(account.userId);
    expect(row.status).toBe("active");
    expect(row.cancel_at_period_end).toBe(true);
    expect(new Date(row.current_period_end as string).getTime()).toBeGreaterThan(Date.now());
  });

  test("expiry ends paid access", async ({ request, cfg }) => {
    verifies(
      "subscription_expired sets status 'expired', which isSubscriptionActive() treats as " +
        "no access — the family loses plan generation but keeps their history.",
    );

    const account = await freshAccount("webhook-expired");
    const base = {
      lsSubscriptionId: newLsSubscriptionId(),
      userId: account.userId,
      tier: PLAN_TIER,
      cadence: PLAN_CADENCE,
      variantId: PLAN_VARIANT_ID,
    };

    await postWebhook(request, subscriptionCreatedPayload(base), cfg.webhookSecret);
    await waitFor("activation", async () =>
      (await subscriptionRow(account.userId)).status === "active" ? true : null,
    );

    await postWebhook(request, lifecyclePayload("subscription_expired", base), cfg.webhookSecret);
    expect((await subscriptionRow(account.userId)).status).toBe("expired");
  });

  test("an unknown event is acknowledged without changing state", async ({ request, cfg }) => {
    verifies(
      "An unhandled but validly-signed event returns 200 (so LemonSqueezy stops retrying) " +
        "and leaves the subscription untouched.",
    );

    const account = await freshAccount("webhook-unknown");
    const before = await subscriptionRow(account.userId);

    const res = await postWebhook(
      request,
      lifecyclePayload("subscription_plan_changed_to_something_new", {
        lsSubscriptionId: newLsSubscriptionId(),
        userId: account.userId,
        tier: PLAN_TIER,
        cadence: PLAN_CADENCE,
        variantId: PLAN_VARIANT_ID,
      }),
      cfg.webhookSecret,
    );
    expect(res.status()).toBe(200);

    const after = await subscriptionRow(account.userId);
    expect(after.status).toBe(before.status);
    expect(after.tier).toBe(before.tier);
  });
});
