import { SPARK_H, SPARK_W, sparkGeometry } from "./chartMath";

/**
 * The tiles' mini step line (`.ad-spark`, the prototype's sparkSVG). Texture
 * only — the figure and the delta beside it carry the information — so it is
 * hidden from assistive technology. Mirrored in RTL like the big chart.
 */
export function Sparkline({ values, rtl }: { values: readonly number[]; rtl: boolean }) {
  const g = sparkGeometry(values, rtl);
  if (!g) return null;
  return (
    <svg
      className="ad-spark"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      aria-hidden="true"
      focusable="false"
    >
      {g.area ? <path className="ad-ov-spark-area" d={g.area} /> : null}
      <path className="ad-ov-spark-line" d={g.line} />
      <circle className="ad-ov-spark-dot" cx={g.dot[0]} cy={g.dot[1]} r="2.5" />
    </svg>
  );
}
