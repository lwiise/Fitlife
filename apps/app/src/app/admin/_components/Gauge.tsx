import type { AdminLocale } from "@/lib/admin/format";
import { fmtPctInt } from "@/lib/admin/format";

/**
 * Radial progress gauge for a single percentage (plan freshness, activation).
 * SVG ring + centered figure, no client JS. role="img" with a localized label
 * carries the value to assistive tech; the ring is decorative. null → empty
 * ring + "—" (no fabricated zero).
 */
const COLOR: Record<string, string> = {
  emerald: "var(--color-brand-emerald)",
  purple: "var(--color-brand-purple-900)",
  warm: "var(--color-brand-warm-orange)",
};

const R = 52;
const CX = 64;
const CY = 64;
const C = 2 * Math.PI * R;

export function Gauge({
  value,
  ariaLabel,
  locale,
  tone = "emerald",
}: {
  value: number | null;
  ariaLabel: string;
  locale: AdminLocale;
  tone?: "emerald" | "purple" | "warm";
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const len = (pct / 100) * C;

  return (
    <figure
      className="m-0 grid place-items-center"
      role="img"
      aria-label={`${ariaLabel}: ${fmtPctInt(value, locale)}`}
    >
      <svg viewBox="0 0 128 128" className="size-32" aria-hidden="true">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-brand-ink)" strokeOpacity="0.08" strokeWidth="12" />
        {value != null ? (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={COLOR[tone]}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${len} ${C - len}`}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ) : null}
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-brand-ink text-[1.4rem] font-extrabold tabular-nums"
        >
          {fmtPctInt(value, locale)}
        </text>
      </svg>
    </figure>
  );
}
