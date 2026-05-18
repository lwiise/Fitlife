import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /auth/logout
 *
 * Signs the user out and redirects to /auth/login.
 * Always returns success (logout is idempotent).
 */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/auth/login`, { status: 303 });
}
