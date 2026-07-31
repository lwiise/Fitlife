import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { getVariantId } from "@fitlife/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentSubscription,
  getTierLimit,
  hasLiveLemonsqueezySubscription,
} from "@/lib/subscription/state";
import { countBeneficiaries } from "@/lib/subscription/access";
import {
  setupLemonsqueezy,
  describeLsError,
} from "@/lib/lemonsqueezy/client";
import { changeLSSubscriptionTier } from "@/lib/lemonsqueezy/subscription";
import { env, getLemonsqueezyStoreId } from "@/lib/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  tier: z.enum(["starter", "pro", "family", "premium"]),
  cadence: z.enum(["monthly", "annual"]),
});

/**
 * POST /api/subscription/change — change the user's tier.
 *
 * Existing subscriber → updateSubscription (LS handles proration + SCA), returns
 * { updated: true }. Trial/new user (no LS subscription) → createCheckout,
 * returns { checkout_url } for the client to redirect to.
 *
 * Failure responses return the Arabic message ONLY — the former `debug` string
 * (rendered by ChangePlanSection) exposed which branch ran, the LemonSqueezy
 * rejection and the variant ID to the subscriber. Each failure path already
 * console.errors that detail, so removing it cost no diagnosability.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const sub = await getCurrentSubscription(user.id);
  const variantId = getVariantId(parsed.tier, parsed.cadence);

  // A downgrade must not strand members. Nothing used to check this: a family
  // of six could move to `starter` (max 1), LemonSqueezy would prorate, and
  // from then on the person-count gate denied every generation — including a
  // plain regenerate for mom — while all six stayed visible in the UI. The
  // household was billed correctly and the product simply stopped working,
  // with no warning at the moment of the decision.
  //
  // Checked BEFORE calling LemonSqueezy, so a refusal costs nothing.
  const targetMax = getTierLimit(parsed.tier);
  if (targetMax !== null) {
    const current = await countBeneficiaries(user.id);
    if (current === null) {
      return NextResponse.json(
        { error: "تعذّر التحقق من عدد أفراد عائلتك. يرجى المحاولة بعد قليل" },
        { status: 503 },
      );
    }
    if (current > targetMax) {
      const surplus = current - targetMax;
      return NextResponse.json(
        {
          error:
            `هذه الباقة تكفي ${targetMax} ${targetMax === 1 ? "فرد" : "أفراد"}، ` +
            `وعائلتك ${current}. احذفي ${surplus} ${surplus === 1 ? "فرداً" : "أفراد"} ` +
            `من صفحة العائلة أولاً ثم غيّري الباقة.`,
        },
        { status: 409 },
      );
    }
  }

  // ── Existing subscriber: swap the variant in place (no double-billing) ──
  //
  // Gated on hasLiveLemonsqueezySubscription, not merely on the id being
  // present. A cancelled or expired row keeps its subscription id, so this
  // branch used to fire for those users and try to mutate a DEAD LemonSqueezy
  // subscription — a 502 and no way back to paying. /api/checkout draws the
  // same line (it excludes 'cancelled' precisely so they can re-subscribe), so
  // they now fall through to the checkout branch below.
  if (sub?.lemonsqueezy_subscription_id && hasLiveLemonsqueezySubscription(sub)) {
    if (sub.tier === parsed.tier && sub.cadence === parsed.cadence) {
      return NextResponse.json({ error: "هذه خطتك الحالية بالفعل" }, { status: 400 });
    }

    const { success, errorDetail } = await changeLSSubscriptionTier(
      sub.lemonsqueezy_subscription_id,
      variantId,
    );
    if (!success) {
      console.error("[subscription/change] LS update failed", {
        lsSubscriptionId: sub.lemonsqueezy_subscription_id,
        variantId,
        errorDetail: errorDetail ?? null,
      });
      return NextResponse.json(
        {
          error: "تعذّر تغيير الخطة. يرجى المحاولة بعد قليل",
        },
        { status: 502 },
      );
    }

    // Optimistic DB update so the UI reflects the new tier right away; the
    // subscription_updated webhook reconciles period dates later (idempotent).
    //
    // The error is READ. LemonSqueezy has already changed the plan and prorated
    // the charge by this point, so a silently-failed write leaves the customer
    // billed for the new tier and served the old one — while the route reports
    // {updated: true}. Surfacing it turns that into a visible, retryable
    // failure (the LS side is idempotent, so a retry re-syncs).
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        tier: parsed.tier,
        cadence: parsed.cadence,
        lemonsqueezy_variant_id: variantId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id)
      .eq("user_id", user.id);

    if (updateError) {
      Sentry.captureException(
        new Error("Tier changed at LemonSqueezy but not written to our row"),
        {
          tags: { area: "subscription-change", userId: user.id },
          extra: { message: updateError.message, code: updateError.code },
        },
      );
      return NextResponse.json(
        { error: "تم تغيير الباقة، لكن تعذّر تحديث حسابك. يرجى تحديث الصفحة بعد قليل" },
        { status: 502 },
      );
    }

    return NextResponse.json({ updated: true }, { status: 200 });
  }

  // ── Trial / new user: first-time subscription via checkout ──
  let storeId: string;
  try {
    setupLemonsqueezy();
    storeId = getLemonsqueezyStoreId();
  } catch (err) {
    console.error(
      "[subscription/change] LemonSqueezy env missing (LEMONSQUEEZY_API_KEY / LEMONSQUEEZY_STORE_ID):",
      describeLsError(err),
    );
    return NextResponse.json(
      {
        error: "حدث خطأ في تجهيز الدفع. يرجى المحاولة مرة أخرى",
      },
      { status: 500 },
    );
  }
  const origin =
    request.headers.get("origin") ??
    new URL(request.url).origin ??
    env.NEXT_PUBLIC_APP_URL;

  try {
    const response = await createCheckout(storeId, variantId, {
      checkoutOptions: { embed: false, media: false, logo: true },
      // No email prefill — see /api/checkout: LS 422s the whole checkout on
      // emails it can't validate (nonexistent domains); the hosted page
      // collects one itself and custom.user_id does the webhook mapping.
      checkoutData: {
        custom: {
          user_id: user.id,
          tier: parsed.tier,
          cadence: parsed.cadence,
        },
      },
      productOptions: {
        redirectUrl: `${origin}/subscription?changed=success`,
      },
    });

    const checkoutUrl = response?.data?.data?.attributes?.url;
    if (!checkoutUrl) {
      // The SDK doesn't throw on API rejection — surface the reason in the
      // function logs (same treatment as /api/checkout).
      console.error("[subscription/change] LS did not return a checkout URL", {
        tier: parsed.tier,
        cadence: parsed.cadence,
        variantId,
        statusCode: response?.statusCode ?? null,
        lsError: response?.error ?? null,
      });
      return NextResponse.json(
        {
          error: "حدث خطأ في تجهيز الدفع. يرجى المحاولة مرة أخرى",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ checkout_url: checkoutUrl }, { status: 200 });
  } catch (err) {
    console.error("[subscription/change] LS error:", describeLsError(err));
    Sentry.captureException(err, {
      tags: { area: "subscription-change-checkout", userId: user.id },
    });
    return NextResponse.json(
      {
        error: "حدث خطأ في تجهيز الدفع. يرجى المحاولة مرة أخرى",
      },
      { status: 502 },
    );
  }
}
