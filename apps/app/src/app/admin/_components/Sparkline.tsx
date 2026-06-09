/**
 * Tiny decorative trend line for a KPI tile. Purely aria-hidden — the KPI value
 * and trend pill carry the real information; this is texture. No client JS.
 * Coordinates are computed, so an inline `style`-free SVG path is the right tool.
 */
export function Sparkline({
  points,
  className = "text-brand-purple-900",
}: {
  points: number[];
  className?: string;
}) {
  if (points.length < 2) return null;

  const W = 64;
  const H = 20;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = W / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (H - ((p - min) / span) * H).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`h-5 w-16 ${className}`}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
