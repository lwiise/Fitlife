import { createClient } from "@supabase/supabase-js";
import { buildPlanContext, runMealPlanGeneration } from "@fitlife/plan-engine";

/**
 * Netlify background function (15-min budget). Does the heavy Anthropic
 * meal-plan generation that exceeds the 26s synchronous function ceiling.
 *
 * Invoked (fire-and-forget) by /api/plans/generate, which has already inserted
 * the meal_plans (generating) + plan_generations (started) rows. This function
 * fills them in. Authenticated by a shared internal secret (the service-role
 * key) so the public endpoint can't be abused to burn Anthropic credits.
 *
 * The `-background` filename suffix is what makes Netlify treat this as a
 * background function (returns 202 to the caller immediately, keeps running).
 */
export default async (req: Request): Promise<Response> => {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { userId?: string; mealPlanId?: string; methodologyOverride?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { userId, mealPlanId, methodologyOverride } = body;
  if (!userId || !mealPlanId) {
    return new Response("Missing userId or mealPlanId", { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !anthropicKey) {
    console.error("[generate-plan-background] missing env (SUPABASE_URL or ANTHROPIC_API_KEY)");
    return new Response("Server misconfigured", { status: 500 });
  }

  const admin = createClient(supabaseUrl, expected, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const context = await buildPlanContext(admin, userId);
    await runMealPlanGeneration({
      supabase: admin,
      anthropicApiKey: anthropicKey,
      mealPlanId,
      context,
      methodologyOverride,
    });
    console.log("[generate-plan-background] completed", { userId, mealPlanId });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[generate-plan-background] error", { userId, mealPlanId, errorMessage });
    // runMealPlanGeneration marks rows failed on its own errors, but gate
    // errors from buildPlanContext (onboarding/medical) won't have — mark here.
    await admin
      .from("meal_plans")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", mealPlanId);
    await admin
      .from("plan_generations")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("meal_plan_id", mealPlanId);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
