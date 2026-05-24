import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/dev/throw — dev-only Sentry smoke test. Throws so the error flows
 * through instrumentation → Sentry. Returns 404 in production.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }
  throw new Error("Sentry test error — intentional throw for verification");
}
