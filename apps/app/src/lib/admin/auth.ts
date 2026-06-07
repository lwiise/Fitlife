import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/admin/db";

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

/**
 * Resolve the admin context for the current session, or null if the requester
 * is logged out or not an admin. Pure lookup — never redirects or throws.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  // 1. Resolve the authenticated user from the (cookie-bound) session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 2. Check admin_users membership with the service-role client (RLS bypass).
  //    A normal authenticated client cannot read this table at all.
  const admin = adminDb();
  const { data, error } = await admin
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: data.role as AdminRole,
  };
}

/**
 * Gate an admin RSC page / layout / server action. Renders a 404 (not 403) for
 * anyone who is not an admin, so the existence of /admin is never revealed.
 * Returns the admin context for admins.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) notFound();
  return ctx;
}
