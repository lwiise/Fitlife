import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { loadFamilyHeader } from "@/lib/admin/family";
import { isUuid } from "@/lib/admin/familyList";
import { getAdminLocale } from "@/lib/admin/locale";
import { FamilyDeskHead, FamilyPhoneHead } from "@/app/admin/_family/FamilyHead";
import { FamilyHeadProvider } from "@/app/admin/_family/headSnapshot";
import "@/app/admin/_family/family.css";

/**
 * The family page's frame: its head — name, email, chips, the health entry
 * and the tab bar — read and rendered ONCE per visit to a family.
 *
 * `?tab` belongs to the page below (./page.tsx), and a change of search
 * params re-renders the page segment alone: a tab switch costs the page's
 * auth check, its audit row and that tab's own reads, never this header
 * (profile, auth user, subscriptions, members, plan rows, runs, chat). The
 * tab bar reads the tab shown from the URL (FamilyTabs), and the tab bodies
 * built from the header take it from this same read (FamilyHeadProvider).
 *
 * The route group wraps the family page only: the health page and the plan
 * and program views under the same family keep their own heads. A family
 * that does not exist is a 404. An account action that changes what the head
 * shows (deactivate, reactivate) refreshes the route, this layout included.
 *
 * requireAdmin() here AND in the page: on a tab switch this layout does not
 * run, so it cannot be the gate; on a first load both share one check.
 */
export default async function FamilyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId: rawId } = await params;
  if (!isUuid(rawId)) notFound();
  const userId = rawId.toLowerCase();

  const [header, locale] = await Promise.all([loadFamilyHeader(userId), getAdminLocale()]);
  if (!header) notFound();

  return (
    <div className="ad-a-page">
      <FamilyPhoneHead header={header} locale={locale} />
      <div className="ad-a-page-in">
        <FamilyDeskHead header={header} locale={locale} />
        <FamilyHeadProvider head={header}>{children}</FamilyHeadProvider>
      </div>
    </div>
  );
}
