"use client";

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { clsx } from "clsx";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import type { BoardLabels, OvChartMeta, OvMetric } from "./model";
import {
  GEO,
  areaPath,
  indexAt,
  pct,
  physFrac,
  stepIndex,
  stepPath,
  timeFrac,
  valueFrac,
} from "./chartMath";
import { fill, fmtDisplay } from "./display";

/** Gap between the crosshair and the tooltip (prototype: 12px). */
const TIP_GAP = 12;

/**
 * The overview chart (prototype chartSVG): the selected metric as a step line
 * over a soft area, the prior window as a muted line, five gridlines with
 * ticks on the inline-start side, x labels, and the latest value above the
 * last dot with a halo. RTL mirrors the time axis, as in the prototype.
 *
 * Pointer or keyboard (the chart is focusable; arrows walk the points, Home
 * and End jump) moves a crosshair with a tooltip; keyboard moves are also
 * spoken through a polite live region. For a flow the tooltip adds the
 * bucket's own amount under its running total. Everything a first paint shows
 * was formatted on the server; only tooltip values are formatted here.
 */
export function StepChart({
  metric,
  chart,
  labels,
  label,
  locale,
  currency,
  rtl,
}: {
  metric: OvMetric;
  chart: OvChartMeta;
  labels: BoardLabels;
  /** The chart's accessible name. */
  label: string;
  locale: AdminLocale;
  currency: Currency;
  rtl: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const keyboard = useRef(false);
  const keysId = useId();
  /** The point under the crosshair (null = none). */
  const [active, setActive] = useState<number | null>(null);
  /** The point the tooltip describes — kept after `active` clears so the
   * tooltip fades out with its content instead of emptying first. Null until
   * the first interaction, so the server render formats no tooltip numbers. */
  const [tipIndex, setTipIndex] = useState<number | null>(null);
  const [spoken, setSpoken] = useState("");

  const { cur, pri, step, yMax, unit } = metric;
  const n = cur.length;
  const last = n - 1;

  const paths = useMemo(
    () => ({
      cur: stepPath(cur, yMax, rtl),
      area: areaPath(cur, yMax, rtl),
      pri: pri ? stepPath(pri, yMax, rtl) : "",
    }),
    [cur, pri, yMax, rtl],
  );

  const fmt = (v: number | undefined) => fmtDisplay(v ?? 0, unit, currency, locale);
  const xOf = (i: number) => pct(physFrac(i, n, rtl));
  const yOf = (v: number | undefined) => pct(1 - valueFrac(v ?? 0, yMax));

  function show(i: number) {
    setActive(i);
    setTipIndex(i);
  }

  function indexFromPointer(clientX: number): number | null {
    const plot = plotRef.current;
    if (!plot || n === 0) return null;
    const r = plot.getBoundingClientRect();
    if (r.width <= 0) return null;
    const along = rtl ? (r.right - clientX) / r.width : (clientX - r.left) / r.width;
    return indexAt(along, n);
  }

  function onPointer(e: PointerEvent<HTMLDivElement>) {
    const i = indexFromPointer(e.clientX);
    if (i === null) return;
    keyboard.current = false;
    if (i !== active) show(i);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      if (active !== null) {
        e.preventDefault();
        setActive(null);
      }
      return;
    }
    // Alt+←/→ (history), ⌘←/→ and Ctrl/⌘+Home/End belong to the browser.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = stepIndex(active, e.key, n, rtl);
    if (next === null) return;
    e.preventDefault();
    keyboard.current = true;
    show(next);
    const values = [
      `${labels.curPeriod} ${fmt(cur[next])}`,
      step ? `${chart.stepLabel} ${fmt(step[next])}` : null,
      pri ? `${labels.priorPeriod} ${fmt(pri[next])}` : null,
    ].filter((v): v is string => v !== null);
    setSpoken(fill(labels.pointSr, { date: chart.points[next] ?? "", values: values.join(labels.srSep) }));
  }

  // Place the tooltip beside the crosshair, flipping to the other side past
  // the middle and staying inside the chart. It needs the tooltip's own
  // width, so it is measured after render and written to the one CSS custom
  // property admin.css reads (--ad-tip-x), before paint and without a
  // second render.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const plot = plotRef.current;
    const tip = tipRef.current;
    if (active === null || !box || !plot || !tip) return;
    const b = box.getBoundingClientRect();
    const p = plot.getBoundingClientRect();
    const plotStart = rtl ? b.right - p.right : p.left - b.left;
    const x = plotStart + timeFrac(active, n) * p.width;
    const w = tip.offsetWidth;
    const want = x > b.width / 2 ? x - w - TIP_GAP : x + TIP_GAP;
    const clamped = Math.min(Math.max(0, want), Math.max(0, b.width - w));
    tip.style.setProperty("--ad-tip-x", `${Math.round(clamped)}px`);
  }, [active, n, rtl]);

  return (
    <div
      ref={boxRef}
      className="ad-chart-box ad-ov-chart"
      tabIndex={0}
      role="group"
      aria-roledescription={labels.chartRole}
      aria-label={label}
      aria-describedby={keysId}
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={(e) => {
        // A finger lifting ends a touch with a pointerleave; keep the reading
        // until the next tap elsewhere (blur) instead of flashing it away.
        if (e.pointerType !== "touch" && !keyboard.current) setActive(null);
      }}
      onKeyDown={onKeyDown}
      onBlur={() => {
        keyboard.current = false;
        setActive(null);
      }}
    >
      <div ref={plotRef} className="ad-ov-plot">
        {metric.ticks.map((tick, i) => (
          <span key={i} className={`ad-ov-ytick ad-ov-t${i}`} aria-hidden="true">
            {tick}
          </span>
        ))}

        {/* Lines and area: GEO×GEO stretched to the plot, strokes unscaled. */}
        <svg
          className="ad-ov-svg"
          viewBox={`0 0 ${GEO} ${GEO}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {[0, 250, 500, 750].map((y) => (
            <line key={y} className="ad-ov-grid" x1="0" x2={GEO} y1={y} y2={y} />
          ))}
          <line className="ad-ov-base" x1="0" x2={GEO} y1={GEO} y2={GEO} />
          {paths.pri ? <path className="ad-ov-pri" d={paths.pri} /> : null}
          {paths.area ? <path className="ad-ov-area" d={paths.area} /> : null}
          <path className="ad-ov-cur" d={paths.cur} />
        </svg>

        {/* Dots, crosshair and text: unscaled, positioned in percentages. */}
        <svg className="ad-ov-svg" aria-hidden="true" focusable="false">
          {chart.xLabels.map((l) => (
            <text
              key={l.i}
              className={clsx("ad-ov-xl", l.wide && "ad-ov-w", l.narrow && "ad-ov-n", l.tiny && "ad-ov-s")}
              x={xOf(l.i)}
              y="100%"
              dy={22}
              textAnchor="middle"
            >
              {l.text}
            </text>
          ))}
          {active !== null ? (
            <line className="ad-ov-xh" x1={xOf(active)} x2={xOf(active)} y1="0" y2="100%" />
          ) : null}
          <circle className="ad-ov-dot" cx={xOf(last)} cy={yOf(cur[last])} r={5} />
          <text className="ad-ov-end" x={xOf(last)} y={yOf(cur[last])} dy={-14} textAnchor="middle">
            {metric.value}
          </text>
          {active !== null && pri ? (
            <circle className="ad-ov-dot ad-ov-dot-pri" cx={xOf(active)} cy={yOf(pri[active])} r={4} />
          ) : null}
          {active !== null ? (
            <circle className="ad-ov-dot" cx={xOf(active)} cy={yOf(cur[active])} r={5} />
          ) : null}
        </svg>
      </div>

      <div ref={tipRef} className={clsx("ad-chart-tip", active !== null && "ad-on")} aria-hidden="true">
        {tipIndex !== null ? (
          <>
            <div className="ad-tt">{chart.points[tipIndex] ?? ""}</div>
            <div className="ad-tr">
              <span>
                <i className="ad-k1" /> {labels.curPeriod}
              </span>
              <b className="ad-num">{fmt(cur[tipIndex])}</b>
            </div>
            {step ? (
              <div className="ad-tr">
                <span>
                  <i className="ad-ov-k0" /> {chart.stepLabel}
                </span>
                <b className="ad-num">{fmt(step[tipIndex])}</b>
              </div>
            ) : null}
            {pri ? (
              <div className="ad-tr">
                <span>
                  <i className="ad-k2" /> {labels.priorPeriod}
                </span>
                <b className="ad-num">{fmt(pri[tipIndex])}</b>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <p id={keysId} className="ad-sr">
        {labels.keys}
      </p>
      <p className="ad-sr" aria-live="polite">
        {spoken}
      </p>
    </div>
  );
}
