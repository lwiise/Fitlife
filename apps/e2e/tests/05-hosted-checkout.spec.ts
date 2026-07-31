/**
 * Opt-in: complete the payment on LemonSqueezy's own hosted checkout page with a
 * test card, in a real browser.
 *
 * Off by default (`E2E_LIVE_CHECKOUT=1` to enable) for one reason: this leg drives
 * a third-party page whose markup we do not control and cannot pin. Making it part
 * of the default run would trade a deterministic suite for one that goes red when
 * LemonSqueezy restyles a form. The default run still proves the same contract —
 * checkout session created for the right test-mode variant, and activation via the
 * signed webhook — using surfaces this repo owns.
 *
 * No real charge is possible: the variant is asserted test-mode before the page is
 * opened, and 4242 4242 4242 4242 is the standard test card (LemonSqueezy settles
 * through Stripe).
 */

import {
  BILLING_TAG,
  expect,
  freshAccount,
  signedInApiContext,
  test,
  verifies,
} from "../src/fixtures.js";
import { admin, waitFor } from "../src/supabase.js";
import { assertSandboxVariant } from "../src/guards.js";
import { addFamilyMembers, completeMomProfile, markOnboardingComplete } from "../src/family.js";
import { PLAN_CADENCE, PLAN_TIER, PLAN_VARIANT_ID } from "../src/scenario.js";

/** Stripe's universal test card — declined in live mode, always approved in test mode. */
const TEST_CARD = "4242424242424242";
const TEST_EXPIRY = "12/34";
const TEST_CVC = "123";

test.describe("Hosted checkout (opt-in)", { tag: BILLING_TAG }, () => {
  // Two gates, deliberately: the payment phase must be re-enabled at all, AND
  // this third-party browser leg opted into separately.
  test.skip(
    process.env.E2E_LIVE_CHECKOUT !== "1",
    "Set E2E_LIVE_CHECKOUT=1 (with E2E_INCLUDE_BILLING=1) to drive LemonSqueezy's hosted " +
      "checkout page with a test card.",
  );
  test.setTimeout(180_000);

  test("a family pays with a test card and the subscription activates", async ({
    page,
    browser,
    cfg,
  }) => {
    verifies(
      "The full sandbox payment: hosted LemonSqueezy checkout completed with test card " +
        "4242 4242 4242 4242, redirect back to the app, and the subscription reported active.",
    );

    assertSandboxVariant(PLAN_VARIANT_ID);

    const account = await freshAccount("hosted-checkout");
    await completeMomProfile(account.accessToken, account.userId);
    await addFamilyMembers(account.accessToken, account.userId);
    await markOnboardingComplete(account.accessToken, account.userId);

    const ctx = await signedInApiContext(browser, cfg.baseUrl, account.email, account.password);
    let checkoutUrl: string;
    try {
      const res = await ctx.request.post("/api/checkout", {
        data: { tier: PLAN_TIER, cadence: PLAN_CADENCE },
      });
      const body = (await res.json()) as { checkout_url?: string; error?: string; debug?: string };
      expect(res.status(), `checkout failed: ${body.error ?? ""} ${body.debug ?? ""}`).toBe(200);
      checkoutUrl = body.checkout_url!;
    } finally {
      await ctx.close();
    }

    // Sign the browser page in too, so the post-payment redirect lands on a
    // session-bearing /dashboard rather than bouncing to the login screen.
    await test.step("sign in the browser session", async () => {
      const { signInViaForm } = await import("../src/ui.js");
      await signInViaForm(page, { email: account.email, password: account.password });
    });

    await test.step("open the hosted checkout", async () => {
      await page.goto(checkoutUrl, { waitUntil: "domcontentloaded" });
      // LemonSqueezy watermarks non-live checkouts. If this is missing, stop:
      // it may not be a test-mode store.
      await expect(
        page.getByText(/test mode/i).first(),
        "LemonSqueezy did not mark this checkout as test mode — refusing to enter card details",
      ).toBeVisible({ timeout: 30_000 });
    });

    await test.step("pay with the test card", async () => {
      await page.getByRole("textbox", { name: /email/i }).first().fill(account.email);

      // Card fields are rendered inside Stripe iframes; resolve them by frame.
      const cardNumber = page
        .frameLocator('iframe[title*="card number" i], iframe[name*="cardNumber" i]')
        .locator('input[name="cardnumber"], input[name="number"]')
        .first();
      await cardNumber.fill(TEST_CARD);

      const expiry = page
        .frameLocator('iframe[title*="expiration" i], iframe[name*="cardExpiry" i]')
        .locator('input[name="exp-date"], input[name="expiry"]')
        .first();
      await expiry.fill(TEST_EXPIRY);

      const cvc = page
        .frameLocator('iframe[title*="CVC" i], iframe[name*="cardCvc" i]')
        .locator('input[name="cvc"]')
        .first();
      await cvc.fill(TEST_CVC);

      await page.getByRole("button", { name: /pay|subscribe|اشترك/i }).first().click();
    });

    await test.step("land back in the app", async () => {
      await page.waitForURL(/\/dashboard\?checkout=success/, { timeout: 120_000 });
    });

    await waitFor(
      "subscription to activate from the real LemonSqueezy webhook",
      async () => {
        const { data } = await admin()
          .from("subscriptions")
          .select("status, tier, cadence, lemonsqueezy_subscription_id")
          .eq("user_id", account.userId)
          .single();
        return data?.status === "active" ? data : null;
      },
      { timeoutMs: 120_000, intervalMs: 2_000 },
    );

    const { data } = await admin()
      .from("subscriptions")
      .select("status, tier, cadence, lemonsqueezy_subscription_id")
      .eq("user_id", account.userId)
      .single();

    expect(data).toMatchObject({ status: "active", tier: PLAN_TIER, cadence: PLAN_CADENCE });
    expect(data?.lemonsqueezy_subscription_id).toBeTruthy();
  });
});
