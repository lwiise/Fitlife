"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MetricKey } from "@/lib/admin/timeseries";
import { metricFromParam, metricParam, paramOf, pickSettled, queryOf, withPickedMetric } from "./urls";

interface OverviewNav {
  /** A range/interval/metrics change is loading. */
  pending: boolean;
  /**
   * The query the page stands on: the URL, then any navigation still loading,
   * then a metric picked on a tile that the URL has not caught up with. Build
   * every link and target from this, so a second change made while the first
   * loads stacks on it instead of undoing it.
   */
  query: string;
  /** The metric the chart shows. */
  metric: MetricKey;
  /** Put `key` on the chart now; the URL follows once nothing is loading. */
  selectMetric: (key: MetricKey) => void;
  /**
   * Go to `href` (same page, other parameters) inside a transition: the
   * current figures stay on screen, dimmed and aria-busy, until the new ones
   * arrive — never a blank page or a skeleton. `optimistic` runs inside the
   * same transition so controls can show the choice immediately. Build `href`
   * from `query`.
   */
  navigate: (href: string, optimistic?: () => void) => void;
}

const NavContext = createContext<OverviewNav | null>(null);

export function useOverviewNav(): OverviewNav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useOverviewNav must be used inside <OverviewScope>");
  return nav;
}

/**
 * The overview's content column and its URL state. `head` (title + range
 * controls) stays live; `children` — tiles, chart, cost, engagement — dim
 * while new data loads. The search-param navigation keeps this component
 * mounted (the router keys page state without the query), so client state
 * such as the chart's table toggle survives a range change.
 *
 * The metric on the chart is client state that the URL follows through
 * history.replaceState — never while a navigation is loading. Next.js routes
 * replaceState through its router as a history restore, and a restore
 * DISCARDS a navigation in flight: the range just picked would silently
 * revert. So a tile picked mid-load shows at once and reaches the URL when
 * the new page lands.
 */
export function OverviewScope({
  head,
  busyLabel,
  metrics,
  children,
}: {
  head: ReactNode;
  /** Announced to screen readers while figures load («جارٍ تحديث الأرقام…»). */
  busyLabel: string;
  /** The metrics this page can plot (the tiles and the selected metric). */
  metrics: readonly MetricKey[];
  children: ReactNode;
}) {
  const router = useRouter();
  const committed = useSearchParams()?.toString() ?? "";
  const [pending, startTransition] = useTransition();
  // A navigation's query from the moment it starts; a later one stacks on
  // top, and the URL takes over again when the page lands.
  const [loading, setLoading] = useOptimistic(committed);
  // A tile picked while the URL still names another metric.
  const [picked, setPicked] = useState<MetricKey | null>(null);

  if (picked !== null && pickSettled(picked, loading, metrics)) setPicked(null);
  const metric = picked ?? metricFromParam(paramOf(loading, "metric"));
  const query = withPickedMetric(loading, picked);

  // The URL follows the tile, so a refresh or a shared link keeps the metric.
  // Nothing is loading here, so `picked` differs from the URL's metric.
  useEffect(() => {
    if (pending || picked === null) return;
    try {
      const url = new URL(window.location.href);
      const value = metricParam(picked);
      if (value) url.searchParams.set("metric", value);
      else url.searchParams.delete("metric");
      window.history.replaceState(null, "", url);
    } catch {
      // A blocked history API leaves the URL behind; the chart still follows.
    }
  }, [pending, picked]);

  const selectMetric = useCallback((key: MetricKey) => setPicked(key), []);

  const navigate = useCallback(
    (href: string, optimistic?: () => void) => {
      // `href` was built from `query`, so it already carries a picked metric.
      setPicked(null);
      startTransition(() => {
        setLoading(queryOf(href));
        optimistic?.();
        router.push(href, { scroll: false });
      });
    },
    [router, setLoading],
  );

  const value = useMemo(
    () => ({ pending, query, metric, selectMetric, navigate }),
    [pending, query, metric, selectMetric, navigate],
  );

  return (
    <NavContext value={value}>
      <div className="ad-a-ov-in ad-ov-in">
        {head}
        <div className="ad-ov-body" aria-busy={pending || undefined}>
          {children}
        </div>
        <p className="ad-sr" role="status">
          {pending ? busyLabel : ""}
        </p>
      </div>
    </NavContext>
  );
}
