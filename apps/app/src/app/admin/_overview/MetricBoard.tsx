"use client";

import { useId, useState } from "react";
import { ChartLine, Info, Table } from "lucide-react";
import { clsx } from "clsx";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { joinSep } from "../_ui/Sep";
import type { BoardLabels, OvBoard, OvChartMeta, OvMetric } from "./model";
import { DeltaPill } from "./DeltaPill";
import { useOverviewNav } from "./OverviewScope";
import { Sparkline } from "./Sparkline";
import { StepChart } from "./StepChart";
import { fmtDisplay } from "./display";

/**
 * The metric tiles (prototype kpiRow) and the chart card (prototype
 * chartCard). Every shown metric's series is already here, so picking a tile
 * re-plots at once with no server round-trip; OverviewScope owns the choice
 * and writes it into the URL, so a refresh or a shared link keeps the metric.
 */
export function MetricBoard({
  board,
  labels,
  locale,
  currency,
}: {
  board: OvBoard;
  labels: BoardLabels;
  locale: AdminLocale;
  currency: Currency;
}) {
  const rtl = locale === "ar";
  const chartId = useId();
  const { metric: chosen, selectMetric } = useOverviewNav();

  const byKey = new Map(board.metrics.map((m) => [m.key, m]));
  const metric = byKey.get(chosen) ?? byKey.get(board.selected) ?? board.metrics[0];

  return (
    <>
      <div className="ad-kpis" role="group" aria-label={labels.kpiGroup}>
        {board.shown.map((key) => {
          const m = byKey.get(key);
          if (!m) return null;
          return (
            <button
              key={key}
              type="button"
              className={clsx("ad-kpi", m.vs && "ad-ov-kpi-vs")}
              aria-pressed={metric?.key === key}
              aria-controls={chartId}
              onClick={() => selectMetric(key)}
            >
              <span className="ad-lb">{m.label}</span>
              <span className={clsx("ad-v ad-num", m.long && "ad-ov-long")}>{m.value}</span>
              <span className="ad-row">
                {m.delta ? <DeltaPill delta={m.delta} /> : <span />}
                <Sparkline values={m.cur} rtl={rtl} />
              </span>
              {/* The prior value, under the change it is measured against. The
                  pill's screen-reader text already says it, so this is visual. */}
              {m.vs ? (
                <span className="ad-ov-vs ad-num" aria-hidden="true">
                  {m.vs}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {metric ? (
        <ChartCard
          id={chartId}
          metric={metric}
          chart={board.chart}
          labels={labels}
          locale={locale}
          currency={currency}
          rtl={rtl}
        />
      ) : null}
    </>
  );
}

function ChartCard({
  id,
  metric,
  chart,
  labels,
  locale,
  currency,
  rtl,
}: {
  id: string;
  metric: OvMetric;
  chart: OvChartMeta;
  labels: BoardLabels;
  locale: AdminLocale;
  currency: Currency;
  rtl: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  const hasData =
    chart.n > 0 && (metric.cur.some((v) => v !== 0) || (metric.pri?.some((v) => v !== 0) ?? false));
  const name = `${metric.label} — ${metric.sub}`;

  return (
    <section id={id} className="ad-card ad-chartcard" aria-labelledby={titleId}>
      <div className="ad-chart-top">
        <div>
          <h2 id={titleId}>{metric.label}</h2>
          <p>{joinSep(...metric.subParts)}</p>
        </div>
        <div className="ad-filters">
          <div className="ad-legend ad-ov-legend">
            <span>
              <i className="ad-k1" aria-hidden="true" />
              {labels.curPeriod}
              <span className="ad-ov-dates">{chart.curRange}</span>
            </span>
            {chart.comparisonOn && chart.priRange ? (
              <span>
                <i className="ad-k2" aria-hidden="true" />
                {labels.priorPeriod}
                <span className="ad-ov-dates">{chart.priRange}</span>
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="ad-btn ad-btn-g"
            aria-controls={bodyId}
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? (
              <ChartLine className="ad-ic" aria-hidden="true" />
            ) : (
              <Table className="ad-ic" aria-hidden="true" />
            )}
            {asTable ? labels.asChart : labels.asTable}
          </button>
        </div>
      </div>

      <div id={bodyId}>
        {asTable ? (
          <ChartTable
            metric={metric}
            chart={chart}
            labels={labels}
            caption={name}
            locale={locale}
            currency={currency}
          />
        ) : hasData ? (
          <StepChart
            key={metric.key}
            metric={metric}
            chart={chart}
            labels={labels}
            label={name}
            locale={locale}
            currency={currency}
            rtl={rtl}
          />
        ) : (
          <div className="ad-ov-empty">
            <p>{labels.empty}</p>
          </div>
        )}
      </div>

      <p className="ad-ov-foot">
        <Info className="ad-ic" aria-hidden="true" />
        {labels.approx}
      </p>
    </section>
  );
}

/** The same series as the chart, newest first, for reading and for assistive
 * technology — plus, for a flow, each bucket's own amount (the chart plots its
 * running total). Rendered only when asked for, so its numbers format here. */
function ChartTable({
  metric,
  chart,
  labels,
  caption,
  locale,
  currency,
}: {
  metric: OvMetric;
  chart: OvChartMeta;
  labels: BoardLabels;
  caption: string;
  locale: AdminLocale;
  currency: Currency;
}) {
  const captionId = useId();
  const fmt = (v: number | undefined) => fmtDisplay(v ?? 0, metric.unit, currency, locale);
  const rows = metric.cur.map((_, i) => metric.cur.length - 1 - i);
  return (
    <div className="ad-charttable" tabIndex={0} role="region" aria-labelledby={captionId}>
      <table className="ad-tbl">
        <caption id={captionId} className="ad-sr">
          {caption}
        </caption>
        <thead>
          <tr>
            <th scope="col">{labels.colDate}</th>
            {metric.step ? (
              <th scope="col" className="ad-end">
                {chart.stepLabel}
              </th>
            ) : null}
            <th scope="col" className="ad-end">
              {labels.curPeriod}
            </th>
            {metric.pri ? (
              <th scope="col" className="ad-end">
                {labels.priorPeriod}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i}>
              <th scope="row" className="ad-ov-rowh">
                {chart.points[i] ?? "—"}
              </th>
              {metric.step ? <td className="ad-end ad-num">{fmt(metric.step[i])}</td> : null}
              <td className="ad-end ad-num">{fmt(metric.cur[i])}</td>
              {metric.pri ? <td className="ad-end ad-num ad-muted">{fmt(metric.pri[i])}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
