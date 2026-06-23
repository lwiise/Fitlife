"use client";

import { useCallback, useState } from "react";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import type { MetricKey, OverviewView } from "@/lib/admin/types";
import { fmtBucketLabel } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { ChartFrame } from "./ChartFrame";
import { SplineLineChart } from "./SplineLineChart";
import { MetricTabs } from "./MetricTabs";

/**
 * Interactive metric tabs + spline chart. Every shown metric's full series is
 * already on the client in `view.metrics`, so switching the plotted metric is a
 * local state change — an INSTANT re-plot with no server round-trip (the
 * round-trip is what made tab-switching slow). The URL is synced via
 * history.replaceState so refresh/share keep the metric, again without a navigation.
 * Range/granularity still re-fetch (different data) and stay server-driven in
 * the parent's OverviewChartControls.
 */
export function TrendsBoard({
  view,
  baseParams,
  locale,
  currency,
}: {
  view: OverviewView;
  baseParams: Record<string, string>;
  locale: AdminLocale;
  currency: Currency;
}) {
  const [metric, setMetric] = useState<MetricKey>(view.selectedMetric);

  const onSelect = useCallback((key: MetricKey) => {
    setMetric(key);
    try {
      const url = new URL(window.location.href);
      if (key === "gross_revenue") url.searchParams.delete("metric");
      else url.searchParams.set("metric", key);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* non-browser / blocked — local state still drives the chart */
    }
  }, []);

  const selected =
    view.metrics.find((m) => m.key === metric) ??
    view.metrics.find((m) => m.key === view.selectedMetric);
  const labels = view.bucketIsos.map((iso) =>
    fmtBucketLabel(iso, view.interval, locale),
  );
  const hasData = !!selected && selected.current.some((v) => v > 0);

  const title = t("section_trends", locale);
  const currentLabel = t("legend_current", locale);
  const currentRange = `${fmtBucketLabel(view.fromValue, "day", locale)} – ${fmtBucketLabel(view.toValue, "day", locale)}`;

  return (
    <div className="space-y-4 rounded-xl border border-brand-ink/10 bg-surface-elevated p-4 shadow-sm sm:p-6">
      <MetricTabs
        view={view}
        baseParams={baseParams}
        locale={locale}
        currency={currency}
        selected={metric}
        onSelect={onSelect}
      />

      <ChartFrame
        ariaLabel={title}
        state={!selected ? "error" : hasData ? "ready" : "empty"}
        locale={locale}
      >
        <SplineLineChart
          labels={labels}
          current={selected?.current ?? []}
          unit={selected?.unit ?? "count"}
          ariaLabel={title}
          timeLabel={t("col_when", locale)}
          currentLabel={currentLabel}
          locale={locale}
          currency={currency}
        />

        {/* Legend: the plotted current-range series. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 adm-micro text-brand-ink/70">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-0.5 w-6 rounded bg-brand-purple-900"
              aria-hidden="true"
            />
            {currentLabel}
            <span dir="ltr" className="tabular-nums">
              {currentRange}
            </span>
          </span>
        </div>
      </ChartFrame>
    </div>
  );
}
