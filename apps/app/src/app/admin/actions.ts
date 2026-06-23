"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_CURRENCY_COOKIE, ADMIN_LOCALE_COOKIE } from "@/lib/admin/locale";

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
