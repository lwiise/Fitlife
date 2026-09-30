/**
 * URL search-param helpers for the (fully server-rendered, hidden) Insights
 * page and its top bar's toggles, whose state lives in the query string.
 */

export type RawParams = Record<string, string | string[] | undefined>;

/** Collapse Next's string|string[] params to a flat string map. */
export function flatten(params: RawParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      if (v[0] != null) out[k] = v[0];
    } else if (v != null) {
      out[k] = v;
    }
  }
  return out;
}

/** Merge a patch into the current params and return a `?a=b&...` string. */
export function buildQuery(
  base: Record<string, string>,
  patch: Record<string, string | number | null | undefined>,
): string {
  const merged: Record<string, string> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") delete merged[k];
    else merged[k] = String(v);
  }
  const qs = new URLSearchParams(merged).toString();
  // "?" (not "") so a <Link> resolves to the bare current path with no query.
  return qs ? `?${qs}` : "?";
}
