/**
 * URL state of the overview (pure, client-safe). The parameters are the ones
 * the page has always used — `metric`, `metrics`, `range`, `from`, `to`,
 * `interval`, `cmp` — with the same defaults left out of the URL:
 * `range` is omitted for 30 days, `metric` for gross revenue, `metrics` for
 * the default four.
 */

import {
  DEFAULT_METRICS,
  METRIC_POOL,
  type Granularity,
  type MetricKey,
  type RangePreset,
} from "@/lib/admin/timeseries";

export type RawParams = Record<string, string | string[] | undefined>;
/** A change to the query: a string sets, null/undefined/"" removes. */
export type ParamPatch = Record<string, string | null | undefined>;

/** The four preset windows, in display order. */
export const PRESETS = ["24h", "7d", "30d", "90d"] as const;
export type Preset = (typeof PRESETS)[number];

/** Most metric tiles the overview shows at once. */
export const METRIC_CAP = 4;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Collapse Next's string | string[] search params to one string each. */
export function flattenParams(raw: RawParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      if (v[0] != null) out[k] = v[0];
    } else if (v != null) {
      out[k] = v;
    }
  }
  return out;
}

/** The query `current` with `patch` applied (other keys kept), without the `?`. */
export function patchQuery(current: URLSearchParams | string, patch: ParamPatch): string {
  const next = new URLSearchParams(typeof current === "string" ? current : current.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  return next.toString();
}

/** `pathname?query` with `patch` applied to `current` (other keys kept). */
export function withParams(
  pathname: string,
  current: URLSearchParams | string,
  patch: ParamPatch,
): string {
  const qs = patchQuery(current, patch);
  return qs ? `${pathname}?${qs}` : pathname;
}

/** The query of an href, without the `?` and any `#fragment` ("" when none). */
export function queryOf(href: string): string {
  const start = href.indexOf("?");
  if (start < 0) return "";
  const hash = href.indexOf("#", start);
  return href.slice(start + 1, hash < 0 ? undefined : hash);
}

/** One parameter of a query string (null when absent). */
export function paramOf(query: string, key: string): string | null {
  return new URLSearchParams(query).get(key);
}

/** Interval choices for a window: hours only make sense for a day. */
export function intervalsFor(preset: RangePreset): Granularity[] {
  return preset === "24h" ? ["hour", "day"] : ["day", "week", "month"];
}

/** The interval the server will pick for a preset when none is given
 * (resolveRange's automatic choice). */
function autoInterval(preset: Preset): Granularity {
  if (preset === "24h") return "hour";
  return preset === "90d" ? "week" : "day";
}

/** What the interval will be after switching to `preset` with the current
 * `interval` parameter — the value shown while the new page loads. */
export function expectedInterval(preset: Preset, intervalParam: string | null): Granularity {
  const kept = intervalsFor(preset).find((g) => g === intervalParam);
  return kept ?? autoInterval(preset);
}

/**
 * Switching to a preset window: drop the custom dates, leave `range` out for
 * the 30-day default, and keep the interval only when it still fits the
 * window (a weekly interval on 24 hours would draw a single point).
 */
export function presetPatch(preset: Preset, intervalParam: string | null): ParamPatch {
  const keep = intervalsFor(preset).some((g) => g === intervalParam);
  return {
    range: preset === "30d" ? null : preset,
    from: null,
    to: null,
    interval: keep ? intervalParam : null,
  };
}

/** A valid custom range: two calendar dates, the start on or before the end. */
export function isValidCustomRange(from: string, to: string): boolean {
  if (!YMD.test(from) || !YMD.test(to)) return false;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) && a <= b;
}

/** A `YYYY-MM-DD` date no later than `max` (same format; compares as text). */
export function clampYmd(value: string, max: string): string {
  return YMD.test(value) && YMD.test(max) && value > max ? max : value;
}

export function customPatch(from: string, to: string): ParamPatch {
  return { range: "custom", from, to, page: null };
}

/** Hidden fields a GET form needs to keep every other parameter. */
export function preservedFields(
  current: URLSearchParams | string,
  exclude: readonly string[],
): Array<[string, string]> {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString());
  return [...params.entries()].filter(([k]) => !exclude.includes(k));
}

const isMetric = (s: string): s is MetricKey => (METRIC_POOL as string[]).includes(s);

/** `metric` for the URL — left out for the default (gross revenue). */
export function metricParam(key: MetricKey): string | null {
  return key === "gross_revenue" ? null : key;
}

/** The selected metric as the URL states it (the server's parseMetric rule). */
export function metricFromParam(value: string | null | undefined): MetricKey {
  return value && isMetric(value) ? value : "gross_revenue";
}

/**
 * The query the overview stands on: `query` (the URL, or a navigation still
 * loading) with a metric picked on a tile but not yet in the URL. Links built
 * from it carry the chart's metric instead of the one it replaced.
 */
export function withPickedMetric(query: string, picked: MetricKey | null): string {
  return picked === null ? query : patchQuery(query, { metric: metricParam(picked) });
}

/**
 * A tile's pick is settled once `query` names the same metric (nothing left
 * to write), and void once the page no longer plots it (a metrics change
 * removed it) — then the page's own selection applies.
 */
export function pickSettled(
  picked: MetricKey,
  query: string,
  available: readonly MetricKey[],
): boolean {
  return picked === metricFromParam(paramOf(query, "metric")) || !available.includes(picked);
}

function sameList(a: readonly MetricKey[], b: readonly MetricKey[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** `metrics` for the URL — left out when it equals the default set, in order. */
export function metricsParam(list: readonly MetricKey[]): string | null {
  const next = list.length > 0 ? list : DEFAULT_METRICS;
  return sameList(next, DEFAULT_METRICS) ? null : next.join(",");
}

/**
 * Toggle one metric in the shown set. At the cap nothing can be added; the
 * last shown metric cannot be removed. Removing the selected metric selects
 * the first one left (the prototype's rule). Null when the toggle is refused.
 */
export function toggleMetric(
  shown: readonly MetricKey[],
  key: MetricKey,
  selected: MetricKey,
): { shown: MetricKey[]; selected: MetricKey } | null {
  if (shown.includes(key)) {
    if (shown.length <= 1) return null;
    const next = shown.filter((k) => k !== key);
    return { shown: next, selected: selected === key ? next[0]! : selected };
  }
  if (shown.length >= METRIC_CAP) return null;
  return { shown: [...shown, key], selected };
}

/** The query change for a toggle result. */
export function metricsPatch(result: { shown: MetricKey[]; selected: MetricKey }): ParamPatch {
  return { metrics: metricsParam(result.shown), metric: metricParam(result.selected) };
}

const AUDIT_FIELD_MAX = 64;

function clip(v: string | undefined): string | null {
  if (v == null || v === "") return null;
  return v.length > AUDIT_FIELD_MAX ? v.slice(0, AUDIT_FIELD_MAX) : v;
}

/**
 * The audit row's detail for an overview load, from the RAW parameters (so
 * it can be written in parallel with the data, before anything is resolved).
 * Values are clipped: they come from the URL.
 */
export function overviewAuditDetail(
  params: Record<string, string>,
  currency: string,
): {
  section: "overview";
  metric: string | null;
  metrics: string | null;
  range: string | null;
  interval: string | null;
  cmp: string | null;
  cur: string;
} {
  return {
    section: "overview",
    metric: clip(params.metric),
    metrics: clip(params.metrics),
    range: clip(params.range),
    interval: clip(params.interval),
    cmp: clip(params.cmp),
    cur: currency,
  };
}
