/**
 * Minimal, dependency-free bar chart (CSS heights — no client JS). The visual
 * plot is marked aria-hidden and a visually-hidden data table carries the real
 * values to assistive tech. Time flows left→right regardless of locale, so the
 * plot is forced LTR; labels are localized by the caller.
 *
 * Bar heights are data-driven geometry → the one place a runtime value can't be
 * a Tailwind class, so `style` is used.
 */
export interface BarDatum {
  label: string;
  value: number;
  valueLabel: string;
}

const TONE: Record<string, string> = {
  purple: "bg-brand-purple-900",
  pink: "bg-brand-pink",
  emerald: "bg-brand-emerald",
};

export function BarChart({
  data,
  ariaLabel,
  tone = "purple",
}: {
  data: BarDatum[];
  ariaLabel: string;
  tone?: "purple" | "pink" | "emerald";
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <figure aria-label={ariaLabel} className="m-0">
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

      <div aria-hidden="true" dir="ltr">
        <div className="flex h-40 items-end gap-2">
          {data.map((d, i) => {
            const pct = d.value > 0 ? Math.max(3, (d.value / max) * 100) : 0;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${d.label}: ${d.valueLabel}`}
              >
                <span className="text-xs tabular-nums text-brand-ink-muted">
                  {d.valueLabel}
                </span>
                <div
                  className={`w-full rounded-t-md ${TONE[tone]}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-2">
          {data.map((d, i) => (
            <span
              key={i}
              className="flex-1 truncate text-center text-xs text-brand-ink-muted"
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
