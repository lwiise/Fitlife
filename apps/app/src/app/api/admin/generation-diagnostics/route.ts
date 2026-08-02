import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getAdminContext } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/generation-diagnostics
 *
 * Answers "why did the plan generation never start?" from the browser, for an
 * admin, without a Netlify dashboard or a Sentry seat.
 *
 * It exists because of a failure mode that is invisible by construction: Netlify
 * answers a `*-background` function with 202 BEFORE the handler runs, so the app
 * cannot observe a worker that refused the invocation (bad shared secret) or was
 * never reached at all (wrong URL). Both leave `meal_plans` sitting at
 * 'generating' with an empty plan_data and nothing logged app-side. The
 * invocation ACK now turns that into a fast, visible failure — this route says
 * WHICH of the two it was.
 *
 * The decisive fields are `dispatchTargetUrl` (a wrong NEXT_PUBLIC_APP_URL sends
 * the POST to a host that never answers, which the 8s enqueue timeout then
 * reports as success) and `secretSource` (whether both sides are agreeing on a
 * real shared secret or silently falling back to the service-role key).
 *
 * SECURITY: never returns a secret's VALUE — only presence and length, which is
 * enough to spot "unset on one side" and "set to two different things" without
 * disclosing anything. `NEXT_PUBLIC_APP_URL` is returned in full: it is a public
 * origin, already baked into the client bundle, and it is the single most likely
 * misconfiguration.
 */
export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) {
    // 404 rather than 403 — an unauthenticated prober learns nothing about
    // whether this route exists.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // MUST be the normalised value from `env`, which is what dispatch.ts actually
  // builds its URL from (env.ts strips trailing slashes). Reading the raw
  // variable here reported a double slash that the real dispatch path never
  // produces — a diagnostic that invents a bug is worse than no diagnostic.
  const appUrl = env.NEXT_PUBLIC_APP_URL || null;
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? null;
  const internalSecret = process.env.INTERNAL_FUNCTION_SECRET?.trim() || null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

  // Exactly the expression dispatch.ts builds, so a typo or a stale origin shows
  // up here as the literal string the app is POSTing to.
  const dispatchTargetUrl = appUrl
    ? `${appUrl}/.netlify/functions/generate-plan-background`
    : null;

  // The most recent generation attempt, from the app's side of the boundary.
  // `error_message` is where the enqueue-timeout path now leaves its trace.
  const db = adminDb();
  const { data: gens } = await db
    .from("plan_generations")
    .select("id, status, plan_kind, error_message, started_at, completed_at, cost_usd")
    .order("started_at", { ascending: false })
    .limit(5);

  const { data: plans } = await db
    .from("meal_plans")
    .select("id, status, plan_data, error_message, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(3);

  const planSummaries = (plans ?? []).map((p) => {
    const pd =
      p.plan_data && typeof p.plan_data === "object" && !Array.isArray(p.plan_data)
        ? (p.plan_data as Record<string, unknown>)
        : null;
    return {
      id: p.id,
      status: p.status,
      // The whole question, in one field: did the worker ever touch this row?
      workerAcked: pd === null || Object.keys(pd).length > 0,
      workerAckAt: pd?.worker_ack_at ?? null,
      planDataKeys: pd ? Object.keys(pd).length : null,
      error_message: p.error_message,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  return NextResponse.json({
    // What the app will POST to, and with what.
    dispatchTargetUrl,
    appUrlSet: !!appUrl,
    // The raw variable, for spotting a trailing slash or a stale origin. It is
    // normalised before use, so a difference here is cosmetic, not the bug.
    appUrlRaw: rawAppUrl,
    secretSource: internalSecret
      ? "INTERNAL_FUNCTION_SECRET"
      : serviceKey
        ? "SUPABASE_SERVICE_ROLE_KEY (fallback — set INTERNAL_FUNCTION_SECRET)"
        : "NONE — dispatch cannot authenticate and the worker will 401",
    // Presence + length only. Two sides disagreeing usually shows as a length
    // mismatch or an outright absence; neither needs the value to diagnose.
    env: {
      NEXT_PUBLIC_APP_URL: { set: !!appUrl },
      INTERNAL_FUNCTION_SECRET: {
        set: !!internalSecret,
        length: internalSecret?.length ?? 0,
      },
      SUPABASE_SERVICE_ROLE_KEY: { set: !!serviceKey, length: serviceKey?.length ?? 0 },
      NEXT_PUBLIC_SUPABASE_URL: { set: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
      ANTHROPIC_API_KEY: { set: !!process.env.ANTHROPIC_API_KEY },
      SENTRY_DSN: { set: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) },
    },
    // NOTE: this reflects the NEXT runtime only. The background function runs in
    // a separate Functions runtime with its own env scope, and the two comparing
    // different values is precisely the silent-401 case. A variable reading
    // set:true here is NOT proof the worker can see it.
    scopeCaveat:
      "Next runtime only. The Functions runtime has its own env scope; a var set here may still be missing there.",
    recentGenerations: gens ?? [],
    recentPlans: planSummaries,
  });
}
