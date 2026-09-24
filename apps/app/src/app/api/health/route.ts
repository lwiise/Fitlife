import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 *
 * Verifies Supabase connectivity + schema presence. Returns 200 when
 * reachable, 503 when degraded. Public endpoint — safe to keep in production
 * for an uptime probe, which is why it answers with fixed status words only:
 * it used to echo raw Supabase/PostgREST error messages to any anonymous
 * caller, and those can name hosts, tables or configuration. The detail goes
 * to the server log, where the operator reads it.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("[health] auth check failed", sessionError.message);
      return NextResponse.json(
        { status: "degraded", supabase: "unreachable", auth: "error", schema: "unknown" },
        { status: 503 },
      );
    }

    // Schema check — a HEAD count on profiles (RLS makes it 0 unauthenticated,
    // which is fine; only the table's existence is being probed).
    const { error: schemaError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (schemaError) console.error("[health] schema check failed", schemaError.message);

    return NextResponse.json(
      {
        status: schemaError ? "degraded" : "ok",
        supabase: "connected",
        auth: "ready",
        schema: schemaError ? "missing" : "ready",
        timestamp: new Date().toISOString(),
      },
      { status: schemaError ? 503 : 200 },
    );
  } catch (err) {
    console.error("[health] failed to initialise Supabase client", err);
    return NextResponse.json(
      { status: "degraded", supabase: "unreachable", auth: "unknown", schema: "unknown" },
      { status: 503 },
    );
  }
}
