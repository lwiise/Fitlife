import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 *
 * Verifies Supabase connectivity + schema presence. Returns 200 if reachable.
 * Public endpoint — safe to keep in production.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      // Endpoint is public and unauthenticated — log the detail, don't return it.
      console.error("[health] Supabase auth check failed", sessionError);
      return NextResponse.json(
        { status: "error", message: "Supabase auth check failed" },
        { status: 500 }
      );
    }

    // Schema check — count rows in profiles (RLS returns 0 if not auth'd, which is fine)
    const { error: schemaError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      status: "ok",
      supabase: "connected",
      auth: "ready",
      schema: schemaError ? "missing" : "ready",
      session: sessionData.session ? "active" : "none",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[health] Failed to initialize Supabase client", err);
    return NextResponse.json(
      { status: "error", message: "Failed to initialize Supabase client" },
      { status: 500 }
    );
  }
}
