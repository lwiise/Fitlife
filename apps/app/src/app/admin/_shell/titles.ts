import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin/auth";
import { isUuid } from "@/lib/admin/familyList";
import type { AdminLocale } from "@/lib/admin/format";
import { t, type AdminStringKey } from "@/lib/admin/i18n";
import { getAdminLocale } from "@/lib/admin/locale";
import { joinText } from "@/lib/admin/separators";

/**
 * Every console page's <title> (WCAG 2.4.2): «<page> | لوحة تحكم Fit Life».
 * Without it every tab, history entry and route announcement read the
 * consumer app's «فت لايف — تطبيقك». The admin layout sets the frame — the
 * app name alone, and the template its pages fill — and each page names
 * itself with one of the helpers below, in the admin's language.
 */

type TitlePart = string | null | undefined | false;

/** The admin layout's title: the app name; its pages fill «%s | <app>». */
export async function consoleLayoutMetadata(): Promise<Metadata> {
  const app = t("app_title", await getAdminLocale());
  return { title: { absolute: app, template: `%s | ${app}` } };
}

/** A page whose title is one fixed name («نظرة عامة», «العائلات»). */
export async function pageMetadata(key: AdminStringKey): Promise<Metadata> {
  return { title: t(key, await getAdminLocale()) };
}

/**
 * A page about one family: its title parts joined «X، Y» — the view and the
 * family's name, say. `loadName` is the page's own (cached) read, so the
 * title costs no extra query, and it is called only for an admin and a
 * well-formed id: metadata renders beside the page and must disclose nothing
 * the page itself would refuse to. A failed read just leaves the name out.
 * With no part at all the page keeps the app name.
 */
export async function familyPageMetadata(
  rawUserId: string,
  loadName: (userId: string) => Promise<string | null>,
  parts: (name: string | null, locale: AdminLocale) => readonly TitlePart[],
): Promise<Metadata> {
  const [admin, locale] = await Promise.all([getAdminContext(), getAdminLocale()]);
  const userId = admin && isUuid(rawUserId) ? rawUserId.toLowerCase() : null;
  const name = userId ? await loadName(userId).catch(() => null) : null;
  const title = joinText(parts(name, locale), locale);
  return title ? { title } : {};
}
