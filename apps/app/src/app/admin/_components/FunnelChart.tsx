/**
 * Conversion funnel: horizontal proportional bars (width relative to the first
 * step). Reading-direction aware — bars grow from the inline-start, so this
 * follows ar/en automatically. Width is data geometry (inline style).
 */
export interface FunnelStep {
  label: string;
  value: number;
  valueLabel: string;
}

export function FunnelChart({
  steps,
  ariaLabel,
}: {
  steps: FunnelStep[];
  ariaLabel: string;
}) {
  const base = Math.max(1, steps[0]?.value ?? 1);

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const pct = s.value > 0 ? Math.max(2, (s.value / base) * 100) : 0;
          return (
            <li key={i}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="text-brand-ink">{s.label}</span>
                <span dir="ltr" className="tabular-nums text-brand-ink-muted">
                  {s.valueLabel}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-3 overflow-hidden rounded-full bg-brand-ink/5"
              >
                <div
                  className="h-3 rounded-full bg-brand-purple-900"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
