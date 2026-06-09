import { PRICING_TIERS, type Tier } from "@fitlife/config";
import type { InsightsView } from "@/lib/admin/insights";
import { MARGIN_ASSUMPTIONS } from "@/lib/admin/margin";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtMonth, fmtPct, fmtSar, fmtSarCompact, fmtUsd } from "@/lib/admin/format";
import { t, tierLabel } from "@/lib/admin/i18n";
import { DetailCard, Field } from "../DetailCard";
import { ChartFrame } from "../ChartFrame";
import { DonutChart } from "../DonutChart";
import { LineChart } from "../LineChart";
import { KpiCard } from "../KpiCard";

function tierName(tier: string, locale: AdminLocale): string {
  const arName = tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
  return tierLabel(tier, locale, arName);
}

/** Section 4 — Are we earning per customer? Unit economics + revenue mix. */
export function EconomicsSection({
  view,
  locale,
}: {
  view: InsightsView;
  locale: AdminLocale;
}) {
  const gm = view.grossMargin;
  const marginAccent = (gm.marginPct ?? 0) >= 0 ? "emerald" : "pink";

  const tierSlices = view.revenueByTier.map((tr) => ({
    label: tierName(tr.tier, locale),
    value: tr.mrrSar,
    valueLabel: `${fmtSar(tr.mrrSar, locale)} · ${fmtPct(tr.pct, locale)}`,
  }));
  const aiLine = view.aiCost.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.value,
    valueLabel: fmtUsd(p.value, locale, 2),
  }));

  return (
    <section aria-labelledby="sec-economics" className="space-y-3">
      <h2 id="sec-economics" className="text-lg font-bold text-brand-ink">
        {t("section_economics", locale)}
      </h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          locale={locale}
          accent="emerald"
          label={t("kpi_mrr", locale)}
          value={fmtSar(view.mrr.mrrSar, locale)}
          hint={<span dir="auto">{t("kpi_arr", locale)} {fmtSar(view.mrr.arrSar, locale)}</span>}
        />
        <KpiCard
          locale={locale}
          accent="ink"
          label={t("kpi_arpu", locale)}
          value={view.arpuSar != null ? fmtSar(view.arpuSar, locale) : "—"}
        />
        <KpiCard
          locale={locale}
          accent={marginAccent}
          label={t("kpi_gross_margin", locale)}
          value={fmtPct(gm.marginPct, locale)}
          hint={<span dir="auto">{t("est_label", locale)}</span>}
        />
        <KpiCard
          locale={locale}
          accent="yellow"
          label={t("stat_cost_per_user", locale)}
          value={view.costPerActiveUserUsd != null ? fmtUsd(view.costPerActiveUserUsd, locale, 4) : "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard
          title={`${t("kpi_gross_margin", locale)} · ${t("est_label", locale)}`}
          titleAs="h3"
        >
          <dl>
            <Field label={t("econ_revenue", locale)} value={fmtUsd(gm.revenueUsd, locale)} mono />
            <Field label={t("econ_fees", locale)} value={fmtUsd(gm.lsFeesUsd, locale)} mono />
            <Field label={t("econ_ai_cost", locale)} value={fmtUsd(gm.aiCostUsd, locale)} mono />
            <Field label={t("econ_infra", locale)} value={fmtUsd(gm.infraUsd, locale)} mono />
            <Field label={t("econ_gross_profit", locale)} value={fmtUsd(gm.grossProfitUsd, locale)} mono />
          </dl>
          <div className="mt-2 border-t border-brand-ink/10 pt-2">
            <p className="text-xs font-semibold text-brand-ink-muted">{t("econ_assumptions", locale)}</p>
            <p className="mt-1 text-xs leading-relaxed text-brand-ink-muted">
              {t("assume_ls_fee", locale)}: {fmtPct(MARGIN_ASSUMPTIONS.ls_fee_pct * 100, locale)} +{" "}
              {fmtUsd(MARGIN_ASSUMPTIONS.ls_fee_fixed_usd, locale)} · {t("assume_infra", locale)}:{" "}
              {fmtUsd(MARGIN_ASSUMPTIONS.infra_usd_per_active_user_mo, locale)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-brand-ink-muted">{t("est_note", locale)}</p>
          </div>
        </DetailCard>

        <DetailCard title={t("chart_revenue_by_tier", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("chart_revenue_by_tier", locale)}
            locale={locale}
            state={tierSlices.length === 0 ? "empty" : "ready"}
          >
            <DonutChart
              data={tierSlices}
              ariaLabel={t("chart_revenue_by_tier", locale)}
              centerLabel={fmtSarCompact(view.mrr.mrrSar, locale)}
            />
          </ChartFrame>
        </DetailCard>
      </div>

      <DetailCard title={t("chart_ai_cost", locale)} titleAs="h3">
        <ChartFrame
          ariaLabel={t("chart_ai_cost", locale)}
          locale={locale}
          state={aiLine.every((d) => d.value === 0) ? "empty" : "ready"}
        >
          <LineChart data={aiLine} ariaLabel={t("chart_ai_cost", locale)} tone="pink" />
        </ChartFrame>
      </DetailCard>

      <p className="rounded-lg border border-dashed border-brand-ink/15 bg-brand-surface/40 px-3 py-2 text-xs text-brand-ink-muted">
        {t("ltv_cac_placeholder", locale)}
      </p>
    </section>
  );
}
