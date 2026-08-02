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
  const pathname = request.nextUrl.pathname;

  // Netlify's own endpoints are NOT application routes, and must never be
  // treated as one.
  //
  // This is what stopped plan generation entirely. The app dispatches to
  // /.netlify/functions/generate-plan-background as a SERVER-TO-SERVER fetch: it
  // carries no session cookies by design and authenticates with the
  // x-internal-secret header instead. So `user` below resolves to null, the
  // unauthenticated branch redirected the dispatch to /auth/login, and fetch
  // followed that redirect to a 200 HTML page — which is indistinguishable from
  // a successful enqueue. Netlify never saw the request, the worker never ran,
  // and the plan sat 'generating' forever with nothing in any log.
  //
  // The matcher below also excludes this prefix, so ordinarily we are not even
  // invoked for it. This stays as defence in depth: the cost of being wrong here
  // is silent, total, and took a long time to find.
  if (pathname.startsWith("/.netlify/")) {
    return NextResponse.next();
  }

  const isAuthRoute = pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api");
  // A real asset-extension test, not "contains a dot". `includes(".")` matched
  // any dynamic route whose parameter happened to carry one — /plan/history/<id>,
  // /admin/subscribers/<id> — and skipped the session refresh for it, so a user
  // with a refreshable token was bounced to login instead.
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|txt|xml|json|woff2?|ttf|otf|lottie)$/i.test(
      pathname,
    );
  // The marketing landing page lives at "/" and is public to everyone.
  // Privacy + Terms must be readable WITHOUT a session (PDPL: users must be
  // able to read them before signing up). /landing is the standalone
  // bundle-offer sales page — pure marketing, no session use. /pricing is a
  // marketing page too: it renders a logged-out variant on purpose, which was
  // unreachable while this list gated it behind a login (and prospects could
  // not see what they were being asked to buy before creating an account).
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/landing" ||
    pathname === "/pricing" ||
    pathname === "/privacy" ||
    pathname === "/terms";
  // The admin login form must render for logged-out operators. NOT in
  // isPublicRoute: the page still needs the refreshed session so it can
  // bounce already-signed-in admins to /admin and show non-admins the denied
  // state — it is only exempt from the login redirect below.
  const isAdminLogin = pathname === "/admin/login";

  // Public pages + static assets need no session: skip the Supabase getUser()
  // round-trip entirely so these (statically prerendered) routes aren't gated
  // on an auth network call at the edge. These routes never consume `user`.
  if (isPublicAsset || isPublicRoute) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (isApiRoute) {
    return response;
  }

  if (!user && !isAuthRoute && !isAdminLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect_to", pathname);
    return withSessionCookies(NextResponse.redirect(url), response);
  }

  // Signed-in users have no business on the login form, but three /auth routes
  // are exceptions: the callback is mid-exchange, logout needs to run, and
  // update-password is reached WITH a live recovery session — bouncing it to
  // the dashboard would make the reset link land nowhere useful.
  const isAuthRouteNeedingSession =
    pathname === "/auth/callback" ||
    pathname === "/auth/logout" ||
    pathname === "/auth/update-password";

  if (user && isAuthRoute && !isAuthRouteNeedingSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return withSessionCookies(NextResponse.redirect(url), response);
  }

  return response;
}

/**
 * Carry the refreshed auth cookies onto a redirect.
 *
 * updateSession() calls getUser(), which ROTATES the refresh token and writes
 * new cookies onto its own response. Both redirect branches above build a fresh
 * NextResponse and returned that, dropping every Set-Cookie the refresh had
 * produced — so a signed-in user whose token was due for renewal got redirected
 * carrying the OLD cookie while the token had already been rotated server-side.
 * That is a credible source of "randomly logged out".
 */
function withSessionCookies(
  redirect: NextResponse,
  refreshed: NextResponse,
): NextResponse {
  for (const cookie of refreshed.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    // `.netlify` is excluded because Netlify's function endpoints are platform
    // infrastructure, not app routes — running auth middleware over them
    // redirected the internal background-function dispatch to /auth/login and
    // killed plan generation outright. See the guard at the top of proxy().
    "/((?!_next/static|_next/image|favicon.ico|\\.netlify|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
