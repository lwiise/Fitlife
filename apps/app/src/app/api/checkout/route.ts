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
  describeLsError,
} from "@/lib/lemonsqueezy/client";
import {
  getVariantId,
  usingLiveVariantIds,
  variantEnvVar,
} from "@fitlife/config";
import { genderPick } from "@/lib/copy/gender";

export const runtime = "nodejs";

// Failure responses return the Arabic message ONLY. They used to also carry a
// `debug` string that the pricing page rendered, which put LemonSqueezy
// rejection reasons and internal variant IDs in front of paying customers.
// Nothing was lost by removing it: every failure path already console.errors
// the same detail (and reports to Sentry), so diagnosis lives in the logs where
// it belongs rather than in the checkout UI.

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
    // Owner-directed instruction ("غيّري الباقة") — inflect it for the answered
    // الجنس. Looked up only on this branch: it is the one response body here
    // that addresses the user, so the common path keeps its single query.
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("sex")
      .eq("id", user.id)
      .single();
    const g = genderPick(
      (ownerProfile as { sex?: string | null } | null)?.sex ?? null,
    );
    return NextResponse.json(
      {
        error: g(
          "عندك اشتراك نشط بالفعل — غيّري الباقة من صفحة الاشتراك",
          "عندك اشتراك نشط بالفعل — غيّر الباقة من صفحة الاشتراك",
        ),
      },
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
      "[checkout] LemonSqueezy env missing (LEMONSQUEEZY_API_KEY / LEMONSQUEEZY_STORE_ID):",
      describeLsError(err),
    );
    return NextResponse.json(
      {
        error: "حدث خطأ في تجهيز الدفع. يرجى المحاولة مرة أخرى",
      },
      { status: 500 },
    );
  }
  const variantId = getVariantId(parsed.tier, parsed.cadence);
  // Report only what is actually knowable here: whether this pair resolved to an
  // env override or to the built-in id. The store's mode is Lemonsqueezy-side
  // state that this process cannot see.
  //
  // This used to log "using TEST-MODE variant id … to take real payments"
  // whenever the overrides were unset — which was backwards. The built-ins are
  // LIVE, so the message reassured whoever read the log at the exact moment a
  // real card was charged.
  if (!usingLiveVariantIds()) {
    console.warn(
      `[checkout] ${parsed.tier}/${parsed.cadence}: no ${variantEnvVar(parsed.tier, parsed.cadence)} set, using built-in variant id ${variantId} — the built-ins are LIVE and charge real cards`,
    );
  }

  // Return to the EXACT origin the user is browsing (the same-origin POST sends
  // an Origin header), so the post-payment redirect carries the session cookie.
  // Falling back on the request URL, then the configured app URL.
  const origin =
    request.headers.get("origin") ??
    new URL(request.url).origin ??
    env.NEXT_PUBLIC_APP_URL;

  // NO email prefill: LS validates checkout_data.email far more strictly than
  // any local format check (it 422s the ENTIRE checkout on emails with
  // nonexistent domains — which is what dev/test accounts use). The prefill
  // was convenience only; the hosted LS page collects the email itself and
  // custom.user_id is what maps the webhook back to our subscription row.
  try {
    const response = await createCheckout(storeId, variantId, {
      checkoutOptions: {
        embed: false,
        media: false,
        logo: true,
      },
      checkoutData: {
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
          error: "حدث خطأ في تجهيز الدفع. يرجى المحاولة مرة أخرى",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ checkout_url: checkoutUrl }, { status: 200 });
  } catch (err) {
    console.error("[checkout] LS error:", describeLsError(err));
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
        error: "حدث خطأ في تجهيز الدفع. يرجى المحاولة مرة أخرى",
      },
      { status: 502 },
    );
  }
}
