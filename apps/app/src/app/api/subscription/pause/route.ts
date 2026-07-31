import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSubscription } from "@/lib/subscription/state";
import {
  pauseLSSubscription,
  resumeLSSubscription,
} from "@/lib/lemonsqueezy/subscription";

export const runtime = "nodejs";

/** استراحة السفر: one month, auto-resumes — honest pause, not hidden churn. */
const PAUSE_DAYS = 30;

/**
 * POST /api/subscription/pause — pause billing for 30 days instead of
 * cancelling. Body {"resume": true} lifts an existing pause early.
 *
 * Calls LS, then optimistically mirrors the status locally (the
 * subscription_updated webhook confirms later, idempotent). While paused,
 * isSubscriptionActive() is false, so plan access gates off — the pause is
 * honest on both sides: no charges, no service.
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

  const sub = await getCurrentSubscription(user.id);
  if (!sub?.lemonsqueezy_subscription_id) {
    return NextResponse.json({ error: "لا يوجد اشتراك" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { resume?: boolean };
  const admin = createAdminClient();

  if (body.resume) {
    const { success } = await resumeLSSubscription(
      sub.lemonsqueezy_subscription_id,
    );
    if (!success) {
      return NextResponse.json(
        { error: "تعذّر استئناف الاشتراك. يرجى المحاولة بعد قليل" },
        { status: 502 },
      );
    }
    // The error is READ, exactly as on the pause path below. This is the mirror
    // image of that bug: LemonSqueezy has already resumed BILLING by now, so a
    // silently-failed write leaves our row 'paused' — isSubscriptionActive
    // returns false and the customer is charged while locked out, having been
    // told {resumed: true}.
    //
    // ends_at is cleared because the pause set it (and current_period_end) to
    // the resume date as a display value; subscription_updated only writes
    // ends_at when the incoming value is truthy, so a null would never clear it
    // and the stale date would sit on the subscription page indefinitely. The
    // real billing dates arrive with the next webhook.
    const { error: resumeWriteError } = await admin
      .from("subscriptions")
      .update({ status: "active", ends_at: null })
      .eq("id", sub.id)
      .eq("user_id", user.id);

    if (resumeWriteError) {
      Sentry.captureException(
        new Error("Resume written to LS but not to our row"),
        {
          tags: { area: "subscription-pause", userId: user.id },
          extra: {
            message: resumeWriteError.message,
            code: resumeWriteError.code,
          },
        },
      );
      return NextResponse.json(
        { error: "تعذّر استئناف الاشتراك. يرجى المحاولة بعد قليل" },
        { status: 502 },
      );
    }
    return NextResponse.json({ resumed: true });
  }

  const resumesAt = new Date(
    Date.now() + PAUSE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { success } = await pauseLSSubscription(
    sub.lemonsqueezy_subscription_id,
    resumesAt,
  );
  if (!success) {
    Sentry.captureException(new Error("LS pause returned failure"), {
      tags: { area: "subscription-pause", userId: user.id },
    });
    return NextResponse.json(
      { error: "تعذّر إيقاف الاشتراك مؤقتاً. يرجى المحاولة بعد قليل" },
      { status: 502 },
    );
  }

  // current_period_end doubles as the visible resume date while paused (the
  // subscription_updated webhook restores real billing dates on resume).
  //
  // The error is READ, not discarded. Billing has already stopped at this point,
  // so a silently-failed write leaves the row 'active' with its pre-pause period
  // end — full access, real AI spend, nothing being charged — while the caller
  // is told the pause succeeded. That is exactly what happened for every pause
  // before migration 00023, which had to widen the status CHECK to accept
  // 'paused' at all. Surfacing it turns a silent revenue leak into a visible,
  // retryable failure.
  const { error: pauseWriteError } = await admin
    .from("subscriptions")
    .update({ status: "paused", ends_at: resumesAt, current_period_end: resumesAt })
    .eq("id", sub.id);

  if (pauseWriteError) {
    Sentry.captureException(new Error("Pause written to LS but not to our row"), {
      tags: { area: "subscription-pause", userId: user.id },
      extra: { message: pauseWriteError.message, code: pauseWriteError.code },
    });
    return NextResponse.json(
      { error: "تعذّر إيقاف الاشتراك مؤقتاً. يرجى المحاولة بعد قليل" },
      { status: 502 },
    );
  }

  return NextResponse.json({ paused: true, resumes_at: resumesAt });
}
