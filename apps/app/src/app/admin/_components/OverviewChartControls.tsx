import Link from "next/link";
import type { AdminLocale } from "@/lib/admin/format";
import type { Granularity, RangePreset } from "@/lib/admin/types";
import { intervalLabel, t } from "@/lib/admin/i18n";
import { buildQuery } from "./searchParams";

function pill(active: boolean): string {
  return `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
    active ? "bg-brand-purple-900 text-white" : "text-brand-ink-muted hover:text-brand-ink"
  }`;
}

/**
 * Kajabi-style filter bar — all URL-param driven (zero client JS). Date presets
 * + custom-range GET form, interval grouping, a comparison toggle, and a static
 * SAR label (this product is SAR-only — no currency menu). Mirrors the admin's
 * server-rendered pill pattern.
 */
export function OverviewChartControls({
  locale,
  preset,
  interval,
  comparisonOn,
  fromValue,
  toValue,
  baseParams,
}: {
  locale: AdminLocale;
  preset: RangePreset;
  interval: Granularity;
  comparisonOn: boolean;
  fromValue: string;
  toValue: string;
  baseParams: Record<string, string>;
}) {
  const rangeOpts: Array<{ key: RangePreset; label: string; range?: string }> = [
    { key: "24h", label: t("range_24h", locale), range: "24h" },
    { key: "7d", label: t("range_7d", locale), range: "7d" },
    { key: "30d", label: t("period_30", locale) }, // default → clean URL
    { key: "90d", label: t("period_90", locale), range: "90d" },
  ];

  const intervalOpts: Granularity[] =
    preset === "24h" ? ["hour", "day"] : ["day", "week", "month"];

  // Preserve everything except what the custom-range form sets (+ page).
  const preserved = Object.entries(baseParams).filter(
    ([k]) => !["range", "from", "to", "page"].includes(k),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range presets */}
      <div
        role="group"
        aria-label={t("period_label", locale)}
        className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
      >
        {rangeOpts.map((o) => (
          <Link
            key={o.key}
            href={buildQuery(baseParams, { range: o.range, from: undefined, to: undefined })}
            aria-current={o.key === preset ? "true" : undefined}
            className={pill(o.key === preset)}
          >
            {o.label}
          </Link>
        ))}
      </div>

      {/* Custom range */}
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

      {/* Interval grouping */}
      <div
        role="group"
        aria-label={t("interval_label", locale)}
        className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
      >
        {intervalOpts.map((g) => (
          <Link
            key={g}
            href={buildQuery(baseParams, { interval: g })}
            aria-current={g === interval ? "true" : undefined}
            className={pill(g === interval)}
          >
            {intervalLabel(g, locale)}
          </Link>
        ))}
      </div>

      {/* Comparison toggle */}
      <Link
        href={buildQuery(baseParams, { cmp: comparisonOn ? "off" : undefined })}
        aria-current={comparisonOn ? "true" : undefined}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
          comparisonOn
            ? "border-brand-purple-900/40 bg-brand-surface text-brand-ink"
            : "border-brand-ink/15 text-brand-ink-muted hover:text-brand-ink"
        }`}
      >
        {t("compare_label", locale)}
        <span className="text-xs text-brand-ink-muted">
          {comparisonOn ? t("compare_prior", locale) : t("compare_off", locale)}
        </span>
      </Link>

      {/* Static currency (SAR-only) */}
      <span className="inline-flex min-h-11 items-center rounded-lg border border-brand-ink/10 bg-brand-surface px-3 text-sm font-medium text-brand-ink-muted">
        {t("currency_label", locale)}
      </span>
    </div>
  );
}
