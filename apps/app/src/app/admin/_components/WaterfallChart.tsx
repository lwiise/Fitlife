/**
 * MRR-movement waterfall: per month, new MRR rises above a zero line (good →
 * emerald) and churned MRR drops below it (bad → red), with the net value
 * labeled on top. CSS heights only (no client JS). Expansion/contraction are
 * intentionally absent — they're unknowable without upgrade/downgrade events
 * (the caller surfaces that as an approximation note). The visual is aria-hidden
 * and the hidden table carries new/churned/net. LTR-locked: time reads L→R.
 */
export interface WaterfallDatum {
  label: string;
  up: number;
  down: number;
  net: number;
  upLabel: string;
  downLabel: string;
  netLabel: string;
}

export function WaterfallChart({
  data,
  ariaLabel,
  legend,
}: {
  data: WaterfallDatum[];
  ariaLabel: string;
  legend: { up: string; down: string; net: string };
}) {
  const maxMag = Math.max(1, ...data.map((d) => Math.max(d.up, d.down)));

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">·</th>
            <th scope="col">{legend.up}</th>
            <th scope="col">{legend.down}</th>
            <th scope="col">{legend.net}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.label}</th>
              <td>{d.upLabel}</td>
              <td>{d.downLabel}</td>
              <td>{d.netLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden="true" dir="ltr">
        {/* Above-zero (new MRR) */}
        <div className="flex h-24 items-end gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span
                className={`text-xs font-semibold tabular-nums ${
                  d.net > 0 ? "text-brand-emerald" : d.net < 0 ? "text-red-700" : "text-brand-ink-muted"
                }`}
              >
                {d.netLabel}
              </span>
              <div
                className="w-full rounded-t-md bg-brand-emerald"
                style={{ height: `${(d.up / maxMag) * 100}%` }}
                title={`${legend.up}: ${d.upLabel}`}
              />
            </div>
          ))}
        </div>
        <div className="h-px w-full bg-brand-ink/25" />
        {/* Below-zero (churned MRR) */}
        <div className="flex h-24 items-start gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center">
              <div
                className="w-full rounded-b-md bg-red-600"
                style={{ height: `${(d.down / maxMag) * 100}%` }}
                title={`${legend.down}: ${d.downLabel}`}
              />
            </div>
          ))}
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
          {legend.up}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-600" aria-hidden="true" />
          {legend.down}
        </span>
      </figcaption>
    </figure>
  );
}
