import "server-only";

import { cookies } from "next/headers";
import type { AdminLocale } from "./format";

/** Admin language is persisted in a cookie, default Arabic. Decoupled from the
 * consumer locale system. */
export const ADMIN_LOCALE_COOKIE = "admin_locale";

export async function getAdminLocale(): Promise<AdminLocale> {
  const store = await cookies();
  return store.get(ADMIN_LOCALE_COOKIE)?.value === "en" ? "en" : "ar";
}
