import type { AdminLocale, Currency } from "@/lib/admin/format";
import type { OverviewView } from "@/lib/admin/types";
import { fmtMoney, fmtPct } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { KpiCard } from "./KpiCard";
import { InfoTooltip } from "./InfoTooltip";

/**
 * Secondary "Cost & efficiency" group under the chart — exact AI spend scoped to
 * the same range. Recessed vs the primary metric tabs (a small subhead, no big
 * coloured tiles competing with the chart). All figures are USD-billed but shown
 * in the operator's chosen currency (SAR default) via `fmtMoney`. The total
 * carries a real per-bucket sparkline + a polarity-aware delta (rising = red);
 * the "% of revenue / billed in USD" caveats live in an info tooltip, not body
 * text.
 */
export function AiCostStrip({
  view,
  currency,
  locale,
}: {
  view: OverviewView;
  currency: Currency;
  locale: AdminLocale;
}) {
  const pct = view.aiPctOfRevenue;
  const note = [
    pct != null
      ? `${fmtPct(pct, locale)} ${t("kpi_of_revenue", locale)} · ${t("est_label", locale)}`
      : t("est_label", locale),
    t("ai_avg_active_note", locale),
    t("ai_billed_usd_note", locale),
  ].join(" · ");

  return (
    <section aria-labelledby="ov-cost-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2
            id="ov-cost-heading"
            className="adm-label uppercase text-brand-ink/70"
          >
            {t("cost_efficiency", locale)}
          </h2>
          <InfoTooltip id="ov-cost-info" text={note} label={t("info_more", locale)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          locale={locale}
          accent="yellow"
          className="md:col-span-2"
          label={t("stat_total_ai", locale)}
          value={fmtMoney(view.aiCostUsd, currency, locale, 0)}
          trend={view.aiCostDelta}
          polarity="negative"
          sparkline={view.aiCostSeries}
        />
        <KpiCard
          locale={locale}
          accent="ink"
          label={t("ai_cost_per_account", locale)}
          value={
            view.aiCostPerAccountUsd != null
              ? fmtMoney(view.aiCostPerAccountUsd, currency, locale, 2)
              : "—"
          }
          hint={t("per_account", locale)}
        />
        <KpiCard
          locale={locale}
          accent="ink"
          label={t("ai_cost_per_member", locale)}
          value={
            view.aiCostPerMemberUsd != null
              ? fmtMoney(view.aiCostPerMemberUsd, currency, locale, 2)
              : "—"
          }
          hint={t("per_beneficiary", locale)}
        />
      </div>
    </section>
  );
}
