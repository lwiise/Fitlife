import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Auth proxy (formerly middleware in Next.js 15 and below).
 * Runs on every request matching the matcher pattern.
 *
 * Responsibilities:
 * 1. Refresh the Supabase session so server components have fresh user data
 * 2. Redirect unauthenticated users away from protected routes
 * 3. Redirect authenticated users away from auth routes (no need to log in twice)
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const pathname = request.nextUrl.pathname;

  const isAuthRoute = pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api");
  const isPublicAsset = pathname.startsWith("/_next") || pathname.includes(".");
  // The marketing landing page lives at "/" and is public to everyone.
  // Privacy + Terms must be readable WITHOUT a session (PDPL: users must be
  // able to read them before signing up).
  const isPublicRoute =
    pathname === "/" || pathname === "/privacy" || pathname === "/terms";

  if (isApiRoute || isPublicAsset) {
    return response;
  }

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect_to", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && pathname !== "/auth/callback" && pathname !== "/auth/logout") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
