import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 *
 * Verifies Supabase connectivity. Returns 200 if reachable.
 * Public endpoint — safe to keep in production.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          message: "Supabase auth check failed",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      supabase: "connected",
      auth: "ready",
      session: data.session ? "active" : "none",
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
