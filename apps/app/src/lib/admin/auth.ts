import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { isAuthApiError, isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";

/** Where non-admins are sent. The login page is the one public /admin route. */
export const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * Back-office access control.
 *
 * Admin status lives in the `admin_users` table, which has RLS enabled with
 * ZERO policies — no anon/authenticated client can read it. Membership is
 * therefore resolved here with the service-role client, server-side only.
 *
 * Defense in depth: call `requireAdmin()` (or `requireAdminApi()`) at BOTH the
 * /admin layout AND the top of every admin route handler / server action.
 * Never trust a client-supplied value. Non-admins (logged out or normal users)
 * get a 404 — we never reveal that the panel exists.
 */

export type AdminRole = "super_admin" | "support";

export interface AdminContext {
  /** auth.users.id of the signed-in admin. */
  userId: string;
  /** Admin's login email (for the chrome / audit attribution). */
  email: string | null;
  role: AdminRole;
}

/** An admin, nobody with access, or a lookup that could not tell (resolveAdminAccess). */
export type AdminAccess =
  | { kind: "admin"; ctx: AdminContext }
  | { kind: "none" }
  | { kind: "error" };

/**
 * The current session's admin access, telling the two ways of having none
 * apart:
 *  - "none": logged out, a session that is no longer valid, or not an admin;
 *  - "error": the lookup itself failed — Supabase Auth unreachable or
 *    answering 5xx, or the admin_users read failed — so nothing is known
 *    about access either way.
 * A JSON route answers the two differently (a 404 that says nothing, a 503
 * to retry); pages need only getAdminContext's yes/no.
 *
 * Wrapped in React `cache()` so a single request that resolves the context more
 * than once (e.g. a page's `requireAdmin()` plus the chrome showing the signed-in
 * admin) makes the `auth.getUser()` + `admin_users` round-trips just once.
 */
export const resolveAdminAccess = cache(async (): Promise<AdminAccess> => {
  // 1. Resolve the authenticated user from the (cookie-bound) session.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user) return authLookupFailed(authError) ? { kind: "error" } : { kind: "none" };

  // 2. Check admin_users membership with the service-role client (RLS bypass).
  //    A normal authenticated client cannot read this table at all.
  const admin = adminDb();
  const { data, error } = await admin
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { kind: "error" };
  if (!data) return { kind: "none" };

  return {
    kind: "admin",
    ctx: {
      userId: user.id,
      email: user.email ?? null,
      role: data.role as AdminRole,
    },
  };
});

/**
 * A getUser() error that says nothing about the session: the request never
 * got an answer (network, a 502/503/504 — AuthRetryableFetchError), Auth
 * itself failed (a 5xx), or the answer was unreadable. Anything else — no
 * session, an expired or revoked one — means signed out.
 */
function authLookupFailed(error: AuthError | null): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  if (isAuthApiError(error)) return error.status >= 500;
  return error.name === "AuthUnknownError";
}

/**
 * Resolve the admin context for the current session, or null if the requester
 * is logged out or not an admin — or when that could not be determined (see
 * resolveAdminAccess). Pure lookup — never redirects.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const access = await resolveAdminAccess();
  return access.kind === "admin" ? access.ctx : null;
});

/**
 * Gate an admin RSC page / server action. Redirects anyone who is not an admin
 * (logged out or a normal user) to the admin login screen; the login page then
 * shows the sign-in form or a "no access" state. Returns the admin context for
 * admins. Call from every admin entry point (defense in depth).
 */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect(ADMIN_LOGIN_PATH);
  return ctx;
}
