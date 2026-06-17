import type { AdminLocale } from "@/lib/admin/format";
import { fmtMetricValue, fmtSignedPct } from "@/lib/admin/format";

/**
 * Kajabi-style spline line chart — zero client JS. The current range is a smooth
 * monotone-ish spline in a single confident brand-purple stroke over a soft
 * purple→transparent area fade (depth, one hue — no arbitrary colour shift); the
 * comparison range is a faded dotted line behind it.
 * Hover (date · current · comparison · delta) + crosshair are pure CSS: a row of
 * invisible per-bucket columns reveal a tooltip/crosshair/markers on hover.
 *
 * Accessibility mirrors the rest of the kit: the visual plot is aria-hidden and
 * a visually-hidden table carries the real values. Unlike the other charts this
 * one is direction-aware (the spec wants the time axis to flow right-to-left in
 * Arabic): the container takes the locale `dir`, logical classes flip with it,
 * and the SVG x-mapping mirrors so geometry matches.
 */

// viewBox space. PAD_X = 0 so points sit at hover-column centres (perfect
// crosshair alignment); the column-centre mapping still keeps the line off the
// edges. preserveAspectRatio="none" stretches to the container; strokes use
// vectorEffect so they stay crisp and the vertical gradient maps to height.
const W = 600;
const H = 200;
const PAD_TOP = 16;
const PAD_BOT = 16;
const INNER_H = H - PAD_TOP - PAD_BOT;

const AREA_ID = "ovChartArea";
const BASE_Y = PAD_TOP + INNER_H;

function splinePath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return "";
  const first = pts[0]!;
  if (pts.length === 1) return `M${first[0].toFixed(2)},${first[1].toFixed(2)}`;
  let d = `M${first[0].toFixed(2)},${first[1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

export function SplineLineChart({
  labels,
  current,
  comparison,
  unit,
  ariaLabel,
  timeLabel,
  currentLabel,
  comparisonLabel,
  deltaLabel,
  locale,
}: {
  /** Full localized date per current-range bucket. */
  labels: string[];
  current: number[];
  /** Comparison series aligned 1:1 with `current`; empty when comparison off. */
  comparison: number[];
  unit: "sar" | "count";
  ariaLabel: string;
  timeLabel: string;
  currentLabel: string;
  comparisonLabel: string;
  deltaLabel: string;
  locale: AdminLocale;
}) {
  const rtl = locale === "ar";
  const n = current.length;
  const hasCmp = comparison.length > 0;
  const maxV = Math.max(1, ...current, ...comparison);

  const xAt = (i: number) => {
    const f = (i + 0.5) / Math.max(1, n);
    return (rtl ? 1 - f : f) * W;
  };
  const yAt = (v: number) => PAD_TOP + INNER_H - (v / maxV) * INNER_H;
  const topPct = (v: number) => (yAt(v) / H) * 100;

  const curPts: Array<[number, number]> = current.map((v, i) => [xAt(i), yAt(v)]);
  const cmpPts: Array<[number, number]> = comparison.map((v, i) => [xAt(i), yAt(v)]);

  // Closed area under the current spline → baseline, for the soft fill.
  const curD = splinePath(curPts);
  const firstX = curPts[0]?.[0];
  const lastX = curPts[curPts.length - 1]?.[0];
  const areaD =
    curPts.length >= 2 && firstX != null && lastX != null
      ? `${curD} L${lastX.toFixed(2)},${BASE_Y} L${firstX.toFixed(2)},${BASE_Y} Z`
      : "";

  const yTicks = [maxV, maxV / 2, 0];
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((f) => PAD_TOP + f * INNER_H);

  const labelStep = Math.max(1, Math.ceil(n / 8));
  const fmt = (v: number) => fmtMetricValue(v, unit, locale, true);
  const deltaPctAt = (i: number) => {
    const c = comparison[i] ?? 0;
    const cur = current[i] ?? 0;
    return c > 0 ? Math.round(((cur - c) / c) * 1000) / 10 : null;
  };

  return (
    <figure aria-label={ariaLabel} className="m-0">
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{timeLabel}</th>
            <th scope="col">{currentLabel}</th>
            {hasCmp ? <th scope="col">{comparisonLabel}</th> : null}
            {hasCmp ? <th scope="col">{deltaLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={i}>
              <th scope="row">{label}</th>
              <td>{fmtMetricValue(current[i] ?? 0, unit, locale)}</td>
              {hasCmp ? <td>{fmtMetricValue(comparison[i] ?? 0, unit, locale)}</td> : null}
              {hasCmp ? <td>{fmtSignedPct(deltaPctAt(i), locale)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden="true" dir={rtl ? "rtl" : "ltr"}>
        <div className="relative h-56 w-full">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient
                id={AREA_ID}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={PAD_TOP}
                x2="0"
                y2={BASE_Y}
              >
                <stop
                  offset="0%"
                  stopColor="var(--color-brand-purple-900)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="60%"
                  stopColor="var(--color-brand-purple-900)"
                  stopOpacity="0.1"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-brand-purple-900)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {gridYs.map((gy, i) => (
              <line
                key={i}
                x1="0"
                y1={gy}
                x2={W}
                y2={gy}
                stroke="var(--color-brand-ink)"
                strokeOpacity="0.07"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {areaD ? <path d={areaD} fill={`url(#${AREA_ID})`} stroke="none" /> : null}

            {hasCmp ? (
              <path
                d={splinePath(cmpPts)}
                fill="none"
                stroke="#666377"
                strokeWidth="2"
                strokeDasharray="2 5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            <path
              d={curD}
              fill="none"
              stroke="var(--color-brand-purple-900)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Y axis labels (sparse) */}
          {yTicks.map((v, i) => (
            <span
              key={i}
              className="absolute start-0 -translate-y-1/2 bg-surface-elevated/70 pe-1 text-[0.7rem] tabular-nums text-brand-ink/70"
              style={{ top: `${topPct(v)}%` }}
            >
              {fmt(v)}
            </span>
          ))}

          {/* Hover layer: one invisible column per bucket */}
          <div className="absolute inset-0 flex">
            {labels.map((label, i) => {
              const cur = current[i] ?? 0;
              const cmp = comparison[i] ?? 0;
              const dPct = deltaPctAt(i);
              return (
                <div key={i} className="group relative flex-1">
                  <span className="absolute inset-y-0 inset-x-0 mx-auto w-px bg-brand-ink/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span
                    className="absolute inset-x-0 mx-auto size-2.5 -translate-y-1/2 rounded-full bg-brand-purple-900 opacity-0 ring-2 ring-surface-elevated group-hover:opacity-100"
                    style={{ top: `${topPct(cur)}%` }}
                  />
                  {hasCmp ? (
                    <span
                      className="absolute inset-x-0 mx-auto size-2 -translate-y-1/2 rounded-full bg-brand-ink-muted opacity-0 ring-2 ring-surface-elevated group-hover:opacity-100"
                      style={{ top: `${topPct(cmp)}%` }}
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 mx-auto mb-3 hidden w-max max-w-44 rounded-lg border border-brand-ink/10 bg-surface-elevated px-3 py-2 text-start shadow-lg group-hover:block">
                    <p className="mb-1 text-xs font-semibold text-brand-ink">{label}</p>
                    <p className="flex items-center gap-1.5 text-xs text-brand-ink-muted">
                      <span className="size-2 rounded-full bg-brand-purple-900" />
                      {currentLabel}
                      <span className="ms-auto ps-2 tabular-nums text-brand-ink">
                        {fmtMetricValue(cur, unit, locale)}
                      </span>
                    </p>
                    {hasCmp ? (
                      <p className="flex items-center gap-1.5 text-xs text-brand-ink-muted">
                        <span className="size-2 rounded-full bg-brand-ink-muted" />
                        {comparisonLabel}
                        <span className="ms-auto ps-2 tabular-nums text-brand-ink">
                          {fmtMetricValue(cmp, unit, locale)}
                        </span>
                      </p>
                    ) : null}
                    {hasCmp ? (
                      <p className="mt-1 text-xs text-brand-ink-muted">
                        {deltaLabel}:{" "}
                        <span className="tabular-nums text-brand-ink">
                          {fmtSignedPct(dPct, locale)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* X axis date labels (thinned) */}
        <div className="mt-1.5 flex gap-1">
          {labels.map((label, i) => (
            <span
              key={i}
              className="flex-1 truncate text-center text-[0.7rem] text-brand-ink/70"
            >
              {i % labelStep === 0 ? label : ""}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
