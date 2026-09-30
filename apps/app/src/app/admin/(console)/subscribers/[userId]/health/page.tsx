import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { loadSubscriberHealth } from "@/lib/admin/detail";
import { isUuid } from "@/lib/admin/familyList";
import { t } from "@/lib/admin/i18n";
import { getAdminLocale } from "@/lib/admin/locale";
import { LinkPending, Note } from "@/app/admin/_ui";
import { logHealthView } from "@/app/admin/_family/data";
import { HealthCards } from "@/app/admin/_family/HealthCards";
import { familyTabHref } from "@/app/admin/_family/model";
import "@/app/admin/_family/family.css";

/**
 * Sensitive health detail — the "extra click" behind data minimisation. It is
 * reached through the confirm dialog on the family page, and loading it
 * records a distinct `view_health_detail` audit event (PDPL), written
 * alongside the read, never after it. Nothing on this page is cached or
 * shown anywhere else in the console.
 */
export default async function FamilyHealthPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const admin = await requireAdmin();
  const { userId: rawId } = await params;
  if (!isUuid(rawId)) notFound();
  const userId = rawId.toLowerCase();

  const healthRead = loadSubscriberHealth(userId);
  const [health, , locale] = await Promise.all([
    healthRead,
    logHealthView(admin.userId, userId, healthRead),
    getAdminLocale(),
  ]);
  if (!health) notFound();

  const name = health.displayName?.trim() || null;

  return (
    <div className="ad-a-page">
      <div className="ad-a-page-in">
        <Link href={familyTabHref(userId, "household")} className="ad-crumb">
          <ChevronLeft className="ad-ic ad-flip" aria-hidden="true" />
          <bdi>{name ?? t("fp_family_page", locale)}</bdi>
          <LinkPending />
        </Link>
        <div className="ad-p-head">
          <h1>{t("health_title", locale)}</h1>
        </div>
        <Note tone="audit" role="note">
          {t("health_logged_note", locale)}
        </Note>
        <HealthCards members={health.members} locale={locale} />
      </div>
    </div>
  );
}
