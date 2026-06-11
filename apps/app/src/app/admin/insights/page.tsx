import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { getAdminLocale } from "@/lib/admin/locale";
import { buildInsightsView, loadInsightsDataset } from "@/lib/admin/insights";
import { t } from "@/lib/admin/i18n";
import { AdminTopBar } from "../_components/AdminTopBar";
import { GrowthSection } from "../_components/insights/GrowthSection";
import { RetentionSection } from "../_components/insights/RetentionSection";
import { ConversionSection } from "../_components/insights/ConversionSection";
import { EconomicsSection } from "../_components/insights/EconomicsSection";
import { ProductSection } from "../_components/insights/ProductSection";
import { flatten, type RawParams } from "../_components/searchParams";

/**
 * Insights is temporarily hidden from the admin panel. The page (and all its
 * data/components) is left intact; set this to `false` to bring it back, and
 * restore the Insights nav tab in AdminTopBar.tsx.
 */
const INSIGHTS_HIDDEN: boolean = true;

/**
 * Insights — the founder analytics narrative, top-to-bottom: Growing → Keeping
 * → Converting → Earning → Delivering. The 30/90 toggle drives the KPI deltas
 * (NRR, gross margin window); the trend charts stay monthly (6 months), since
 * cohorts/MRR-movement are inherently month-bucketed.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  if (INSIGHTS_HIDDEN) {
    redirect("/admin");
  }

  const admin = await requireAdmin();
  const locale = await getAdminLocale();

  const params = flatten(await searchParams);
  const baseParams = params;
  const periodDays = params.days === "90" ? 90 : 30;

  const dataset = await loadInsightsDataset();
  const view = buildInsightsView(dataset, periodDays);

  await logAdminAccess({
    adminUserId: admin.userId,
    action: "view_insights",
    detail: { periodDays, section: "insights_v2" },
  });

  return (
    <>
      <AdminTopBar
        locale={locale}
        activeNav="insights"
        adminEmail={admin.email}
        periodDays={periodDays}
        baseParams={baseParams}
      />

      <main className="container-app space-y-8 py-6">
        <h1 className="sr-only">{t("insights_title", locale)}</h1>
        {dataset.truncated.length > 0 ? (
          <p className="rounded-lg border border-brand-warm-orange/30 bg-brand-warm-orange/10 px-3 py-2 text-sm text-brand-ink">
            {t("truncated_warning", locale)}
          </p>
        ) : null}

        <GrowthSection view={view} locale={locale} />
        <RetentionSection view={view} locale={locale} />
        <ConversionSection view={view} locale={locale} />
        <EconomicsSection view={view} locale={locale} />
        <ProductSection view={view} locale={locale} />
      </main>
    </>
  );
}
