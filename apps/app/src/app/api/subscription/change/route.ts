import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { getVariantId } from "@fitlife/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { setupLemonsqueezy } from "@/lib/lemonsqueezy/client";
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

  // ── Existing subscriber: swap the variant in place (no double-billing) ──
  if (sub?.lemonsqueezy_subscription_id) {
    if (sub.tier === parsed.tier && sub.cadence === parsed.cadence) {
      return NextResponse.json({ error: "أنتِ على هذه الخطة" }, { status: 400 });
    }

    const { success } = await changeLSSubscriptionTier(
      sub.lemonsqueezy_subscription_id,
      variantId,
    );
    if (!success) {
      return NextResponse.json(
        { error: "تعذّر تغيير الخطة. حاولي بعد قليل" },
        { status: 502 },
      );
    }

    // Optimistic DB update so the UI reflects the new tier right away; the
    // subscription_updated webhook reconciles period dates later (idempotent).
    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({
        tier: parsed.tier,
        cadence: parsed.cadence,
        lemonsqueezy_variant_id: variantId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id)
      .eq("user_id", user.id);

    return NextResponse.json({ updated: true }, { status: 200 });
  }

  // ── Trial / new user: first-time subscription via checkout ──
  setupLemonsqueezy();
  const storeId = getLemonsqueezyStoreId();
  const origin =
    request.headers.get("origin") ??
    new URL(request.url).origin ??
    env.NEXT_PUBLIC_APP_URL;

  try {
    const response = await createCheckout(storeId, variantId, {
      checkoutOptions: { embed: false, media: false, logo: true },
      checkoutData: {
        email: user.email ?? undefined,
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
      return NextResponse.json(
        { error: "حدث خطأ في تجهيز الدفع. حاولي مرة ثانية" },
        { status: 502 },
      );
    }
    return NextResponse.json({ checkout_url: checkoutUrl }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "subscription-change-checkout", userId: user.id },
    });
    return NextResponse.json(
      { error: "حدث خطأ في تجهيز الدفع. حاولي مرة ثانية" },
      { status: 502 },
    );
  }
}
