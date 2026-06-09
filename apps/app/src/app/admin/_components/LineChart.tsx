/**
 * Dependency-free line / area chart (computed SVG path — no client JS). Same
 * accessibility contract as BarChart: the visual plot is aria-hidden and a
 * visually-hidden table carries the real values. Time flows left→right
 * regardless of locale, so the plot is forced LTR; the caller localizes labels.
 */
export interface LinePoint {
  label: string;
  value: number;
  valueLabel: string;
}

const STROKE: Record<string, string> = {
  purple: "text-brand-purple-900",
  pink: "text-brand-pink",
  emerald: "text-brand-emerald",
};

const W = 600;
const H = 180;
const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOT = 12;

export function LineChart({
  data,
  ariaLabel,
  tone = "purple",
  area = false,
}: {
  data: LinePoint[];
  ariaLabel: string;
  tone?: "purple" | "pink" | "emerald";
  area?: boolean;
}) {
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOT;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const baseline = PAD_TOP + innerH;

  const x = (i: number) => (n <= 1 ? PAD_X + innerW / 2 : PAD_X + (i / (n - 1)) * innerW);
  const y = (v: number) => PAD_TOP + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const areaPath =
    n > 0
      ? `M${x(0).toFixed(1)},${baseline} ${data
          .map((d, i) => `L${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
          .join(" ")} L${x(n - 1).toFixed(1)},${baseline} Z`
      : "";

  return (
    <figure aria-label={ariaLabel} className={`m-0 ${STROKE[tone]}`}>
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
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-44 w-full">
          {area && areaPath ? (
            <path d={areaPath} fill="currentColor" fillOpacity="0.12" stroke="none" />
          ) : null}
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.value)} r="3" fill="currentColor" vectorEffect="non-scaling-stroke">
              <title>{`${d.label}: ${d.valueLabel}`}</title>
            </circle>
          ))}
        </svg>
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
