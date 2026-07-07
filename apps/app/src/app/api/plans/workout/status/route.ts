import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLatestWorkoutPlan } from "@/lib/plans/getLatestWorkoutPlan";

export const runtime = "nodejs";

/**
 * GET /api/plans/workout/status
 *
 * Polling endpoint for workout generation — a SIBLING of /api/plans/status,
 * which stays meal-only because three existing pollers depend on its shape.
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

  const latest = await getLatestWorkoutPlan(user.id);
  if (!latest) {
    return NextResponse.json({ error: "No workout plan found" }, { status: 404 });
  }

  return NextResponse.json({
    id: latest.id,
    status: latest.status,
    updated_at: latest.updated_at,
    in_progress: latest.in_progress,
    error_message: latest.status === "failed" ? latest.error_message : null,
  });
}
