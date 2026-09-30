/**
 * Pure geometry for the overview chart and sparklines (client-safe, no DOM).
 *
 * The chart draws in two layers that share one plot box:
 * • the lines and the area live in a GEO × GEO viewBox stretched to the box
 *   (`preserveAspectRatio="none"` + non-scaling strokes), so a path never
 *   needs the box's pixel size;
 * • dots, the crosshair and the text sit in an unscaled SVG whose coordinates
 *   are percentages of the same box, so text renders at its true size at any
 *   width — on the server, before any measuring.
 *
 * Time runs start → end: left → right in LTR, right → left in RTL. `timeFrac`
 * is the position along time (0 = first bucket); `physFrac` is the position
 * from the physical left edge, mirrored for RTL, which is what SVG needs.
 */

export const GEO = 1000;

/** Keyboard keys the chart handles. */
export type ChartKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Cumulative sum — a flow metric is plotted as its running total, so the
 * last point equals the tile's headline (the sum over the range). */
export function runningTotal(values: readonly number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += Number.isFinite(v) ? v : 0));
}

/**
 * A round axis maximum at or above `v` (the prototype's niceMax). Counts use a
 * multiple of 4 (≥ 4) so the five gridlines land on whole numbers; amounts
 * climb a 1–1.2–1.6–2–2.4–3–4–5–6–8–10 ladder.
 */
export function niceMax(v: number, count: boolean): number {
  if (!Number.isFinite(v) || v <= 0) return count ? 4 : 1;
  if (count) return Math.max(4, Math.ceil(v / 4) * 4);
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10]) {
    const candidate = Number((m * p).toPrecision(12));
    if (candidate >= v) return candidate;
  }
  return Number((10 * p).toPrecision(12));
}

/** The y-axis maximum for a chart: headroom of 6% over the largest value of
 * either series, rounded by `niceMax`. */
export function axisMax(cur: readonly number[], pri: readonly number[] | null, count: boolean): number {
  let max = 0;
  for (const v of cur) if (Number.isFinite(v) && v > max) max = v;
  if (pri) for (const v of pri) if (Number.isFinite(v) && v > max) max = v;
  return niceMax(max * 1.06, count);
}

/** Position of point `i` along time, 0…1. A lone point sits at the start. */
export function timeFrac(i: number, n: number): number {
  return n <= 1 ? 0 : Math.min(1, Math.max(0, i / (n - 1)));
}

/** Position of point `i` from the physical left edge, 0…1 (mirrored in RTL). */
export function physFrac(i: number, n: number, rtl: boolean): number {
  const f = timeFrac(i, n);
  return rtl ? 1 - f : f;
}

/** Height of a value within the axis, 0 (baseline) … 1 (top), clamped. */
export function valueFrac(v: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v / max));
}

/** A 0…1 fraction as an SVG percentage attribute ("42.5%"). */
export function pct(frac: number): string {
  return `${round1(frac * 100)}%`;
}

function points(values: readonly number[], max: number, rtl: boolean): Array<[number, number]> {
  const n = values.length;
  return values.map((v, i) => [
    round1(physFrac(i, n, rtl) * GEO),
    round1((1 - valueFrac(v, max)) * GEO),
  ]);
}

function stepThrough(pts: Array<[number, number]>): string {
  const [first] = pts;
  if (!first) return "";
  let d = `M${first[0]},${first[1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]!;
    const prevY = pts[i - 1]![1];
    // Step-after: a stock holds its value until the next bucket, a running
    // total jumps on a charge. A curve would invent values in between.
    d += prevY === y ? ` L${x},${y}` : ` L${x},${prevY} L${x},${y}`;
  }
  return d;
}

/** The step line through `values`, in GEO space. */
export function stepPath(values: readonly number[], max: number, rtl: boolean): string {
  return stepThrough(points(values, max, rtl));
}

/** The step line closed down to the baseline — the soft area under it. */
export function areaPath(values: readonly number[], max: number, rtl: boolean): string {
  const pts = points(values, max, rtl);
  if (pts.length < 2) return "";
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return `${stepThrough(pts)} L${last[0]},${GEO} L${first[0]},${GEO} Z`;
}

/** The point nearest to a position along time (0 = start edge, 1 = end edge). */
export function indexAt(fracAlongTime: number, n: number): number {
  if (n <= 1 || !Number.isFinite(fracAlongTime)) return 0;
  return Math.round(Math.min(1, Math.max(0, fracAlongTime)) * (n - 1));
}

/**
 * The point a key moves to. Arrows follow what the eye sees: in RTL time runs
 * leftward, so ArrowLeft moves forward in time. From no point, any key starts
 * at the newest one (Home at the first). Returns null for other keys.
 */
export function stepIndex(current: number | null, key: string, n: number, rtl: boolean): number | null {
  if (n <= 0) return null;
  const last = n - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  if (current === null) return last;
  const forward = key === (rtl ? "ArrowLeft" : "ArrowRight");
  return Math.min(last, Math.max(0, current + (forward ? 1 : -1)));
}

/**
 * Which points get an x-axis label: about `target` of them, evenly spaced,
 * always the first and the last, and never a label crowding the last one
 * (the prototype's rule).
 */
export function labelIndices(n: number, target: number): number[] {
  if (n <= 0) return [];
  const every = Math.max(1, Math.round(n / Math.max(1, target)));
  const out: number[] = [];
  for (let i = 0; i < n; i += every) out.push(i);
  const tail = out[out.length - 1]!;
  if (tail !== n - 1 && n - 1 - tail < every / 2 && out.length > 1) out.pop();
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

export interface SparkGeometry {
  line: string;
  area: string;
  dot: [number, number];
}

/** Sparkline box (CSS draws it at 88×32, 64×24 on phones). */
export const SPARK_W = 88;
export const SPARK_H = 32;

/**
 * A tiny step sparkline in an 88×32 box (the prototype's sparkSVG): mirrored
 * in RTL, scaled between min(values, 0) and max(values), with the end dot.
 * Null when there is nothing to draw.
 */
export function sparkGeometry(values: readonly number[], rtl: boolean): SparkGeometry | null {
  const n = values.length;
  if (n === 0) return null;
  const clean = values.map((v) => (Number.isFinite(v) ? v : 0));
  const min = Math.min(0, ...clean);
  const max = Math.max(...clean);
  const span = max - min > 0 ? max - min : 1;
  const pts: Array<[number, number]> = clean.map((v, i) => {
    const x = 2 + (i * (SPARK_W - 6)) / Math.max(1, n - 1);
    return [round1(rtl ? SPARK_W - x : x), round1(3 + (SPARK_H - 8) * (1 - (v - min) / span))];
  });
  const line = stepThrough(pts);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const area = n < 2 ? "" : `${line} L${last[0]},${SPARK_H - 1} L${first[0]},${SPARK_H - 1} Z`;
  return { line, area, dot: last };
}
