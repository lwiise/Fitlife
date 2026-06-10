import { PRICING_TIERS, type Tier } from "@fitlife/config";
import type { AdminLocale } from "@/lib/admin/format";
import type { OverviewView } from "@/lib/admin/types";
import { fmtBucketLabel, fmtNumber, fmtSarCompact } from "@/lib/admin/format";
import { t, tierLabel } from "@/lib/admin/i18n";
import { ChartFrame } from "./ChartFrame";
import { StackedTimeChart, type StackedSeries } from "./StackedTimeChart";
import { RevenueChartControls } from "./RevenueChartControls";

/**
 * Tier → segment colour. Fixed across both metrics and all ranges so the legend
 * reads consistently: a deep-purple anchor, brand pink, a mid-violet, and a warm
 * amber. The violet/amber are brand lavender/warm-orange deepened to clear the
 * WCAG 1.4.11 3:1 non-text-contrast bar on the white card (the lighter tokens
 * sat at ~1.8:1 / ~2.3:1); all four stay mutually distinguishable when stacked.
 */
const TIER_COLORS: Record<string, string> = {
  starter: "var(--color-brand-purple-900)", // #4e2490 — 10.8:1 on white
  pro: "var(--color-brand-pink)", // #c5458f — 4.22:1
  family: "#7c4bbd", // deepened lavender (violet) — ~4.4:1
  premium: "#b5600a", // deepened warm-orange (amber) — ~5.4:1
};

export function RevenueChartSection({
  view,
  baseParams,
  locale,
}: {
  view: OverviewView;
  baseParams: Record<string, string>;
  locale: AdminLocale;
}) {
  const isRevenue = view.metric === "revenue";
  const labels = view.bucketIsos.map((iso) =>
    fmtBucketLabel(iso, view.granularity, locale),
  );

  const series: StackedSeries[] = view.tiers.map((tier) => {
    const arName = tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
    const values = (isRevenue ? view.revenueByTier[tier] : view.countByTier[tier]) ?? [];
    return {
      key: tier,
      label: tierLabel(tier, locale, arName),
      color: TIER_COLORS[tier] ?? "var(--color-brand-ink-muted)",
      values,
    };
  });

  const formatValue = isRevenue
    ? (n: number) => fmtSarCompact(n, locale)
    : (n: number) => fmtNumber(n, locale);

  const hasData = series.some((s) => s.values.some((v) => v > 0));
  const title = t("chart_revenue_subscriptions", locale);

  return (
    <section aria-labelledby="ov-revsub-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ov-revsub-heading" className="text-lg font-bold text-brand-ink">
          {title}
        </h2>
        <RevenueChartControls
          locale={locale}
          metric={view.metric}
          preset={view.preset}
          fromValue={view.fromValue}
          toValue={view.toValue}
          baseParams={baseParams}
        />
      </div>

      <div className="rounded-2xl border border-brand-ink/10 bg-surface-elevated p-4 sm:p-6">
        <ChartFrame
          ariaLabel={title}
          state={hasData ? "ready" : "empty"}
          note={t("approx_snapshot", locale)}
          locale={locale}
        >
          <StackedTimeChart
            labels={labels}
            series={series}
            ariaLabel={title}
            timeLabel={t("col_when", locale)}
            totalLabel={t("col_total", locale)}
            formatValue={formatValue}
          />
        </ChartFrame>
      </div>
    </section>
  );
}
