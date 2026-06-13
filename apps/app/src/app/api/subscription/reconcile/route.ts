import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSubscriptionActive } from "@/lib/subscription/state";
import { reconcileSubscriptionFromLemonSqueezy } from "@/lib/subscription/reconcile";

export const runtime = "nodejs";

/**
 * POST /api/subscription/reconcile
 *
 * Auth-required, idempotent self-heal: re-reads the user's subscription from
 * Lemonsqueezy and reconciles our row. The safety net for a missed/delayed
 * webhook — called from the checkout-success timeout fallback and whenever the
 * UI is about to block a user who may have already paid.
 *
 * Returns the (possibly updated) snapshot plus an `active` boolean so the
 * client can decide whether to proceed.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = await reconcileSubscriptionFromLemonSqueezy(user.id, user.email);
  if (!sub) {
    return NextResponse.json({ active: false }, { status: 200 });
  }

  return NextResponse.json({
    active: isSubscriptionActive(sub),
    status: sub.status,
    tier: sub.tier,
    cadence: sub.cadence,
    current_period_end: sub.current_period_end,
    trial_ends_at: sub.trial_ends_at,
  });
}
