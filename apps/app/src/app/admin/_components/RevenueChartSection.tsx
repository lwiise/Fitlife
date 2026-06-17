import type { AdminLocale } from "@/lib/admin/format";
import type { OverviewView } from "@/lib/admin/types";
import { fmtBucketLabel } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { ChartFrame } from "./ChartFrame";
import { SplineLineChart } from "./SplineLineChart";
import { OverviewChartControls } from "./OverviewChartControls";
import { MetricTabs } from "./MetricTabs";
import { InfoTooltip } from "./InfoTooltip";

const DAY_MS = 86_400_000;
function dayBefore(iso: string, locale: AdminLocale): string {
  return fmtBucketLabel(new Date(new Date(iso).getTime() - DAY_MS).toISOString(), "day", locale);
}

export function RevenueChartSection({
  view,
  baseParams,
  locale,
}: {
  view: OverviewView;
  baseParams: Record<string, string>;
  locale: AdminLocale;
}) {
  const selected = view.metrics.find((m) => m.key === view.selectedMetric);
  const labels = view.bucketIsos.map((iso) => fmtBucketLabel(iso, view.interval, locale));

  const comparison = view.comparisonOn && selected ? selected.comparison : [];
  const hasData =
    !!selected &&
    (selected.current.some((v) => v > 0) || comparison.some((v) => v > 0));

  const title = t("section_trends", locale);
  const currentLabel = t("legend_current", locale);
  const comparisonLabel = t("legend_previous", locale);

  // Legend date ranges (inclusive).
  const currentRange = `${fmtBucketLabel(view.fromValue, "day", locale)} – ${fmtBucketLabel(view.toValue, "day", locale)}`;
  const comparisonRange = `${fmtBucketLabel(view.priorStartIso, "day", locale)} – ${dayBefore(view.rangeStartIso, locale)}`;

  return (
    <section aria-labelledby="ov-chart-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 id="ov-chart-heading" className="text-lg font-bold text-brand-ink">
            {title}
          </h2>
          <InfoTooltip
            text={t("approx_snapshot", locale)}
            label={t("info_more", locale)}
          />
        </div>
        <OverviewChartControls
          locale={locale}
          preset={view.preset}
          interval={view.interval}
          comparisonOn={view.comparisonOn}
          fromValue={view.fromValue}
          toValue={view.toValue}
          baseParams={baseParams}
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-brand-ink/10 bg-surface-elevated p-4 sm:p-6">
        <MetricTabs view={view} baseParams={baseParams} locale={locale} />

        <ChartFrame
          ariaLabel={title}
          state={hasData ? "ready" : "empty"}
          locale={locale}
        >
          <SplineLineChart
            labels={labels}
            current={selected?.current ?? []}
            comparison={comparison}
            unit={selected?.unit ?? "count"}
            ariaLabel={title}
            timeLabel={t("col_when", locale)}
            currentLabel={currentLabel}
            comparisonLabel={comparisonLabel}
            deltaLabel={t("delta_label", locale)}
            locale={locale}
          />

          {/* Legend: solid = current, dotted = comparison */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-brand-ink/70">
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-6 rounded bg-brand-purple-900" aria-hidden="true" />
              {currentLabel}
              <span dir="ltr" className="tabular-nums">{currentRange}</span>
            </span>
            {view.comparisonOn ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-6 border-t-2 border-dotted border-brand-ink-muted"
                  aria-hidden="true"
                />
                {comparisonLabel}
                <span dir="ltr" className="tabular-nums">{comparisonRange}</span>
              </span>
            ) : null}
          </div>
        </ChartFrame>
      </div>
    </section>
  );
}
