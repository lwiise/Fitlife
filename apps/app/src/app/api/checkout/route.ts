import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentSubscription,
  hasLiveLemonsqueezySubscription,
} from "@/lib/subscription/state";
import { env, getLemonsqueezyStoreId } from "@/lib/env";
import { setupLemonsqueezy } from "@/lib/lemonsqueezy/client";
import { getVariantId } from "@fitlife/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  tier: z.enum(["starter", "pro", "family", "premium"]),
  cadence: z.enum(["monthly", "annual"]),
});

/**
 * POST /api/checkout
 *
 * Auth-required. Body: { tier, cadence }.
 * Creates a Lemonsqueezy checkout session for the requested variant and
 * returns its hosted-checkout URL. The client redirects to that URL.
 *
 * The user's id is attached as `custom.user_id` so the webhook handler
 * can map the resulting subscription back to a row in our DB.
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
    const body = await request.json();
    parsed = bodySchema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "طلب غير صالح" },
      { status: 400 },
    );
  }

  // An active subscriber must change tiers via /api/subscription/change (which
  // updates the EXISTING LS subscription). A second checkout would create a
  // second live LS subscription that keeps billing after our row points at
  // the newer one.
  const currentSub = await getCurrentSubscription(user.id);
  if (hasLiveLemonsqueezySubscription(currentSub)) {
    return NextResponse.json(
      { error: "عندك اشتراك نشط بالفعل — غيّري الباقة من صفحة الاشتراك" },
      { status: 409 },
    );
  }

  setupLemonsqueezy();

  const storeId = getLemonsqueezyStoreId();
  const variantId = getVariantId(parsed.tier, parsed.cadence);

  // Return to the EXACT origin the user is browsing (the same-origin POST sends
  // an Origin header), so the post-payment redirect carries the session cookie.
  // Falling back on the request URL, then the configured app URL.
  const origin =
    request.headers.get("origin") ??
    new URL(request.url).origin ??
    env.NEXT_PUBLIC_APP_URL;

  try {
    const response = await createCheckout(storeId, variantId, {
      checkoutOptions: {
        embed: false,
        media: false,
        logo: true,
      },
      checkoutData: {
        email: user.email ?? undefined,
        custom: {
          user_id: user.id,
          tier: parsed.tier,
          cadence: parsed.cadence,
        },
      },
      productOptions: {
        redirectUrl: `${origin}/dashboard?checkout=success`,
      },
    });

    const checkoutUrl = response?.data?.data?.attributes?.url;
    if (!checkoutUrl) {
      console.error("[checkout] missing checkout URL in LS response", response);
      return NextResponse.json(
        { error: "حدث خطأ في تجهيز الدفع. حاولي مرة ثانية" },
        { status: 502 },
      );
    }

    return NextResponse.json({ checkout_url: checkoutUrl }, { status: 200 });
  } catch (err) {
    console.error("[checkout] LS error:", err);
    Sentry.captureException(err, {
      tags: {
        area: "checkout-creation",
        userId: user.id,
        tier: parsed.tier,
        cadence: parsed.cadence,
      },
    });
    return NextResponse.json(
      { error: "حدث خطأ في تجهيز الدفع. حاولي مرة ثانية" },
      { status: 502 },
    );
  }
}
