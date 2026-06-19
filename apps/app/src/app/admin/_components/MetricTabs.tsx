import Link from "next/link";
import type { AdminLocale } from "@/lib/admin/format";
import type { MetricKey, OverviewView } from "@/lib/admin/types";
import { fmtMetricValue } from "@/lib/admin/format";
import { metricLabel, t } from "@/lib/admin/i18n";
import { DEFAULT_METRICS, METRIC_POOL } from "@/lib/admin/timeseries";
import { buildQuery } from "./searchParams";
import { TrendPill } from "./TrendPill";
import { Sparkline } from "./Sparkline";

/** A rising value is "good" for everything except churn. */
function metricPolarity(key: MetricKey): "positive" | "negative" {
  return key === "churned" ? "negative" : "positive";
}

function sameSet(a: MetricKey[], b: MetricKey[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
/** CSV for the `metrics` param, omitted when it equals the default set. */
function metricsParam(list: MetricKey[]): string | undefined {
  const next = list.length > 0 ? list : DEFAULT_METRICS;
  return sameSet(next, DEFAULT_METRICS) ? undefined : next.join(",");
}

/**
 * The metric row: up to 4 tabs (label · big value · period-over-period delta),
 * the selected one in a subtle highlight; clicking a tab re-plots the chart. All
 * URL-param driven. "Customize metrics" is a native <details> disclosure of
 * toggle links over the metric pool (zero JS), capped at 4.
 */
export function MetricTabs({
  view,
  baseParams,
  locale,
}: {
  view: OverviewView;
  baseParams: Record<string, string>;
  locale: AdminLocale;
}) {
  const byKey = new Map(view.metrics.map((m) => [m.key, m]));

  return (
    <div className="space-y-3">
      <div
        role="group"
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
        aria-label={t("kpi_strip_label", locale)}
      >
        {view.shownMetrics.map((key) => {
          const mv = byKey.get(key);
          if (!mv) return null;
          const active = key === view.selectedMetric;
          return (
            <Link
              key={key}
              href={buildQuery(baseParams, {
                metric: key === "gross_revenue" ? undefined : key,
              })}
              aria-current={active ? "true" : undefined}
              className={`relative flex min-h-11 flex-col gap-1.5 overflow-hidden rounded-xl border bg-surface-elevated p-3 ps-4 shadow-sm transition ${
                active
                  ? "border-brand-purple-900/30 bg-brand-purple-900/[0.06] ring-1 ring-inset ring-brand-purple-900/30"
                  : "border-brand-ink/10 hover:border-brand-ink/25"
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 start-0 w-[3px] bg-brand-purple-900"
              />
              <span className="adm-label uppercase text-brand-ink-muted">
                {metricLabel(key, locale)}
              </span>
              <span
                dir="ltr"
                className={`tabular-nums text-brand-ink ${
                  active ? "adm-display" : "text-xl font-extrabold leading-none"
                }`}
              >
                {fmtMetricValue(mv.headline, mv.unit, locale)}
              </span>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <TrendPill
                  trend={mv.delta}
                  polarity={metricPolarity(key)}
                  locale={locale}
                />
                {mv.current.length >= 2 ? (
                  <Sparkline
                    points={mv.current}
                    className={active ? "text-brand-purple-900" : "text-brand-ink-muted"}
                  />
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-brand-ink-muted hover:text-brand-ink">
          {t("customize_metrics", locale)}
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {METRIC_POOL.map((key) => {
            const on = view.shownMetrics.includes(key);
            const atCap = view.shownMetrics.length >= 4;
            const disabled = !on && atCap;
            const next = on
              ? view.shownMetrics.filter((k) => k !== key)
              : [...view.shownMetrics, key];
            if (disabled) {
              // Focusable + announced (no `disabled` attr) so keyboard/SR users
              // discover the 4-metric cap; no handler → clicking is a no-op.
              return (
                <button
                  key={key}
                  type="button"
                  aria-disabled="true"
                  className="inline-flex min-h-11 cursor-not-allowed items-center rounded-full border border-brand-ink/15 px-3 text-sm text-brand-ink-muted opacity-40"
                >
                  {metricLabel(key, locale)}
                </button>
              );
            }
            return (
              <Link
                key={key}
                href={buildQuery(baseParams, { metrics: metricsParam(next) })}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                  on
                    ? "border-brand-purple-900 bg-brand-purple-900 text-white"
                    : "border-brand-ink/15 text-brand-ink-muted hover:text-brand-ink"
                }`}
              >
                {on ? <span aria-hidden="true">✓</span> : null}
                {metricLabel(key, locale)}
                {on ? <span className="sr-only"> ({t("kpi_active", locale)})</span> : null}
              </Link>
            );
          })}
        </div>
      </details>
    </div>
  );
}
