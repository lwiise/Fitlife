import type { Kpis } from "@/lib/admin/types";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtNumber, fmtPct, fmtSar, fmtUsd } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { KpiCard } from "./KpiCard";

/**
 * Hero KPI row — reordered around the founder's questions (growth/retention/
 * conversion lead; the cost tiles collapse into a unit-economics cluster).
 * Deltas + sparklines are wired to the 30/90 period the caller passes via kpis.
 */
export function KpiStrip({ kpis, locale }: { kpis: Kpis; locale: AdminLocale }) {
  const totalSubscribers = kpis.totalActive + kpis.totalTrialing;
  const marginAccent = (kpis.grossMargin.marginPct ?? 0) >= 0 ? "emerald" : "pink";

  return (
    <section
      aria-label={t("kpi_strip_label", locale)}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
    >
      {/* Growth / retention / conversion lead */}
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
        label={t("kpi_net_new_mrr", locale)}
        value={fmtSar(kpis.mrrNetSar, locale)}
        hint={
          <span dir="auto">
            {t("mrr_new", locale)} {fmtSar(kpis.mrrNewSar, locale)} ·{" "}
            {t("mrr_churned", locale)} {fmtSar(kpis.mrrChurnedSar, locale)}
          </span>
        }
      />
      <KpiCard
        locale={locale}
        accent="emerald"
        label={t("kpi_nrr", locale)}
        value={fmtPct(kpis.nrr, locale)}
        trend={kpis.nrrTrend}
        polarity="positive"
        hint={<span dir="auto">{t("est_label", locale)}</span>}
      />
      <KpiCard
        locale={locale}
        accent="pink"
        label={t("kpi_churn", locale)}
        value={fmtPct(kpis.churnRatePct, locale)}
        trend={kpis.churn.trend}
        polarity="negative"
        hint={
          <span dir="auto">
            {fmtNumber(kpis.churn.value, locale)} · {t("kpi_churn", locale)}
          </span>
        }
      />
      <KpiCard
        locale={locale}
        accent="purple"
        label={t("kpi_conversion", locale)}
        value={fmtPct(kpis.trialConversionPct, locale)}
      />
      <KpiCard
        locale={locale}
        accent="purple"
        label={t("kpi_new_signups", locale)}
        value={fmtNumber(kpis.newSignups.value, locale)}
        trend={kpis.newSignups.trend}
        polarity="positive"
        sparkline={kpis.signupsSeries}
      />

      {/* Unit-economics cluster */}
      <KpiCard
        locale={locale}
        accent="ink"
        label={t("kpi_arpu", locale)}
        value={kpis.arpuSar != null ? fmtSar(kpis.arpuSar, locale) : "—"}
      />
      <KpiCard
        locale={locale}
        accent={marginAccent}
        label={t("kpi_gross_margin", locale)}
        value={fmtPct(kpis.grossMargin.marginPct, locale)}
        hint={<span dir="auto">{t("est_label", locale)}</span>}
      />
      <KpiCard
        locale={locale}
        accent="yellow"
        label={t("kpi_ai_spend", locale)}
        value={fmtUsd(kpis.aiSpendUsd.value, locale)}
        trend={kpis.aiSpendUsd.trend}
        polarity="negative"
        sparkline={kpis.aiSpendSeries}
        hint={
          <span dir="auto">
            {fmtPct(kpis.aiSpendPctOfRevenue, locale)} {t("kpi_of_revenue", locale)}
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
        sparkline={kpis.plansSeries}
      />
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
        accent="pink"
        label={t("kpi_revenue_at_risk", locale)}
        value={fmtSar(kpis.revenueAtRiskSar, locale)}
        hint={
          <span dir="auto">
            {fmtNumber(kpis.revenueAtRiskCount, locale)}
          </span>
        }
      />
    </section>
  );
}
