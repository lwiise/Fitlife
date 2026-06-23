import "server-only";

import { cookies } from "next/headers";
import type { AdminLocale, Currency } from "./format";

/** Admin language is persisted in a cookie, default Arabic. Decoupled from the
 * consumer locale system. */
export const ADMIN_LOCALE_COOKIE = "admin_locale";

/** Operator display-currency choice, persisted like the language cookie
 * (default SAR). Read per-request — the admin layout is force-dynamic. */
export const ADMIN_CURRENCY_COOKIE = "admin_currency";

export async function getAdminLocale(): Promise<AdminLocale> {
  const store = await cookies();
  return store.get(ADMIN_LOCALE_COOKIE)?.value === "en" ? "en" : "ar";
}

export async function getAdminCurrency(): Promise<Currency> {
  const store = await cookies();
  return store.get(ADMIN_CURRENCY_COOKIE)?.value === "usd" ? "usd" : "sar";
}
