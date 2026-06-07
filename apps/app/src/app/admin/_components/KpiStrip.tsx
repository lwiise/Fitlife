import type { Kpis } from "@/lib/admin/types";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtNumber, fmtPct, fmtSar, fmtUsd } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { KpiCard } from "./KpiCard";

export function KpiStrip({ kpis, locale }: { kpis: Kpis; locale: AdminLocale }) {
  const totalSubscribers = kpis.totalActive + kpis.totalTrialing;

  return (
    <section
      aria-label={t("kpi_strip_label", locale)}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
    >
      <KpiCard
        locale={locale}
        accent="purple"
        label={t("kpi_subscribers", locale)}
        value={fmtNumber(totalSubscribers, locale)}
        hint={
          <span dir="auto">
            {fmtNumber(kpis.totalActive, locale)} {t("kpi_active", locale)} ·{" "}
            {fmtNumber(kpis.totalTrialing, locale)} {t("kpi_trialing", locale)}
          </span>
        }
      />
      <KpiCard
        locale={locale}
        accent="emerald"
        label={t("kpi_mrr", locale)}
        value={fmtSar(kpis.mrr.mrrSar, locale)}
        hint={
          <span dir="auto">
            {t("kpi_arr", locale)} {fmtSar(kpis.mrr.arrSar, locale)}
          </span>
        }
      />
      <KpiCard
        locale={locale}
        accent="purple"
        label={t("kpi_new_signups", locale)}
        value={fmtNumber(kpis.newSignups.value, locale)}
        trend={kpis.newSignups.trend}
        polarity="positive"
        hint={
          <span dir="auto">
            {t("kpi_conversion", locale)}: {fmtPct(kpis.trialConversionPct, locale)}
          </span>
        }
      />
      <KpiCard
        locale={locale}
        accent="pink"
        label={t("kpi_churn", locale)}
        value={fmtNumber(kpis.churn.value, locale)}
        trend={kpis.churn.trend}
        polarity="negative"
        hint={
          <span dir="auto">
            {t("kpi_churn_rate", locale)}: {fmtPct(kpis.churnRatePct, locale)}
          </span>
        }
      />
      <KpiCard
        locale={locale}
        accent="purple"
        label={t("kpi_plans", locale)}
        value={fmtNumber(kpis.plansGenerated.value, locale)}
        trend={kpis.plansGenerated.trend}
        polarity="positive"
      />
      <KpiCard
        locale={locale}
        accent="yellow"
        label={t("kpi_ai_spend", locale)}
        value={fmtUsd(kpis.aiSpendUsd.value, locale)}
        trend={kpis.aiSpendUsd.trend}
        polarity="negative"
        hint={
          <span dir="auto">
            {fmtPct(kpis.aiSpendPctOfRevenue, locale)} {t("kpi_of_revenue", locale)}
          </span>
        }
      />
      <KpiCard
        locale={locale}
        accent="ink"
        label={t("kpi_avg_household", locale)}
        value={fmtNumber(kpis.avgHousehold, locale)}
        hint={t("kpi_beneficiaries", locale)}
      />
    </section>
  );
}
