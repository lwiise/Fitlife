import { NextResponse } from "next/server";

// Reports the build SHA of the CURRENTLY-DEPLOYED app (see next.config `env`).
// force-dynamic + no-store so it's never cached: an open tab polls this to learn
// a newer build is live, then prompts a refresh (VersionWatcher).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
