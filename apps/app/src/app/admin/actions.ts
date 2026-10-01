"use server";

import { refresh, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { logAdminAccessRequired } from "@/lib/admin/audit";
import { isUuid } from "@/lib/admin/familyList";
import { ADMIN_HOUSEHOLD_CACHE_TAGS } from "@/lib/admin/freshness";
import { createAdminClient } from "@/lib/supabase/admin";
import { eraseUserAccount } from "@/lib/account/erase";
import { ADMIN_CURRENCY_COOKIE, ADMIN_LOCALE_COOKIE } from "@/lib/admin/locale";
import { accountTabHref, emailMatches, type AccountRefusal } from "./_family/model";
import { toggleReturn } from "./_shell/toggleReturn";

/**
 * Every cached admin read that can hold a household's data: the tables the
 * families list, the rail counts and the ⌘K index are built from, and the
 * Overview's engagement counters (lib/admin/freshness.ts). An erased account
 * must drop out of them on the very next request — the families list the
 * deletion lands on — not a minute (dataset, engagement) or five (emails) later.
 */
const ADMIN_LIST_CACHE_TAGS = ADMIN_HOUSEHOLD_CACHE_TAGS;

/**
 * Whether the account tools must leave this account alone, and why: they
 * never touch an admin's account (one admin locking out another, or
 * themselves). Null when they may act.
 *
 * Fails CLOSED. A lookup that errored proves nothing about the account, so
 * the action is refused — and the operator is told the check failed, never
 * that the account is an admin's, since that is not known either.
 */
async function adminTargetRefusal(userId: string): Promise<AccountRefusal | null> {
  const { data, error } = await adminDb()
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[admin-actions] admin_users lookup failed — account action refused", {
      subscriberId: userId,
      error: error.message,
    });
    return "admin_check_failed";
  }
  return data ? "admin_target" : null;
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
 * admin account. It always returns to the family's account tab: with
 * `?error=<refusal>` when it did not run (the tab says why — a plain form has
 * no dialog to say it in), and re-rendered with the new status when it did.
 */
export async function setSubscriberActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!isUuid(userId)) redirect("/admin");
  const refusal = await adminTargetRefusal(userId);
  if (refusal) redirect(accountTabHref(userId, refusal));

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
  if (!audit.ok) redirect(accountTabHref(userId, "audit_failed"));

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h", // ~100 years = "deactivated"
  });
  if (error) throw error;

  // The family's head (its «الحساب معطّل» chip, and the account tab's state,
  // both read once by the family layout) is kept as it was by a redirect back
  // to the same family; refresh() makes that navigation re-render it too.
  refresh();
  redirect(accountTabHref(userId));
}

/**
 * Permanently delete a subscriber account (PDPL erasure) — irreversible: cascades
 * all their data and cancels billing. The admin must re-type the subscriber's
 * email, verified server-side. Any admin; refuses to delete an admin account.
 *
 * A completed erasure lands on the families list, already without the
 * account. A refused one RETURNS why (AccountRefusal) — the delete dialog
 * stays open and says so, rather than closing as if something had happened.
 * Every check still runs before the audit row, and the audit row before the
 * erasure.
 */
export async function deleteSubscriberAccount(formData: FormData): Promise<AccountRefusal> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const confirmEmail = String(formData.get("confirmEmail") ?? "");
  if (!isUuid(userId)) redirect("/admin");
  const refusal = await adminTargetRefusal(userId);
  if (refusal) return refusal;

  // Server-side confirmation: the typed email must match the account's real
  // email — the dialog's own comparison (emailMatches), against GoTrue's copy.
  const { data: target, error: lookupError } =
    await createAdminClient().auth.admin.getUserById(userId);
  const realEmail = target?.user?.email?.trim().toLowerCase() || null;
  if (!realEmail) {
    console.warn("[admin-actions] account email unreadable — deletion refused", {
      subscriberId: userId,
      error: lookupError?.message ?? "no email on the auth user",
    });
    return "email_unavailable";
  }
  if (!emailMatches(confirmEmail, realEmail)) return "email_mismatch";

  // Log BEFORE erasing — the audit FK is `on delete set null`, so the row survives
  // (de-identified) but `detail` preserves what was deleted. REQUIRED: an
  // irreversible erasure with no audit trail must not happen — abort instead.
  const audit = await logAdminAccessRequired({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: "delete_subscriber_account",
    detail: { email: realEmail },
  });
  if (!audit.ok) return "audit_failed";

  await eraseUserAccount(userId);

  // Read-your-writes: expire the list's cached tables now, so the families
  // list below (and the rail counts, and ⌘K) no longer show the account.
  for (const tag of ADMIN_LIST_CACHE_TAGS) updateTag(tag);

  redirect("/admin/families");
}
