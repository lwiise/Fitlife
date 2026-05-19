import { NextResponse } from "next/server";
import { getCustomer } from "@lemonsqueezy/lemonsqueezy.js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { setupLemonsqueezy } from "@/lib/lemonsqueezy/client";

export const runtime = "nodejs";

interface LemonsqueezyUrls {
  customer_portal?: string;
  update_payment_method?: string;
}

/**
 * POST /api/billing/portal
 *
 * Auth-required. Looks up the user's LS customer ID, asks LS for a signed
 * customer-portal URL, returns it for the client to redirect to.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  const sub = await getCurrentSubscription(user.id);
  if (!sub || !sub.lemonsqueezy_customer_id) {
    return NextResponse.json(
      { error: "لا يوجد اشتراك نشط" },
      { status: 400 },
    );
  }

  setupLemonsqueezy();

  try {
    const response = await getCustomer(sub.lemonsqueezy_customer_id);
    const urls = response?.data?.data?.attributes?.urls as
      | LemonsqueezyUrls
      | undefined;
    const portalUrl = urls?.customer_portal;
    if (!portalUrl) {
      console.error("[billing/portal] customer_portal URL missing from LS response");
      return NextResponse.json(
        { error: "تعذر فتح بوابة الإدارة. حاولي بعد قليل" },
        { status: 502 },
      );
    }

    return NextResponse.json({ portal_url: portalUrl }, { status: 200 });
  } catch (err) {
    console.error("[billing/portal] LS error:", err);
    return NextResponse.json(
      { error: "تعذر فتح بوابة الإدارة. حاولي بعد قليل" },
      { status: 502 },
    );
  }
}
