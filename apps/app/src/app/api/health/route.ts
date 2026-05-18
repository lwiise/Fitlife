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
      return NextResponse.json(
        {
          status: "error",
          message: "Supabase auth check failed",
          error: sessionError.message,
        },
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
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to initialize Supabase client",
        error,
      },
      { status: 500 }
    );
  }
}
