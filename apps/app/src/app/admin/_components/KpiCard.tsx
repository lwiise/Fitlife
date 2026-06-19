import type { ReactNode } from "react";
import type { Trend } from "@/lib/admin/period";
import type { AdminLocale } from "@/lib/admin/format";
import { TrendPill } from "./TrendPill";
import { Sparkline } from "./Sparkline";

type Accent = "purple" | "pink" | "yellow" | "emerald" | "ink";

const SPINE: Record<Accent, string> = {
  purple: "bg-brand-purple-900",
  pink: "bg-brand-pink",
  yellow: "bg-brand-yellow",
  emerald: "bg-brand-emerald",
  ink: "bg-brand-ink-muted",
};

const SPARK: Record<Accent, string> = {
  purple: "text-brand-purple-900",
  pink: "text-brand-pink",
  yellow: "text-brand-warm-orange",
  emerald: "text-brand-emerald",
  ink: "text-brand-ink-muted",
};

/**
 * One KPI in the strip — a white "ledger" tile with a start-edge accent spine,
 * an uppercase micro-label, a large tabular figure, and an optional secondary
 * hint + polarity-aware trend pill.
 */
export function KpiCard({
  label,
  value,
  hint,
  trend,
  polarity = "positive",
  accent = "purple",
  sparkline,
  className = "",
  locale,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  trend?: Trend;
  polarity?: "positive" | "negative";
  accent?: Accent;
  /** Optional in-window series for a decorative trend sparkline. */
  sparkline?: number[];
  /** Layout-only extra classes (e.g. column span). */
  className?: string;
  locale: AdminLocale;
}) {
  return (
    <div
      className={`relative flex flex-col gap-2 overflow-hidden rounded-xl border border-brand-ink/10 bg-surface-elevated p-4 ps-5 shadow-sm ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 start-0 w-[3px] ${SPINE[accent]}`}
      />
      <p className="adm-label uppercase text-brand-ink-muted">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <span
          dir="ltr"
          className="text-2xl font-extrabold leading-none tabular-nums text-brand-ink"
        >
          {value}
        </span>
        {trend ? (
          <TrendPill trend={trend} polarity={polarity} locale={locale} />
        ) : null}
      </div>
      {sparkline && sparkline.length >= 2 ? (
        <Sparkline points={sparkline} className={SPARK[accent]} />
      ) : null}
      {hint ? (
        <p className="adm-micro text-brand-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
