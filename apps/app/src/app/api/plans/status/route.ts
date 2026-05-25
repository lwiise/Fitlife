import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLatestPlan } from "@/lib/plans/getLatestPlan";

export const runtime = "nodejs";

/**
 * GET /api/plans/status
 *
 * Lightweight polling endpoint. Returns the user's most recent plan's id, status,
 * and updated_at. Used by PlanGeneratingState to detect when generation completes.
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

  const latest = await getLatestPlan(user.id);
  if (!latest) {
    return NextResponse.json({ error: "No plan found" }, { status: 404 });
  }

  return NextResponse.json({
    id: latest.id,
    status: latest.status,
    updated_at: latest.updated_at,
    in_progress: latest.in_progress,
    error_message: latest.status === "failed" ? latest.error_message : null,
  });
}
