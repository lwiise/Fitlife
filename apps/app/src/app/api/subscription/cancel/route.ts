import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { cancelLSSubscription } from "@/lib/lemonsqueezy/subscription";

export const runtime = "nodejs";

/**
 * POST /api/subscription/cancel — cancel at period end.
 *
 * Calls LS, then optimistically marks cancel_at_period_end so the UI reflects it
 * immediately (the subscription_cancelled webhook confirms later, idempotent).
 * Access continues until current_period_end — no refund.
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
  if (!sub?.lemonsqueezy_subscription_id) {
    return NextResponse.json({ error: "لا يوجد اشتراك لإلغائه" }, { status: 400 });
  }

  const { success, ends_at } = await cancelLSSubscription(
    sub.lemonsqueezy_subscription_id,
  );
  if (!success) {
    Sentry.captureException(new Error("LS cancel returned failure"), {
      tags: { area: "subscription-cancel", userId: user.id },
    });
    return NextResponse.json(
      { error: "تعذّر إلغاء الاشتراك. حاولي بعد قليل" },
      { status: 502 },
    );
  }

  const admin = createAdminClient();
  await admin
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      ...(ends_at ? { current_period_end: ends_at } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id)
    .eq("user_id", user.id);

  return NextResponse.json({ success: true, ends_at }, { status: 200 });
}
