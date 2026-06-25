import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import { adminDb } from "@/lib/admin/db";

/**
 * PDPL audit trail for back-office data access. Every admin view of subscriber
 * data is recorded here via the service-role client (the table has RLS enabled
 * with no client policies, so only the server can write it).
 *
 * `detail` is metadata ABOUT the access (which section, which member id), never
 * the sensitive values themselves.
 */

export type AdminAuditAction =
  | "view_subscriber_list"
  | "view_subscriber_detail"
  | "view_health_detail"
  | "view_plan_data"
  | "view_insights"
  | "deactivate_subscriber_account"
  | "reactivate_subscriber_account"
  | "delete_subscriber_account";

export async function logAdminAccess(params: {
  adminUserId: string;
  subscriberId?: string | null;
  action: AdminAuditAction;
  detail?: Json | null;
}): Promise<void> {
  const admin = adminDb();
  const { error } = await admin.from("admin_audit_log").insert({
    admin_user_id: params.adminUserId,
    subscriber_id: params.subscriberId ?? null,
    action: params.action,
    detail: params.detail ?? null,
  });

  // Best-effort: a transient logging failure must not break the admin view.
  // We still surface it to the server logs (and Sentry) so a broken audit
  // trail is noticed rather than silently lost.
  if (error) {
    console.error("[admin-audit] failed to record access event", {
      action: params.action,
      subscriberId: params.subscriberId ?? null,
      error: error.message,
    });
  }
}
