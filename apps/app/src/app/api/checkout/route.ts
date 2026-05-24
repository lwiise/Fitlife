import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { createClient } from "@/lib/supabase/server";
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

  setupLemonsqueezy();

  const storeId = getLemonsqueezyStoreId();
  const variantId = getVariantId(parsed.tier, parsed.cadence);

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
        redirectUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
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
