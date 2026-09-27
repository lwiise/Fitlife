import type { ReactNode } from "react";

/**
 * A progress ring with its figure in the middle — the one "stat" visual the
 * app uses (family season, a solo week). Static SVG: no JS, no animation.
 */
export function Ring({
  frac,
  children,
  label,
  className = "size-24",
}: {
  /** 0..1, clamped. */
  frac: number;
  /** The centred figure (e.g. «١٤» over «وجبة»). */
  children?: ReactNode;
  /** Spoken description — the SVG itself is decorative. */
  label: string;
  className?: string;
}) {
  const r = 40;
  const sw = 9;
  const c = r + sw;
  const C = 2 * Math.PI * r;
  const len = Math.max(0, Math.min(1, frac)) * C;
  return (
    <div role="img" aria-label={label} className={`relative shrink-0 ${className}`}>
      <svg viewBox={`0 0 ${2 * c} ${2 * c}`} className="size-full" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-brand-tint)" strokeWidth={sw} />
        {len > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--color-brand-purple-900)"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
