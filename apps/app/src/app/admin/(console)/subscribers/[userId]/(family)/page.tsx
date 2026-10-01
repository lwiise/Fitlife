import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { isUuid } from "@/lib/admin/familyList";
import { t } from "@/lib/admin/i18n";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
import { riyadhTodayISO } from "@/lib/plans/dayMapping";
import { Note } from "@/app/admin/_ui";
import { loadProfileName, preloadFamilyTab } from "@/app/admin/_family/data";
import {
  accountRefusalText,
  familyName,
  familyTabLabel,
  parseAccountRefusal,
  parseFamilyTab,
} from "@/app/admin/_family/model";
import { TabSkeleton } from "@/app/admin/_family/skeletons";
import { FamilyTabBody } from "@/app/admin/_family/tabs";
import { familyPageMetadata } from "@/app/admin/_shell/titles";

/**
 * «هند القحطاني، الخطة الغذائية | لوحة تحكم Fit Life» — the family, then its
 * tab. Re-made on every tab switch, so it reads the one name column rather
 * than the header the layout holds.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const tab = parseFamilyTab(query.tab);
  return familyPageMetadata(userId, loadProfileName, (name, locale) => [
    name !== null ? familyName(name, locale) : null,
    tab !== "summary" && familyTabLabel(tab, locale),
  ]);
}

/**
 * /admin/subscribers/<id> — one family, in full (Concept A · Console): the
 * head (./layout.tsx), seven tabs (?tab=summary|meal|exercise|household|
 * billing|runs|account), and the chosen tab's body — this page.
 *
 * A tab switch re-renders this page and nothing above it. Before anything
 * paints it writes the PDPL audit row (which tab was viewed) alongside the
 * admin's language and currency; the body's sections start reading at the
 * same moment (preload) and stream in behind the tab's skeleton. The head
 * stays on screen throughout, and is not read again.
 *
 * `?error=` is an account action that did not run (deactivation's refusals;
 * deletion's are stated in its dialog): said above the body, in the tab the
 * action returned to.
 */
export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const [{ userId: rawId }, query] = await Promise.all([params, searchParams]);
  // The layout answers a malformed id with a 404 too; checked here as well so
  // no audit row is ever written for one.
  if (!isUuid(rawId)) notFound();
  const userId = rawId.toLowerCase();
  const tab = parseFamilyTab(query.tab);
  const refusal = parseAccountRefusal(query.error);

  preloadFamilyTab(userId, tab);
  const [, locale, currency] = await Promise.all([
    logAdminAccess({
      adminUserId: admin.userId,
      subscriberId: userId,
      action: "view_subscriber_detail",
      detail: { surface: "page", tab },
    }),
    getAdminLocale(),
    getAdminCurrency(),
  ]);

  // "Now" and "today" for relative times and the week explorers, fixed once
  // for this render (the client parts hydrate against the same values).
  const nowIso = new Date().toISOString();
  const todayIso = riyadhTodayISO();

  return (
    <>
      {refusal ? (
        <Note tone="crit" role="alert">
          {accountRefusalText(refusal, locale)}
        </Note>
      ) : null}
      <Suspense key={tab} fallback={<TabSkeleton tab={tab} label={t("fp_loading_tab", locale)} />}>
        <FamilyTabBody
          tab={tab}
          userId={userId}
          locale={locale}
          currency={currency}
          nowIso={nowIso}
          todayIso={todayIso}
        />
      </Suspense>
    </>
  );
}
