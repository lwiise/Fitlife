import Link from "next/link";
import type { AdminLocale } from "@/lib/admin/format";
import type { Granularity, RangePreset } from "@/lib/admin/types";
import { intervalLabel, t } from "@/lib/admin/i18n";
import { buildQuery } from "./searchParams";

function pill(active: boolean): string {
  return `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
    active ? "bg-brand-purple-900 text-white" : "text-brand-ink-muted hover:text-brand-ink"
  }`;
}

/**
 * Kajabi-style filter bar — all URL-param driven (zero client JS). Date presets
 * + custom-range GET form and interval grouping. The chart plots SAR-native
 * revenue metrics, so currency lives with the cost strip (the only USD-billed
 * figures), not here. Mirrors the server-rendered pill pattern.
 */
export function OverviewChartControls({
  locale,
  preset,
  interval,
  fromValue,
  toValue,
  baseParams,
}: {
  locale: AdminLocale;
  preset: RangePreset;
  interval: Granularity;
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
      <form method="get" className="flex flex-wrap items-center gap-2">
        {preserved.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="range" value="custom" />
        <label className="inline-flex min-h-11 items-center gap-1.5 text-xs text-brand-ink-muted">
          <span>{t("date_from", locale)}</span>
          <input
            type="date"
            name="from"
            defaultValue={fromValue}
            max={toValue}
            className="min-h-11 rounded-lg border border-brand-ink/15 bg-surface-elevated px-2 text-sm text-brand-ink"
          />
        </label>
        <label className="inline-flex min-h-11 items-center gap-1.5 text-xs text-brand-ink-muted">
          <span>{t("date_to", locale)}</span>
          <input
            type="date"
            name="to"
            defaultValue={toValue}
            className="min-h-11 rounded-lg border border-brand-ink/15 bg-surface-elevated px-2 text-sm text-brand-ink"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand-purple-900 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-purple-700"
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
    </div>
  );
}
