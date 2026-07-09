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

  // Meals-first sequencing: while a meal generation is live, the workout
  // background run is deliberately holding (see generate-plan-background) —
  // surface that so the generating screen can say "meals first" instead of
  // counting the wait against its stall timeout.
  let waitingForMeals = false;
  if (latest.status === "generating") {
    const { data: mealGens } = await supabase
      .from("plan_generations")
      .select("started_at")
      .eq("user_id", user.id)
      .eq("status", "started")
      .eq("plan_kind", "meal")
      .limit(1)
      .returns<{ started_at: string }[]>();
    const started = mealGens?.[0]?.started_at;
    if (started) {
      const ageMin = (Date.now() - Date.parse(started)) / 60_000;
      waitingForMeals = Number.isFinite(ageMin) && ageMin < 15;
    }
  }

  return NextResponse.json({
    id: latest.id,
    status: latest.status,
    updated_at: latest.updated_at,
    in_progress: latest.in_progress,
    waiting_for_meals: waitingForMeals,
    error_message: latest.status === "failed" ? latest.error_message : null,
  });
}
