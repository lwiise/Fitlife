"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { logAdminAccess } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { eraseUserAccount } from "@/lib/account/erase";
import { ADMIN_CURRENCY_COOKIE, ADMIN_LOCALE_COOKIE } from "@/lib/admin/locale";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Persist the admin's language choice (cookie) and return to the page they were
 * on. Gated by requireAdmin (defense in depth — server actions re-check), and
 * `next` is constrained to /admin paths to prevent open redirects.
 */
export async function setAdminLocale(formData: FormData) {
  await requireAdmin();

  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const nextRaw = String(formData.get("next") ?? "/admin");
  const next = nextRaw.startsWith("/admin") ? nextRaw : "/admin";

  const store = await cookies();
  store.set(ADMIN_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  redirect(next);
}

/**
 * Persist the admin's display-currency choice (cookie) and return to the page
 * they were on. Mirrors setAdminLocale exactly — requireAdmin gate, `next`
 * constrained to /admin paths to prevent open redirects.
 */
export async function setAdminCurrency(formData: FormData) {
  await requireAdmin();

  const currency = formData.get("currency") === "usd" ? "usd" : "sar";
  const nextRaw = String(formData.get("next") ?? "/admin");
  const next = nextRaw.startsWith("/admin") ? nextRaw : "/admin";

  const store = await cookies();
  store.set(ADMIN_CURRENCY_COOKIE, currency, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  redirect(next);
}

/**
 * Deactivate (ban) or reactivate (unban) a subscriber via GoTrue — reversible,
 * blocks login while keeping all data. Any admin; the action refuses to touch an
 * admin account. The redirect re-renders the (uncached) detail page so the new
 * status shows immediately.
 */
export async function setSubscriberActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!UUID_RE.test(userId)) redirect("/admin");
  if (await isTargetAdmin(userId)) redirect(`/admin/subscribers/${userId}`);

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h", // ~100 years = "deactivated"
  });
  if (error) throw error;

  await logAdminAccess({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: active
      ? "reactivate_subscriber_account"
      : "deactivate_subscriber_account",
  });

  redirect(`/admin/subscribers/${userId}`);
}

/**
 * Permanently delete a subscriber account (PDPL erasure) — irreversible: cascades
 * all their data and cancels billing. The admin must re-type the subscriber's
 * email, verified server-side. Any admin; refuses to delete an admin account.
 */
export async function deleteSubscriberAccount(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const confirmEmail = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  if (!UUID_RE.test(userId)) redirect("/admin");
  if (await isTargetAdmin(userId)) redirect(`/admin/subscribers/${userId}`);

  // Server-side confirmation: the typed email must match the account's real email.
  const { data: target } = await createAdminClient().auth.admin.getUserById(userId);
  const realEmail = target?.user?.email?.trim().toLowerCase() ?? null;
  if (!realEmail || confirmEmail !== realEmail) {
    redirect(`/admin/subscribers/${userId}`);
  }

  // Log BEFORE erasing — the audit FK is `on delete set null`, so the row survives
  // (de-identified) but `detail` preserves what was deleted.
  await logAdminAccess({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: "delete_subscriber_account",
    detail: { email: realEmail },
  });

  await eraseUserAccount(userId);

  redirect("/admin");
}
