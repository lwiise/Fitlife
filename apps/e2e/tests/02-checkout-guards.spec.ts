/**
 * The checkout endpoint's refusals.
 *
 * These matter commercially, not just defensively: the 409 below is what stops a
 * customer ending up with TWO live LemonSqueezy subscriptions, where the second
 * keeps billing while our single row points at the newer one — an orphaned charge
 * the UI cannot cancel.
 *
 * Only the 409 is tagged @billing. The 401 and 400 cases are reached before the
 * route touches LemonSqueezy at all — the auth check and the zod body schema both
 * run first — so they stay in the default run and keep covering the endpoint
 * while the payment phase is deferred.
 */

import type { APIRequestContext } from "@playwright/test";
import {
  BILLING_TAG,
  expect,
  freshAccount,
  postWebhook,
  requireWebhookSecret,
  signedInApiContext,
  test,
  verifies,
} from "../src/fixtures.js";
import { admin, waitFor } from "../src/supabase.js";
import type { TestAccount } from "../src/accounts.js";
import { PLAN_CADENCE, PLAN_TIER, PLAN_VARIANT_ID } from "../src/scenario.js";
import { newLsSubscriptionId, subscriptionCreatedPayload } from "../src/lemonsqueezy.js";

test.describe("Checkout guards", () => {
  test("an anonymous request cannot start a checkout", async ({ request }) => {
    verifies(
      "POST /api/checkout without a session returns 401 — no checkout is created for a " +
        "visitor who is not signed in.",
    );

    const res = await request.post("/api/checkout", {
      data: { tier: PLAN_TIER, cadence: PLAN_CADENCE },
    });
    expect(res.status()).toBe(401);
  });

  test("a malformed tier is rejected", async ({ browser, cfg }) => {
    verifies(
      "The zod body schema rejects an unknown tier with 400, so an arbitrary variant can " +
        "never be pushed through checkout from the client.",
    );

    const account = await freshAccount("checkout-badbody");
    const ctx = await openApi(browser, cfg.baseUrl, account);
    try {
      const res = await ctx.request.post("/api/checkout", {
        data: { tier: "enterprise", cadence: PLAN_CADENCE },
      });
      expect(res.status()).toBe(400);
    } finally {
      await ctx.close();
    }
  });

  test("an already-subscribed customer cannot start a second checkout", {
    tag: BILLING_TAG,
  }, async ({ browser, cfg }) => {
    verifies(
      "With a live LemonSqueezy subscription, /api/checkout returns 409 and directs the " +
        "customer to change plan instead — preventing a duplicate, uncancellable charge.",
    );

    const account = await freshAccount("checkout-duplicate");
    const ctx = await openApi(browser, cfg.baseUrl, account);
    try {
      const payload = subscriptionCreatedPayload({
        lsSubscriptionId: newLsSubscriptionId(),
        userId: account.userId,
        tier: PLAN_TIER,
        cadence: PLAN_CADENCE,
        variantId: PLAN_VARIANT_ID,
      });
      expect(
        (await postWebhook(ctx.request, payload, requireWebhookSecret(cfg))).status(),
      ).toBe(200);

      await waitFor("subscription to become active", async () => {
        const { data } = await admin()
          .from("subscriptions")
          .select("status")
          .eq("user_id", account.userId)
          .single();
        return data?.status === "active" ? data : null;
      });

      const res = await ctx.request.post("/api/checkout", {
        data: { tier: "premium", cadence: PLAN_CADENCE },
      });
      expect(res.status()).toBe(409);
      expect((await res.json()).error).toContain("اشتراك نشط");
    } finally {
      await ctx.close();
    }
  });
});

async function openApi(
  browser: import("@playwright/test").Browser,
  baseUrl: string,
  account: TestAccount,
): Promise<{ request: APIRequestContext; close: () => Promise<void> }> {
  return signedInApiContext(browser, baseUrl, account.email, account.password);
}
