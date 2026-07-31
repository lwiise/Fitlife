import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safeRedirect";

/**
 * GET /auth/callback
 *
 * Where Supabase sends the user after they click a link in their email —
 * signup confirmation or password recovery. The URL carries a `code` we
 * exchange for a session, then we send them on to their destination.
 *
 * Failures redirect to /auth/login with a STABLE error code (not the raw
 * Supabase message, which is English and ended up in a user-visible URL). The
 * login page renders it — previously it wrote `?error=…` that nothing read, so
 * the most common failure of all was silent: opening the confirmation email on
 * a different device than signup leaves the PKCE verifier cookie on the first
 * device, the exchange fails, and the user landed on a blank login form with no
 * message and no way to know what had gone wrong.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Attacker-supplied: validate to a same-origin path (see safeRedirectPath).
  const redirectTo = safeRedirectPath(searchParams.get("redirect_to"));
  // Supabase appends type=recovery to the password-reset link. That flow must
  // land on the set-a-new-password screen rather than the dashboard.
  const isRecovery = searchParams.get("type") === "recovery";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // A stable code, not error.message: the message is English, changes without
    // notice, and has no business in a URL the customer sees.
    console.error("[auth/callback] code exchange failed", error.message);
    return NextResponse.redirect(`${origin}/auth/login?error=link_invalid`);
  }

  if (isRecovery) {
    return NextResponse.redirect(`${origin}/auth/update-password`);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
