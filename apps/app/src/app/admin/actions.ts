"use server";

import { refresh, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { logAdminAccessRequired } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { eraseUserAccount } from "@/lib/account/erase";
import { ADMIN_CURRENCY_COOKIE, ADMIN_LOCALE_COOKIE } from "@/lib/admin/locale";
import { toggleReturn } from "./_shell/toggleReturn";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where the account tools return: the family page's account tab, the tab they
 * are used from. Only ever built from an id that has passed UUID_RE.
 */
function accountTab(userId: string, error?: "audit_failed"): string {
  const path = `/admin/subscribers/${userId}?tab=account`;
  return error ? `${path}&error=${error}` : path;
}

/**
 * The cached tables the families list, the rail counts and the ⌘K index are
 * built from (lib/admin/queries.ts). An erased account must drop out of them
 * on the very next request — the families list the deletion lands on — not
 * up to a minute (dataset) or five (emails) later.
 */
const ADMIN_LIST_CACHE_TAGS = ["admin-dataset", "admin-email-map"] as const;

/** The account tools must never touch an admin (prevents self/admin lockout). */
async function isTargetAdmin(userId: string): Promise<boolean> {
  const { data } = await adminDb()
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/**
 * After a switch has set its cookie: posted by the running app, re-render the
 * route the router is on now (a navigation the switch was queued behind has
 * landed by then); posted without JavaScript, redirect to the form's `next`,
 * constrained to /admin paths to prevent open redirects. See toggleReturn.ts.
 */
function returnFromToggle(formData: FormData): void {
  const back = toggleReturn(formData);
  if (back.kind === "refresh") refresh();
  else redirect(back.to);
}

/**
 * Persist the admin's language choice (cookie) and stay on the page they are
 * on. Gated by requireAdmin (defense in depth — server actions re-check).
 */
export async function setAdminLocale(formData: FormData) {
  await requireAdmin();

  const locale = formData.get("locale") === "en" ? "en" : "ar";

  const store = await cookies();
  store.set(ADMIN_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  returnFromToggle(formData);
}

/**
 * Persist the admin's display-currency choice (cookie) and stay on the page
 * they are on. Mirrors setAdminLocale exactly.
 */
export async function setAdminCurrency(formData: FormData) {
  await requireAdmin();

  const currency = formData.get("currency") === "usd" ? "usd" : "sar";

  const store = await cookies();
  store.set(ADMIN_CURRENCY_COOKIE, currency, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  returnFromToggle(formData);
}

/**
 * Deactivate (ban) or reactivate (unban) a subscriber via GoTrue — reversible,
 * blocks login while keeping all data. Any admin; the action refuses to touch an
 * admin account. The redirect re-renders the (uncached) family page on its
 * account tab, so the new status shows immediately where the button was.
 */
export async function setSubscriberActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!UUID_RE.test(userId)) redirect("/admin");
  if (await isTargetAdmin(userId)) redirect(accountTab(userId));

  // Audit BEFORE acting: if the trail can't be written, the action must not
  // happen (PDPL). The row therefore records INTENT — if GoTrue then errors,
  // an audit row exists for an action that didn't complete; acceptable, since
  // the alternative (act first) can't abort an unauditable action.
  const audit = await logAdminAccessRequired({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: active
      ? "reactivate_subscriber_account"
      : "deactivate_subscriber_account",
  });
  if (!audit.ok) redirect(accountTab(userId, "audit_failed"));

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h", // ~100 years = "deactivated"
  });
  if (error) throw error;

  redirect(accountTab(userId));
}

/**
 * Permanently delete a subscriber account (PDPL erasure) — irreversible: cascades
 * all their data and cancels billing. The admin must re-type the subscriber's
 * email, verified server-side. Any admin; refuses to delete an admin account.
 * A refused check returns to the account tab it was started from; a completed
 * erasure lands on the families list, already without the account.
 */
export async function deleteSubscriberAccount(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const confirmEmail = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  if (!UUID_RE.test(userId)) redirect("/admin");
  if (await isTargetAdmin(userId)) redirect(accountTab(userId));

  // Server-side confirmation: the typed email must match the account's real email.
  const { data: target } = await createAdminClient().auth.admin.getUserById(userId);
  const realEmail = target?.user?.email?.trim().toLowerCase() ?? null;
  if (!realEmail || confirmEmail !== realEmail) {
    redirect(accountTab(userId));
  }

  // Log BEFORE erasing — the audit FK is `on delete set null`, so the row survives
  // (de-identified) but `detail` preserves what was deleted. REQUIRED: an
  // irreversible erasure with no audit trail must not happen — abort instead.
  const audit = await logAdminAccessRequired({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: "delete_subscriber_account",
    detail: { email: realEmail },
  });
  if (!audit.ok) redirect(accountTab(userId, "audit_failed"));

  await eraseUserAccount(userId);

  // Read-your-writes: expire the list's cached tables now, so the families
  // list below (and the rail counts, and ⌘K) no longer show the account.
  for (const tag of ADMIN_LIST_CACHE_TAGS) updateTag(tag);

  redirect("/admin/families");
}
