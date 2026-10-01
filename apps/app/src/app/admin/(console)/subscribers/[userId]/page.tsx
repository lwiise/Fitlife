import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadFamilyHeader } from "@/lib/admin/family";
import { isUuid } from "@/lib/admin/familyList";
import { t } from "@/lib/admin/i18n";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
import { riyadhTodayISO } from "@/lib/plans/dayMapping";
import { Note } from "@/app/admin/_ui";
import { preloadFamilyTab } from "@/app/admin/_family/data";
import { FamilyDeskHead, FamilyPhoneHead } from "@/app/admin/_family/FamilyHead";
import {
  familyName,
  familyTabLabel,
  isAuditFailure,
  parseFamilyTab,
} from "@/app/admin/_family/model";
import { TabSkeleton } from "@/app/admin/_family/skeletons";
import { FamilyTabBody } from "@/app/admin/_family/tabs";
import { familyPageMetadata } from "@/app/admin/_shell/titles";
import "@/app/admin/_family/family.css";

/** «هند القحطاني، الخطة الغذائية | لوحة تحكم Fit Life» — the family, then its tab. */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const tab = parseFamilyTab(query.tab);
  return familyPageMetadata(
    userId,
    // The page's own header read (cached per request).
    async (id) => {
      const header = await loadFamilyHeader(id);
      return header ? header.displayName ?? "" : null;
    },
    (name, locale) => [
      name !== null ? familyName(name, locale) : null,
      tab !== "summary" && familyTabLabel(tab, locale),
    ],
  );
}

/**
 * /admin/subscribers/<id> — one family, in full (Concept A · Console): the
 * head, seven tabs (?tab=summary|meal|exercise|household|billing|runs|
 * account), and the chosen tab's body.
 *
 * One round of parallel reads before anything paints: the PDPL audit row
 * (which tab was viewed), the family's head, and the admin's language and
 * currency. The body's sections start reading at the same moment (preload)
 * and stream into the page behind a skeleton — a tab switch keeps the head on
 * screen and only swaps the body. A family that does not exist is a 404.
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
  if (!isUuid(rawId)) notFound();
  const userId = rawId.toLowerCase();
  const tab = parseFamilyTab(query.tab);

  preloadFamilyTab(userId, tab);
  const [, header, locale, currency] = await Promise.all([
    logAdminAccess({
      adminUserId: admin.userId,
      subscriberId: userId,
      action: "view_subscriber_detail",
      detail: { surface: "page", tab },
    }),
    loadFamilyHeader(userId),
    getAdminLocale(),
    getAdminCurrency(),
  ]);
  if (!header) notFound();

  // "Now" and "today" for relative times and the week explorers, fixed once
  // for this render (the client parts hydrate against the same values).
  const nowIso = new Date().toISOString();
  const todayIso = riyadhTodayISO();

  return (
    <div className="ad-a-page">
      <FamilyPhoneHead header={header} tab={tab} locale={locale} />
      <div className="ad-a-page-in">
        {isAuditFailure(query.error) ? (
          <Note tone="crit" role="alert">
            {t("audit_write_failed", locale)}
          </Note>
        ) : null}
        <FamilyDeskHead header={header} tab={tab} locale={locale} />
        <Suspense key={tab} fallback={<TabSkeleton tab={tab} label={t("fp_loading_tab", locale)} />}>
          <FamilyTabBody
            tab={tab}
            userId={userId}
            header={header}
            locale={locale}
            currency={currency}
            nowIso={nowIso}
            todayIso={todayIso}
          />
        </Suspense>
      </div>
    </div>
  );
}
