import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";

export const runtime = "nodejs";

/**
 * GET /api/subscription/status
 *
 * Lightweight polling endpoint used by CheckoutSuccessHandler. Returns the
 * authenticated user's current subscription snapshot.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = await getCurrentSubscription(user.id);
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 404 });
  }

  return NextResponse.json({
    status: sub.status,
    tier: sub.tier,
    cadence: sub.cadence,
    current_period_end: sub.current_period_end,
    trial_ends_at: sub.trial_ends_at,
  });
}
