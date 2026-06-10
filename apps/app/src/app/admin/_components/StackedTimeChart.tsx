/**
 * Stacked time-series bars — one column per time bucket, segmented by category
 * (plan tier). Clones the BarChart/StackedBarChart contract: the visual plot is
 * aria-hidden and forced dir="ltr" (time flows left→right in both locales — only
 * the labels localise), while a visually-hidden data table carries the real
 * per-bucket / per-tier values + totals to assistive tech.
 *
 * Segment heights + colours are data-driven geometry → the one place a runtime
 * value can't be a Tailwind class, so `style` is used (same as the rest of the
 * kit).
 */
export interface StackedSeries {
  key: string;
  label: string;
  /** CSS colour (brand var, e.g. "var(--color-brand-purple-900)"). */
  color: string;
  values: number[];
}

// Leave a little headroom above the tallest bar for the total label.
const SCALE = 0.92;

export function StackedTimeChart({
  labels,
  series,
  ariaLabel,
  timeLabel,
  totalLabel,
  formatValue,
}: {
  labels: string[];
  series: StackedSeries[];
  ariaLabel: string;
  /** Header for the time-bucket column in the accessible data table. */
  timeLabel: string;
  totalLabel: string;
  formatValue: (n: number) => string;
}) {
  const totals = labels.map((_, i) =>
    series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
  const max = Math.max(1, ...totals);

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{timeLabel}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
            <th scope="col">{totalLabel}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={i}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.key}>{formatValue(s.values[i] ?? 0)}</td>
              ))}
              <td>{formatValue(totals[i] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden="true" dir="ltr">
        <div className="flex h-52 gap-1.5">
          {labels.map((label, i) => {
            const total = totals[i] ?? 0;
            const colPct = total > 0 ? Math.max(2, (total / max) * 100 * SCALE) : 0;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${label}: ${formatValue(total)}`}
              >
                <span className="text-[0.65rem] tabular-nums text-brand-ink-muted">
                  {total > 0 ? formatValue(total) : ""}
                </span>
                <div
                  className="w-full overflow-hidden rounded-t-md bg-brand-ink/5"
                  style={{ height: `${colPct}%` }}
                >
                  <div className="flex h-full w-full flex-col-reverse">
                    {series.map((s) => {
                      const v = s.values[i] ?? 0;
                      if (v <= 0) return null;
                      const segPct = (v / total) * 100;
                      return (
                        <div
                          key={s.key}
                          style={{ height: `${segPct}%`, backgroundColor: s.color }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {labels.map((label, i) => (
            <span
              key={i}
              className="flex-1 truncate text-center text-[0.65rem] text-brand-ink-muted"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-brand-ink-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
