import type { AdminLocale } from "@/lib/admin/format";
import type { OverviewView } from "@/lib/admin/types";
import { fmtNumber, fmtPct, fmtUsd } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { KpiCard } from "./KpiCard";

/**
 * AI cost + users strip under the chart — all scoped to the same selected range.
 * Exact figures (real generation/chat costs), so no approximation note; the only
 * estimate is the "% of revenue" subline (range-prorated MRR), labeled "est.".
 * Reuses the KpiCard ledger tile.
 */
export function AiCostStrip({
  view,
  locale,
}: {
  view: OverviewView;
  locale: AdminLocale;
}) {
  const pct = view.aiPctOfRevenue;
  const totalHint =
    pct != null
      ? `${fmtPct(pct, locale)} ${t("kpi_of_revenue", locale)} · ${t("est_label", locale)}`
      : t("est_label", locale);

  return (
    <section
      aria-label={t("stat_total_ai", locale)}
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      <KpiCard
        locale={locale}
        accent="yellow"
        label={t("stat_total_ai", locale)}
        value={fmtUsd(view.aiCostUsd, locale)}
        hint={totalHint}
      />
      <KpiCard
        locale={locale}
        accent="ink"
        label={t("ai_cost_per_account", locale)}
        value={view.aiCostPerAccountUsd != null ? fmtUsd(view.aiCostPerAccountUsd, locale, 4) : "—"}
        hint={t("per_account", locale)}
      />
      <KpiCard
        locale={locale}
        accent="ink"
        label={t("ai_cost_per_member", locale)}
        value={view.aiCostPerMemberUsd != null ? fmtUsd(view.aiCostPerMemberUsd, locale, 4) : "—"}
        hint={t("per_beneficiary", locale)}
      />
      <KpiCard
        locale={locale}
        accent="purple"
        label={t("kpi_active_users", locale)}
        value={fmtNumber(view.totalActive, locale)}
        hint={t("kpi_active", locale)}
      />
    </section>
  );
}
