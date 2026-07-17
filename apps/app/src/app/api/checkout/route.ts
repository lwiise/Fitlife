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
import {
  setupLemonsqueezy,
  checkoutPrefillEmail,
} from "@/lib/lemonsqueezy/client";
import { getVariantId } from "@fitlife/config";

export const runtime = "nodejs";

// TEMPORARY (pre-launch diagnosis): failure responses carry a `debug` string
// that the pricing page renders, because the operator has no easy access to
// the Netlify function logs. Remove `debug` (and its rendering in
// CheckoutButton) once checkout works. It never contains keys — only the
// LemonSqueezy rejection reason.
function describeLsError(err: unknown): string {
  if (err instanceof Error) {
    let cause = "";
    if (err.cause !== undefined) {
      try {
        cause = ` — ${JSON.stringify(err.cause)}`;
      } catch {
        cause = ` — ${String(err.cause)}`;
      }
    }
    return `${err.message}${cause}`;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

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

  // Distinguish config-missing from LS-API failures in the function logs —
  // the client message is the same either way, the operator's fix is not.
  let storeId: string;
  try {
    setupLemonsqueezy();
    storeId = getLemonsqueezyStoreId();
  } catch (err) {
    console.error(
      "[checkout] LemonSqueezy env missing (LEMONSQUEEZY_API_KEY / LEMONSQUEEZY_STORE_ID)",
      err,
    );
    return NextResponse.json(
      {
        error: "حدث خطأ في تجهيز الدفع. حاولي مرة ثانية",
        debug: `config: ${describeLsError(err)}`,
      },
      { status: 500 },
    );
  }
  const variantId = getVariantId(parsed.tier, parsed.cadence);

  // Return to the EXACT origin the user is browsing (the same-origin POST sends
  // an Origin header), so the post-payment redirect carries the session cookie.
  // Falling back on the request URL, then the configured app URL.
  const origin =
    request.headers.get("origin") ??
    new URL(request.url).origin ??
    env.NEXT_PUBLIC_APP_URL;

  const prefillEmail = checkoutPrefillEmail(user.email);
  if (user.email && !prefillEmail) {
    console.warn("[checkout] omitting invalid account email from prefill", {
      userId: user.id,
    });
  }

  try {
    const response = await createCheckout(storeId, variantId, {
      checkoutOptions: {
        embed: false,
        media: false,
        logo: true,
      },
      checkoutData: {
        email: prefillEmail,
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
      // The SDK doesn't throw on API rejection — the reason lives in
      // response.error (e.g. invalid API key, variant not in this store,
      // test/live mode mismatch). Surface it for the function logs.
      console.error("[checkout] LS did not return a checkout URL", {
        tier: parsed.tier,
        cadence: parsed.cadence,
        variantId,
        statusCode: response?.statusCode ?? null,
        lsError: response?.error ?? null,
      });
      return NextResponse.json(
        {
          error: "حدث خطأ في تجهيز الدفع. حاولي مرة ثانية",
          debug: `LS ${response?.statusCode ?? "?"} (variant ${variantId}): ${describeLsError(response?.error)}`,
        },
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
      {
        error: "حدث خطأ في تجهيز الدفع. حاولي مرة ثانية",
        debug: `exception: ${describeLsError(err)}`,
      },
      { status: 502 },
    );
  }
}
