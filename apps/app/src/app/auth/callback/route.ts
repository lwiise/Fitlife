import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safeRedirect";

/**
 * GET /auth/callback
 *
 * Supabase redirects users here after they click the magic link in their email.
 * The URL contains a `code` query parameter that we exchange for a session.
 * Then we redirect to the original destination (or /dashboard by default).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // new URL() rather than concatenation: the origin can't be overridden even
  // if the guard above ever loosens.
  return NextResponse.redirect(new URL(redirectTo, origin));
}
