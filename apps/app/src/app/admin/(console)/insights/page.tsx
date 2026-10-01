import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import type { AdminLocale } from "@/lib/admin/format";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
import { buildInsightsView, loadInsightsDataset } from "@/lib/admin/insights";
import { t } from "@/lib/admin/i18n";
import { GrowthSection } from "@/app/admin/_components/insights/GrowthSection";
import { RetentionSection } from "@/app/admin/_components/insights/RetentionSection";
import { ConversionSection } from "@/app/admin/_components/insights/ConversionSection";
import { EconomicsSection } from "@/app/admin/_components/insights/EconomicsSection";
import { ProductSection } from "@/app/admin/_components/insights/ProductSection";
import { buildQuery, flatten, type RawParams } from "@/app/admin/_components/searchParams";
import { Note } from "@/app/admin/_ui/Note";
import { INSIGHTS_HIDDEN } from "@/app/admin/_shell/insightsFlag";
import { pageMetadata } from "@/app/admin/_shell/titles";

/** «التحليلات والصحة التشغيلية | لوحة تحكم Fit Life». */
export function generateMetadata() {
  return pageMetadata("insights_title");
}

/**
 * Insights — the founder analytics narrative, top-to-bottom: Growing → Keeping
 * → Converting → Earning → Delivering. The 30/90 toggle drives the KPI deltas
 * (NRR, gross margin window); the trend charts stay monthly (6 months), since
 * cohorts/MRR-movement are inherently month-bucketed.
 *
 * Hidden for now (INSIGHTS_HIDDEN, _shell/insightsFlag.ts — the one switch for
 * the page and its rail entry). It renders inside the console frame like
 * every other console page: the frame supplies the top bar, the currency and
 * language switches and <main>; the page brings only its heading and its own
 * 30/90 period control.
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
  const currency = await getAdminCurrency();

  const params = flatten(await searchParams);
  const periodDays = params.days === "90" ? 90 : 30;

  const dataset = await loadInsightsDataset();
  const view = buildInsightsView(dataset, periodDays);

  await logAdminAccess({
    adminUserId: admin.userId,
    action: "view_insights",
    detail: { periodDays, section: "insights_v2" },
  });

  return (
    <div className="ad-a-ov">
      <div className="ad-a-ov-in">
        <div className="ad-ovhead">
          <h1>{t("insights_title", locale)}</h1>
          <PeriodControl locale={locale} periodDays={periodDays} params={params} />
        </div>
        {dataset.truncated.length > 0 ? (
          <Note tone="warn">{t("truncated_warning", locale)}</Note>
        ) : null}

        <GrowthSection view={view} locale={locale} currency={currency} />
        <RetentionSection view={view} locale={locale} currency={currency} />
        <ConversionSection view={view} locale={locale} />
        <EconomicsSection view={view} locale={locale} currency={currency} />
        <ProductSection view={view} locale={locale} />
      </div>
    </div>
  );
}

/** The 30/90-day window, as links that keep the rest of the query. */
function PeriodControl({
  locale,
  periodDays,
  params,
}: {
  locale: AdminLocale;
  periodDays: number;
  params: Record<string, string>;
}) {
  const options: Array<{ days: number; label: string }> = [
    { days: 30, label: t("period_30", locale) },
    { days: 90, label: t("period_90", locale) },
  ];
  return (
    <div className="ad-seg" role="group" aria-label={t("period_label", locale)}>
      {options.map((o) => (
        <Link
          key={o.days}
          href={buildQuery(params, { days: o.days === 30 ? undefined : o.days })}
          aria-current={o.days === periodDays ? "true" : undefined}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
