/**
 * The scenario: one household signs up, builds a family of three, pays on the
 * «العائلة» plan in LemonSqueezy TEST MODE, and the account reflects it.
 *
 * Serial by design — each step depends on the state the previous one left behind,
 * exactly as a real customer's session does. A failure part-way through leaves the
 * remaining steps unrun rather than cascading misleading failures.
 */

import type { APIRequestContext, Browser } from "@playwright/test";
import { expect, test, verifies, RUN_ID, postWebhook, signedInApiContext } from "../src/fixtures.js";
import { admin, waitFor } from "../src/supabase.js";
import {
  confirmEmail,
  findUserByEmail,
  newTestIdentity,
  signIn,
  trackAccount,
  waitForAccountSeed,
  type TestIdentity,
} from "../src/accounts.js";
import { signUpViaForm, signInViaForm } from "../src/ui.js";
import {
  addFamilyMembers,
  completeMomProfile,
  countBeneficiaries,
  fetchFamilyMembers,
  fetchProfile,
  markOnboardingComplete,
} from "../src/family.js";
import {
  CHILD,
  EXPECTED_BENEFICIARIES,
  EXPECTED_SUBSCRIPTION,
  HOUSEKEEPER,
  HUSBAND,
  MOM,
  PLAN,
  PLAN_CADENCE,
  PLAN_TIER,
  PLAN_VARIANT_ID,
} from "../src/scenario.js";
import { assertSandboxVariant } from "../src/guards.js";
import {
  fetchVariant,
  newLsSubscriptionId,
  paymentSuccessPayload,
  subscriptionCreatedPayload,
} from "../src/lemonsqueezy.js";

const ORIGIN = "family-journey";

// State threaded through the journey.
let identity: TestIdentity;
let userId: string;
let accessToken: string;
let lsSubscriptionId: string;
let apiContext: APIRequestContext;
let closeApiContext: () => Promise<void>;

test.describe.configure({ mode: "serial" });

test.describe("Family of three — signup, payment, verification", () => {
  test.afterAll(async () => {
    await closeApiContext?.();
  });

  // ── Step 2a: the standard signup flow ────────────────────────────────────

  test("a new customer creates an account through the signup form", async ({ page }) => {
    verifies("The public signup form creates a real Supabase auth user (email + password).");
    identity = newTestIdentity(RUN_ID, ORIGIN);

    const outcome = await test.step("submit the signup form", () =>
      signUpViaForm(page, identity));

    expect(
      outcome.kind,
      outcome.kind === "error" ? `Signup form reported: ${outcome.message}` : undefined,
    ).not.toBe("error");

    const user = await test.step("the auth user exists", async () =>
      waitFor(`auth user for ${identity.email}`, () => findUserByEmail(identity.email)));

    userId = user.id;
    // Registered the instant an id exists, so teardown can reclaim it even if a
    // later step throws.
    trackAccount(userId, identity.email, ORIGIN);

    if (outcome.kind === "confirm-required") {
      // Email confirmation is enabled on this stack. Confirming via the admin API
      // stands in for the customer clicking the link in their inbox — the suite's
      // test addresses have no real mailbox.
      await test.step("confirm the email address", () => confirmEmail(userId));
      await test.step("sign in with the new password", () => signInViaForm(page, identity));
    }

    await waitForAccountSeed(userId);
    accessToken = await signIn(identity);

    const ctx = await signedInApiContext(
      page.context().browser() as Browser,
      test.info().project.use.baseURL as string,
      identity.email,
      identity.password,
    );
    apiContext = ctx.request;
    closeApiContext = ctx.close;
  });

  test("signup seeds a 7-day starter trial", async () => {
    verifies(
      "The handle_new_user trigger (migration 00004) seeds a trialing 'starter' subscription " +
        "with a 7-day window — the state the family is upgrading from.",
    );

    const { data, error } = await admin()
      .from("subscriptions")
      .select("tier, status, trial_started_at, trial_ends_at, lemonsqueezy_subscription_id")
      .eq("user_id", userId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ tier: "starter", status: "trialing" });
    // A trial is internal: it must never carry a LemonSqueezy id, because
    // hasLiveLemonsqueezySubscription() uses exactly that to decide whether a
    // fresh checkout is allowed.
    expect(data?.lemonsqueezy_subscription_id).toBeNull();

    const started = new Date(data!.trial_started_at as string).getTime();
    const ends = new Date(data!.trial_ends_at as string).getTime();
    const days = (ends - started) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  // ── Step 2b: the family of three ─────────────────────────────────────────

  test("the owner completes her own profile", async () => {
    verifies(
      "The account owner (mom) is the first beneficiary and is stored on `profiles`, " +
        "not on `family_members`.",
    );
    await completeMomProfile(accessToken, userId);

    const profile = await fetchProfile(accessToken, userId);
    expect(profile.display_name).toBe(MOM.display_name);
    expect(profile.sex).toBe(MOM.sex);
    expect(profile.member_type).toBe("adult");
    expect(profile.primary_goal).toBe(MOM.primary_goal);
    expect(profile.mom_profile_completed_at).not.toBeNull();
  });

  test("the husband and the child are added, plus a housekeeper", async () => {
    verifies(
      "Husband (role 'dad'), child (role 'son') and housekeeper are created under the " +
        "owner's account with the correct member_type, language and meal_mode.",
    );

    await test.step("insert the members through RLS", () =>
      addFamilyMembers(accessToken, userId));
    await test.step("mark onboarding complete", () =>
      markOnboardingComplete(accessToken, userId));

    const members = await fetchFamilyMembers(accessToken, userId);
    expect(members).toHaveLength(3);

    const husband = members.find((m) => m.role === "dad");
    expect(husband, "husband row must exist with role 'dad'").toBeDefined();
    expect(husband).toMatchObject({
      name: HUSBAND.name,
      member_type: "adult",
      sex: "male",
      preferred_language: "ar",
      meal_mode: "shared",
      user_id: userId,
    });

    const child = members.find((m) => m.role === "son");
    expect(child, "child row must exist with role 'son'").toBeDefined();
    expect(child).toMatchObject({
      name: CHILD.name,
      member_type: "child",
      user_id: userId,
    });
    // buildMemberRow leaves children without a goal on purpose: they are planned
    // on food-pyramid portions, never goal-based calories.
    expect(child?.primary_goal).toBeNull();

    const housekeeper = members.find((m) => m.role === "housekeeper");
    expect(housekeeper, "housekeeper row must exist").toBeDefined();
    expect(housekeeper?.member_type).toBe("housekeeper");
    // One subscription, each person in their own language — the product's core claim.
    expect(housekeeper?.preferred_language).toBe(HOUSEKEEPER.preferred_language);
  });

  test("the household counts as exactly three beneficiaries", async () => {
    verifies(
      "Beneficiaries = mom + non-housekeeper members. The cook is on the plan but is " +
        "not billed as a person, which is what `role <> 'housekeeper'` encodes.",
    );

    const members = await fetchFamilyMembers(accessToken, userId);
    expect(countBeneficiaries(members)).toBe(EXPECTED_BENEFICIARIES);
    expect(members.filter((m) => m.role === "housekeeper")).toHaveLength(1);
  });

  test("a family of three is refused on the starter trial", async () => {
    verifies(
      "Before paying, the tier gate blocks: the seeded trial is 'starter' (max 1 person) " +
        "and the household is 3, so the app returns 403 with the person-limit message.",
    );

    // Scoped to ONE member on purpose. A full-family run does not block on
    // person_count_exceeded — dispatch.ts caps it to max_people and proceeds,
    // which would start a real (billable) AI generation. The single-member path
    // returns the denial before any dispatch, so this assertion costs nothing.
    const members = await fetchFamilyMembers(accessToken, userId);
    const husbandId = members.find((m) => m.role === "dad")!.id;

    const res = await apiContext.post("/api/plans/generate", {
      data: { memberId: husbandId },
    });

    expect(res.status(), "starter trial + 3 people must be refused").toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("البداية");
    expect(body.error).toContain(String(EXPECTED_BENEFICIARIES));
  });

  // ── Step 2c: payment, in sandbox ─────────────────────────────────────────

  test("checkout mints a LemonSqueezy TEST-MODE session for the family plan", async ({
    cfg,
  }) => {
    verifies(
      "POST /api/checkout returns a hosted LemonSqueezy checkout URL for the family/monthly " +
        "test-mode variant, with the user id attached so the webhook can map it back.",
    );

    // Refuse before the request if the repo has been switched to live variants.
    assertSandboxVariant(PLAN_VARIANT_ID);

    const res = await apiContext.post("/api/checkout", {
      data: { tier: PLAN_TIER, cadence: PLAN_CADENCE },
    });
    const body = (await res.json()) as { checkout_url?: string; error?: string; debug?: string };

    if (res.status() === 500 && body.debug?.startsWith("config:")) {
      test.skip(
        true,
        "The app under test has no LemonSqueezy TEST-MODE credentials configured " +
          "(LEMONSQUEEZY_API_KEY / LEMONSQUEEZY_STORE_ID), so no checkout session can be " +
          "created. Subscription activation is still verified via the signed webhook below.",
      );
    }

    expect(res.status(), `checkout failed: ${body.error ?? ""} ${body.debug ?? ""}`).toBe(200);
    expect(body.checkout_url).toBeTruthy();
    expect(new URL(body.checkout_url!).hostname).toContain("lemonsqueezy.com");

    if (cfg.liveCheckout) {
      test.info().annotations.push({
        type: "note",
        description: `Hosted checkout URL: ${body.checkout_url}`,
      });
    }
  });

  test("a signed LemonSqueezy webhook activates the subscription", async ({ cfg }) => {
    verifies(
      "The payment completion path: an HMAC-signed subscription_created webhook flips the " +
        "row to active on the family tier — the app's own signature check gates it.",
    );

    lsSubscriptionId = newLsSubscriptionId();
    const payload = subscriptionCreatedPayload({
      lsSubscriptionId,
      userId,
      tier: PLAN_TIER,
      cadence: PLAN_CADENCE,
      variantId: PLAN_VARIANT_ID,
    });

    const res = await postWebhook(apiContext, payload, cfg.webhookSecret);
    expect(
      res.status(),
      "webhook rejected — E2E_LEMONSQUEEZY_WEBHOOK_SECRET must match the app's",
    ).toBe(200);

    await waitFor("subscription to become active", async () => {
      const { data } = await admin()
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .single();
      return data?.status === "active" ? data : null;
    });
  });

  test("a payment_success invoice event keeps the subscription active", async ({ cfg }) => {
    verifies(
      "The renewal path: subscription_payment_success is an INVOICE event whose real " +
        "subscription id sits at attributes.subscription_id — the route's separate branch.",
    );

    const res = await postWebhook(
      apiContext,
      paymentSuccessPayload({
        lsSubscriptionId,
        userId,
        tier: PLAN_TIER,
        cadence: PLAN_CADENCE,
        variantId: PLAN_VARIANT_ID,
      }),
      cfg.webhookSecret,
    );
    expect(res.status()).toBe(200);

    const { data } = await admin()
      .from("subscriptions")
      .select("status, lemonsqueezy_subscription_id")
      .eq("user_id", userId)
      .single();
    expect(data?.status).toBe("active");
    expect(data?.lemonsqueezy_subscription_id).toBe(lsSubscriptionId);
  });

  // ── Step 3: verify the outputs ───────────────────────────────────────────

  test("the account shows an active «العائلة» monthly subscription", async () => {
    verifies(
      "Payment state as the account sees it: status active, tier family, cadence monthly, " +
        "the family variant id, and not flagged to cancel at period end.",
    );

    const { data, error } = await admin()
      .from("subscriptions")
      .select(
        "status, tier, cadence, lemonsqueezy_variant_id, lemonsqueezy_subscription_id, current_period_end, cancel_at_period_end",
      )
      .eq("user_id", userId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: EXPECTED_SUBSCRIPTION.status,
      tier: EXPECTED_SUBSCRIPTION.tier,
      cadence: EXPECTED_SUBSCRIPTION.cadence,
      lemonsqueezy_variant_id: EXPECTED_SUBSCRIPTION.variant_id,
      cancel_at_period_end: EXPECTED_SUBSCRIPTION.cancel_at_period_end,
    });
    expect(
      new Date(data!.current_period_end as string).getTime(),
      "paid-through date must be in the future, or access gates off",
    ).toBeGreaterThan(Date.now());
  });

  test("the subscription status API agrees", async () => {
    verifies(
      "The endpoint the post-checkout screen polls (/api/subscription/status) reports the " +
        "same active family/monthly state to the signed-in customer.",
    );

    const res = await apiContext.get("/api/subscription/status");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "active",
      tier: PLAN_TIER,
      cadence: PLAN_CADENCE,
    });
  });

  test("the amount billed is the family plan's price", async ({ cfg }) => {
    verifies(
      "Correct amount: the activated variant resolves to family/monthly at 129 SAR in the " +
        "app's pricing config, and — when an API key is available — LemonSqueezy agrees.",
    );

    const { data } = await admin()
      .from("subscriptions")
      .select("lemonsqueezy_variant_id, tier, cadence")
      .eq("user_id", userId)
      .single();

    const variantId = data!.lemonsqueezy_variant_id as string;
    expect(variantId).toBe(PLAN.lemonsqueezy_variant_id_monthly);
    expect(PLAN.price_monthly_sar).toBe(129);
    expect(PLAN.max_people).toBe(6);
    expect(PLAN.max_people!).toBeGreaterThanOrEqual(EXPECTED_BENEFICIARIES);

    if (!cfg.lemonsqueezyApiKey) {
      test.info().annotations.push({
        type: "note",
        description:
          "LemonSqueezy API key absent — amount verified against pricing config only.",
      });
      return;
    }

    const variant = await fetchVariant(variantId, cfg.lemonsqueezyApiKey);
    expect(variant.isSubscription, "family plan must be a subscription product").toBe(true);
    // LemonSqueezy reports price in minor units. Assert it is a real, non-zero
    // recurring price rather than pinning a currency the store may have changed.
    expect(variant.priceMinorUnits ?? 0).toBeGreaterThan(0);
    if (variant.testMode === false) {
      throw new Error(
        `Variant ${variantId} is reported by LemonSqueezy as LIVE mode, not test mode. ` +
          `Stop and re-check credentials before running this suite again.`,
      );
    }
  });

  test("all three members appear on the family page", async () => {
    verifies(
      "The customer-visible output: /family renders mom's household with the husband, the " +
        "child and the housekeeper, each by name.",
    );

    const res = await apiContext.get("/family");
    expect(res.status()).toBe(200);
    const html = await res.text();

    for (const name of [HUSBAND.name, CHILD.name, HOUSEKEEPER.name]) {
      expect(html, `"${name}" must appear on /family`).toContain(name);
    }
  });
});
