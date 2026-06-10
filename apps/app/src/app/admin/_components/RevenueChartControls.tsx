import Link from "next/link";
import type { AdminLocale } from "@/lib/admin/format";
import type { OverviewMetric, RangePreset } from "@/lib/admin/types";
import { t } from "@/lib/admin/i18n";
import { buildQuery } from "./searchParams";

function pill(active: boolean): string {
  return `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
    active
      ? "bg-brand-purple-900 text-white"
      : "text-brand-ink-muted hover:text-brand-ink"
  }`;
}

/**
 * Overview chart controls — all URL-param driven (zero client JS), matching the
 * admin's server-rendered pattern. Metric toggle + range presets are <Link>
 * groups; the custom range is a native GET <form> with date inputs. Other params
 * (the subscriber table's filters/sort/metric) are preserved as hidden inputs so
 * applying a custom range doesn't reset the page around it.
 */
export function RevenueChartControls({
  locale,
  metric,
  preset,
  fromValue,
  toValue,
  baseParams,
}: {
  locale: AdminLocale;
  metric: OverviewMetric;
  preset: RangePreset;
  fromValue: string;
  toValue: string;
  baseParams: Record<string, string>;
}) {
  const metricOpts: Array<{ key: OverviewMetric; label: string }> = [
    { key: "revenue", label: t("metric_revenue", locale) },
    { key: "subs", label: t("metric_subscriptions", locale) },
  ];
  const rangeOpts: Array<{
    key: RangePreset;
    label: string;
    patch: Record<string, string | undefined>;
  }> = [
    { key: "week", label: t("range_week", locale), patch: { range: "week", from: undefined, to: undefined } },
    { key: "month", label: t("range_month", locale), patch: { range: undefined, from: undefined, to: undefined } },
  ];

  // Preserve everything except the params the form itself sets (and page, which
  // resets when the window changes).
  const preserved = Object.entries(baseParams).filter(
    ([k]) => !["range", "from", "to", "page"].includes(k),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={t("metric_label", locale)}
        className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
      >
        {metricOpts.map((o) => {
          const active = o.key === metric;
          return (
            <Link
              key={o.key}
              href={buildQuery(baseParams, { metric: o.key === "revenue" ? undefined : o.key })}
              aria-current={active ? "true" : undefined}
              className={pill(active)}
            >
              {o.label}
            </Link>
          );
        })}
      </div>

      <div
        role="group"
        aria-label={t("period_label", locale)}
        className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
      >
        {rangeOpts.map((o) => {
          const active = o.key === preset;
          return (
            <Link
              key={o.key}
              href={buildQuery(baseParams, o.patch)}
              aria-current={active ? "true" : undefined}
              className={pill(active)}
            >
              {o.label}
            </Link>
          );
        })}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        {preserved.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="range" value="custom" />
        <label className="flex flex-col gap-1 text-xs text-brand-ink-muted">
          <span>{t("date_from", locale)}</span>
          <input
            type="date"
            name="from"
            defaultValue={fromValue}
            max={toValue}
            className="min-h-11 rounded-md border border-brand-ink/15 bg-surface-elevated px-2 text-sm text-brand-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-brand-ink-muted">
          <span>{t("date_to", locale)}</span>
          <input
            type="date"
            name="to"
            defaultValue={toValue}
            className="min-h-11 rounded-md border border-brand-ink/15 bg-surface-elevated px-2 text-sm text-brand-ink"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-brand-purple-900 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-purple-700"
        >
          {t("range_apply", locale)}
        </button>
      </form>
    </div>
  );
}
