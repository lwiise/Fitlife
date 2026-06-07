/**
 * 100%-stacked bars showing a success/failure RATE over time (each column is
 * full height; segments are the proportion). The failed segment is always on
 * top — a consistent positional cue in addition to color — and the per-column
 * total sits above. Real values are exposed to assistive tech via a hidden data
 * table; the visual is aria-hidden.
 */
export interface StackedDatum {
  label: string;
  completed: number;
  failed: number;
  totalLabel: string;
}

export function StackedBarChart({
  data,
  ariaLabel,
  legend,
}: {
  data: StackedDatum[];
  ariaLabel: string;
  legend: { completed: string; failed: string };
}) {
  return (
    <figure aria-label={ariaLabel} className="m-0">
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">·</th>
            <th scope="col">{legend.completed}</th>
            <th scope="col">{legend.failed}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.label}</th>
              <td>{d.completed}</td>
              <td>{d.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden="true" dir="ltr">
        <div className="flex h-40 items-end gap-2">
          {data.map((d, i) => {
            const total = d.completed + d.failed;
            const failedPct = total > 0 ? (d.failed / total) * 100 : 0;
            const completedPct = total > 0 ? (d.completed / total) * 100 : 0;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${d.label}: ${d.totalLabel}`}
              >
                <span className="text-xs tabular-nums text-brand-ink-muted">
                  {d.totalLabel}
                </span>
                <div className="flex h-full w-full flex-col overflow-hidden rounded-t-md bg-brand-ink/5">
                  {total > 0 ? (
                    <>
                      <div className="bg-red-600" style={{ height: `${failedPct}%` }} />
                      <div
                        className="bg-brand-emerald"
                        style={{ height: `${completedPct}%` }}
                      />
                    </>
                  ) : null}
                </div>
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

      <figcaption className="mt-2 flex items-center justify-center gap-4 text-xs text-brand-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-emerald" aria-hidden="true" />
          {legend.completed}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-600" aria-hidden="true" />
          {legend.failed}
        </span>
      </figcaption>
    </figure>
  );
}
