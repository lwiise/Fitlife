/**
 * Multi-tenancy and account-level outputs.
 *
 * This is a household product: every row is scoped to one account, and the whole
 * model rests on RLS holding. These tests build two unrelated families and check
 * that neither can see the other, then verify the account's own outputs (data
 * export) and the tier boundary for the «العائلة» plan.
 */

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
import { anon, asUser, admin, waitFor } from "../src/supabase.js";
import {
  addFamilyMembers,
  addMember,
  completeMomProfile,
  countBeneficiaries,
  fetchFamilyMembers,
  markOnboardingComplete,
} from "../src/family.js";
import {
  CHILD,
  EXPECTED_BENEFICIARIES,
  HOUSEKEEPER,
  HUSBAND,
  MOM,
  PLAN,
  PLAN_CADENCE,
  PLAN_TIER,
  PLAN_VARIANT_ID,
  type MemberSpec,
} from "../src/scenario.js";
import { newLsSubscriptionId, subscriptionCreatedPayload } from "../src/lemonsqueezy.js";

test.describe("Account integrity", () => {
  test("one family cannot read another family's members", async () => {
    verifies(
      "RLS isolation: with a valid session, a second account reads zero rows of the first " +
        "account's family — the guarantee the whole household model depends on.",
    );

    const houseA = await freshAccount("isolation-a");
    const houseB = await freshAccount("isolation-b");

    await completeMomProfile(houseA.accessToken, houseA.userId);
    await addFamilyMembers(houseA.accessToken, houseA.userId);

    const ownView = await fetchFamilyMembers(houseA.accessToken, houseA.userId);
    expect(ownView, "the owner sees her own family").toHaveLength(3);

    // House B asks for House A's rows explicitly. RLS must return nothing.
    const { data: crossRead, error } = await asUser(houseB.accessToken)
      .from("family_members")
      .select("*")
      .eq("user_id", houseA.userId);
    expect(error).toBeNull();
    expect(crossRead ?? [], "another account must see none of these rows").toHaveLength(0);

    // And an anonymous client must see nothing at all.
    const { data: anonRead } = await anon().from("family_members").select("*");
    expect(anonRead ?? []).toHaveLength(0);
  });

  test("one family cannot write into another family's household", async () => {
    verifies(
      "RLS on INSERT: an account cannot create a family member under a different user_id, " +
        "so no one can inflate or tamper with someone else's household.",
    );

    const houseA = await freshAccount("isolation-write-a");
    const houseB = await freshAccount("isolation-write-b");

    const { error } = await asUser(houseB.accessToken).from("family_members").insert({
      user_id: houseA.userId,
      name: "دخيل",
      role: "other_adult",
      member_type: "adult",
      preferred_language: "ar",
      display_order: 99,
    });

    expect(error, "the insert must be refused by RLS").not.toBeNull();

    const rows = await fetchFamilyMembers(houseA.accessToken, houseA.userId);
    expect(rows).toHaveLength(0);
  });

  test("the data export contains the household the customer built", async ({ browser, cfg }) => {
    verifies(
      "PDPL portability output: /api/account/export returns the owner's profile and all " +
        "three family members, with internal billing identifiers stripped.",
    );

    const account = await freshAccount("export");
    await completeMomProfile(account.accessToken, account.userId);
    await addFamilyMembers(account.accessToken, account.userId);
    await markOnboardingComplete(account.accessToken, account.userId);

    const ctx = await signedInApiContext(
      browser,
      cfg.baseUrl,
      account.email,
      account.password,
    );
    try {
      const res = await ctx.request.get("/api/account/export");
      expect(res.status()).toBe(200);

      const body = (await res.json()) as {
        profile?: { display_name?: string } | null;
        family_members?: { name: string; role: string }[];
        subscription?: Record<string, unknown> | null;
      };

      expect(body.profile?.display_name).toBe(MOM.display_name);
      expect(body.family_members ?? []).toHaveLength(3);
      expect((body.family_members ?? []).map((m) => m.role).sort()).toEqual(
        ["dad", "housekeeper", "son"],
      );
      expect((body.family_members ?? []).map((m) => m.name)).toEqual(
        expect.arrayContaining([HUSBAND.name, CHILD.name, HOUSEKEEPER.name]),
      );

      // Billing identifiers are the company's records, not the customer's data.
      if (body.subscription) {
        expect(body.subscription).not.toHaveProperty("lemonsqueezy_subscription_id");
        expect(body.subscription).not.toHaveProperty("lemonsqueezy_customer_id");
      }
    } finally {
      await ctx.close();
    }
  });

  // Needs a paid family subscription to exist, so it belongs to the deferred
  // phase. The trial-tier refusal in 01 keeps the person-limit gate covered in
  // the meantime.
  test("the family plan covers three people and refuses a seventh", {
    tag: BILLING_TAG,
  }, async ({ browser, cfg }) => {
    verifies(
      "The «العائلة» tier's max_people is 6: a household of three is comfortably covered, " +
        "and a seventh beneficiary is refused with the person-limit message.",
    );

    const account = await freshAccount("tier-boundary");
    await completeMomProfile(account.accessToken, account.userId);
    await addFamilyMembers(account.accessToken, account.userId);
    await markOnboardingComplete(account.accessToken, account.userId);

    const ctx = await signedInApiContext(
      browser,
      cfg.baseUrl,
      account.email,
      account.password,
    );
    try {
      // Activate the family plan in sandbox.
      await postWebhook(
        ctx.request,
        subscriptionCreatedPayload({
          lsSubscriptionId: newLsSubscriptionId(),
          userId: account.userId,
          tier: PLAN_TIER,
          cadence: PLAN_CADENCE,
          variantId: PLAN_VARIANT_ID,
        }),
        requireWebhookSecret(cfg),
      );
      await waitFor("activation", async () => {
        const { data } = await admin()
          .from("subscriptions")
          .select("status")
          .eq("user_id", account.userId)
          .single();
        return data?.status === "active" ? data : null;
      });

      // Three beneficiaries, six allowed.
      const covered = await fetchFamilyMembers(account.accessToken, account.userId);
      expect(countBeneficiaries(covered)).toBe(EXPECTED_BENEFICIARIES);
      expect(PLAN.max_people).toBe(6);
      expect(countBeneficiaries(covered)).toBeLessThanOrEqual(PLAN.max_people!);

      // Push past the tier: mom + 6 members = 7 beneficiaries.
      const extras: MemberSpec[] = Array.from({ length: 4 }, (_, i) => ({
        ...HUSBAND,
        name: `ضيف ${i + 1}`,
        role: "other_adult" as const,
      }));
      for (const [i, spec] of extras.entries()) {
        await addMember(account.accessToken, account.userId, spec, 10 + i);
      }

      const over = await fetchFamilyMembers(account.accessToken, account.userId);
      expect(countBeneficiaries(over)).toBe(7);

      // Single-member scope: refused before dispatch, so no AI generation is
      // started and no tokens are spent.
      const memberId = over.find((m) => m.role === "dad")!.id;
      const res = await ctx.request.post("/api/plans/generate", { data: { memberId } });

      expect(res.status()).toBe(403);
      const error = (await res.json()).error as string;
      expect(error).toContain("العائلة");
      expect(error).toContain("6");
      expect(error).toContain("7");
    } finally {
      await ctx.close();
    }
  });
});
