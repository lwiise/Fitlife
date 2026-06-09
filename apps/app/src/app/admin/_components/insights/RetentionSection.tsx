import Link from "next/link";
import { PRICING_TIERS, type Tier } from "@fitlife/config";
import type { InsightsView } from "@/lib/admin/insights";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtDate, fmtMonth, fmtNumber, fmtPct, fmtRelative, fmtSar } from "@/lib/admin/format";
import { t, tierLabel } from "@/lib/admin/i18n";
import { DetailCard } from "../DetailCard";
import { ChartFrame } from "../ChartFrame";
import { CohortHeatmap } from "../CohortHeatmap";
import { LineChart } from "../LineChart";
import { KpiCard } from "../KpiCard";

function tierName(tier: string | null, locale: AdminLocale): string {
  const arName = tier && tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
  return tierLabel(tier, locale, arName);
}

const TH = "whitespace-nowrap px-4 py-2.5 text-start text-xs font-semibold uppercase text-brand-ink-muted";
const TD = "whitespace-nowrap px-4 py-2.5 text-sm text-brand-ink";

/** Section 2 — Are we keeping customers? Cohorts, churn, NRR, quiet accounts. */
export function RetentionSection({
  view,
  locale,
}: {
  view: InsightsView;
  locale: AdminLocale;
}) {
  const cohortRows = view.cohort.map((c) => ({
    label: fmtMonth(c.cohortMonth, locale),
    size: c.size,
    cells: c.cells,
  }));
  const colLabels = view.cohort[0]?.cells.map((_, i) => fmtNumber(i, locale)) ?? [];

  const grossLine = view.churn.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.grossPct ?? 0,
    valueLabel: fmtPct(p.grossPct, locale),
  }));
  const netLine = view.churn.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.netRevenuePct ?? 0,
    valueLabel: fmtPct(p.netRevenuePct, locale),
  }));
  const churnEmpty = view.churn.every((p) => !p.grossPct && !p.netRevenuePct);
  const cohortEmpty = view.cohort.every((c) => c.size === 0);

  return (
    <section aria-labelledby="sec-retention" className="space-y-3">
      <h2 id="sec-retention" className="text-lg font-bold text-brand-ink">
        {t("section_retention", locale)}
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <KpiCard
          locale={locale}
          accent="emerald"
          label={t("kpi_nrr", locale)}
          value={fmtPct(view.nrr.value, locale)}
          trend={view.nrr.trend}
          polarity="positive"
          hint={<span dir="auto">{t("approx_nrr", locale)}</span>}
        />
        <KpiCard
          locale={locale}
          accent="pink"
          label={t("kpi_revenue_at_risk", locale)}
          value={fmtSar(view.revenueAtRisk.totalSar, locale)}
          hint={
            <span dir="auto">
              {t("potential_label", locale)} {fmtSar(view.revenueAtRisk.trialsMrrSar, locale)} ·{" "}
              {t("at_risk_label", locale)} {fmtSar(view.revenueAtRisk.pastDueMrrSar, locale)}
            </span>
          }
        />
        <KpiCard
          locale={locale}
          accent="ink"
          label={t("ret_quiet_paying", locale)}
          value={fmtNumber(view.quietPaying.length, locale)}
        />
      </div>

      <DetailCard title={t("chart_cohort", locale)} titleAs="h3">
        <ChartFrame
          ariaLabel={t("chart_cohort", locale)}
          locale={locale}
          note={t("approx_cohort", locale)}
          state={cohortEmpty ? "empty" : "ready"}
        >
          <CohortHeatmap
            rows={cohortRows}
            colLabels={colLabels}
            ariaLabel={t("chart_cohort", locale)}
            cohortHeader={t("cohort_month", locale)}
            sizeHeader={t("cohort_size", locale)}
            locale={locale}
          />
        </ChartFrame>
      </DetailCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard title={t("gross_churn", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("gross_churn", locale)}
            locale={locale}
            note={t("approx_snapshot", locale)}
            state={churnEmpty ? "empty" : "ready"}
          >
            <LineChart data={grossLine} ariaLabel={t("gross_churn", locale)} tone="pink" />
          </ChartFrame>
        </DetailCard>
        <DetailCard title={t("net_revenue_churn", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("net_revenue_churn", locale)}
            locale={locale}
            note={t("approx_snapshot", locale)}
            state={churnEmpty ? "empty" : "ready"}
          >
            <LineChart data={netLine} ariaLabel={t("net_revenue_churn", locale)} tone="pink" />
          </ChartFrame>
        </DetailCard>
      </div>

      <DetailCard title={t("ret_quiet_paying", locale)} titleAs="h3" className="p-0">
        {view.quietPaying.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-ink-muted">{t("ops_none", locale)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <caption className="sr-only">{t("ret_quiet_paying", locale)}</caption>
              <thead className="border-b border-brand-ink/10">
                <tr>
                  <th scope="col" className={TH}>{t("col_name", locale)}</th>
                  <th scope="col" className={TH}>{t("col_tier", locale)}</th>
                  <th scope="col" className={TH}>{t("col_renewal_short", locale)}</th>
                  <th scope="col" className={TH}>{t("col_activity", locale)}</th>
                  <th scope="col" className={TH}>{t("col_mrr", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {view.quietPaying.map((q) => (
                  <tr key={q.userId} className="border-t border-brand-ink/5">
                    <td className={TD}>
                      <Link
                        href={`/admin/subscribers/${q.userId}`}
                        className="inline-flex min-h-11 items-center font-medium text-brand-purple-900 hover:underline"
                      >
                        {q.name ?? "—"}
                      </Link>
                    </td>
                    <td className={`${TD} text-brand-ink-muted`}>{tierName(q.tier, locale)}</td>
                    <td className={`${TD} text-brand-ink-muted`}>{fmtDate(q.renewalAt, locale)}</td>
                    <td className={`${TD} text-brand-ink-muted`}>{fmtRelative(q.lastActivityAt, locale)}</td>
                    <td className={`${TD} tabular-nums`} dir="ltr">{fmtSar(q.mrrSar, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailCard>
    </section>
  );
}
