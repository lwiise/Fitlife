/**
 * Donut chart via SVG stroke-dasharray arcs (no client JS, no chart lib). Radial
 * → no RTL mirroring concern; the legend localizes. The visual is aria-hidden
 * and a hidden table carries the values. Colors cycle a small brand palette.
 */
export interface DonutSlice {
  label: string;
  value: number;
  valueLabel: string;
}

// CSS custom-property colors (defined in globals.css @theme).
const PALETTE = [
  "var(--color-brand-purple-900)",
  "var(--color-brand-pink)",
  "var(--color-brand-lavender)",
  "var(--color-brand-yellow)",
  "var(--color-brand-emerald)",
  "var(--color-brand-warm-orange)",
];

const R = 60;
const CX = 80;
const CY = 80;
const C = 2 * Math.PI * R;

export function DonutChart({
  data,
  ariaLabel,
  centerLabel,
}: {
  data: DonutSlice[];
  ariaLabel: string;
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  // Precompute arc lengths + cumulative offsets functionally (no mutation
  // across the render — react-hooks/immutability).
  const lens = data.map((d) => (total > 0 ? (d.value / total) * C : 0));
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((s, l) => s + l, 0));

  return (
    <figure
      aria-label={centerLabel ? `${ariaLabel}: ${centerLabel}` : ariaLabel}
      className="m-0 flex flex-wrap items-center gap-5"
    >
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.label}</th>
              <td>{d.valueLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <svg viewBox="0 0 160 160" className="size-36 shrink-0" aria-hidden="true">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-brand-ink)" strokeOpacity="0.06" strokeWidth="20" />
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          {data.map((d, i) => {
            const len = lens[i] ?? 0;
            return (
              <circle
                key={i}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth="20"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-(offsets[i] ?? 0)}
              />
            );
          })}
        </g>
        {centerLabel ? (
          <text
            x={CX}
            y={CY}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-brand-ink text-[1.1rem] font-extrabold tabular-nums"
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>

      <ul className="flex flex-col gap-1.5 text-sm">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-brand-ink">{d.label}</span>
            <span dir="ltr" className="tabular-nums text-brand-ink-muted">
              {d.valueLabel}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
