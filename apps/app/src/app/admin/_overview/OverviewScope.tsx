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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MetricKey } from "@/lib/admin/timeseries";
import { NAVIGATE_EVENT } from "../_shell/events";
import { OWN_LINK_ATTR, awayAfter, mayWriteUrl, type NavSignal, type SeenClick } from "./navWatch";
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

/** A DOM click read for navWatch. The path is the one the event was
 * dispatched along, so it still holds when a handler has since removed the
 * element clicked (the phone drawer closes as its link navigates). */
function seenClick(event: MouseEvent): SeenClick {
  const anchor =
    event
      .composedPath()
      .find(
        (node): node is HTMLAnchorElement =>
          node instanceof HTMLAnchorElement && node.hasAttribute("href"),
      ) ?? null;
  return {
    defaultPrevented: event.defaultPrevented,
    button: event.button,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    link: anchor
      ? {
          href: anchor.href,
          target: anchor.target,
          download: anchor.hasAttribute("download"),
          own: anchor.hasAttribute(OWN_LINK_ATTR),
        }
      : null,
  };
}

/**
 * The overview's content column and its URL state. `head` (title + range
 * controls) stays live; `children` — tiles, chart, cost, engagement — dim
 * while new data loads. The search-param navigation keeps this component
 * mounted (the router keys page state without the query), so client state
 * such as the chart's table toggle survives a range change.
 *
 * The metric on the chart is client state that the URL follows through
 * history.replaceState — never while ANY navigation is loading. Next.js
 * routes replaceState through its router as a history restore, and a
 * restore DISCARDS a navigation in flight: the range just picked would
 * silently revert, and the page asked for from the rail or ⌘K would never
 * arrive. So a tile picked mid-load shows at once and reaches the URL when
 * the navigation is over — the overview's own (its transition) or one
 * started elsewhere (navWatch.ts).
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
  const pathname = usePathname() ?? "/admin";
  const committed = useSearchParams()?.toString() ?? "";
  const [pending, startTransition] = useTransition();
  // A navigation's query from the moment it starts; a later one stacks on
  // top, and the URL takes over again when the page lands.
  const [loading, setLoading] = useOptimistic(committed);
  // A tile picked while the URL still names another metric.
  const [picked, setPicked] = useState<MetricKey | null>(null);
  // A navigation the overview did not start is on its way (navWatch.ts).
  const [away, setAway] = useState(false);
  // Only a new server render of the page replaces `children` — a URL write
  // and client state keep the same elements — so a new value means whatever
  // was on its way has landed here, or been replaced by one that did.
  const [served, setServed] = useState<ReactNode>(children);
  if (served !== children) {
    setServed(children);
    setAway(awayAfter(away, { kind: "render" }));
  }

  if (picked !== null && pickSettled(picked, loading, metrics)) setPicked(null);
  const metric = picked ?? metricFromParam(paramOf(loading, "metric"));
  const query = withPickedMetric(loading, picked);

  // The URL follows the tile, so a refresh or a shared link keeps the metric
  // — once nothing is loading, here or elsewhere; the pick waits until then.
  // `picked` differs from the URL's metric here (it clears once they agree).
  useEffect(() => {
    if (picked === null) return;
    const documentPath = window.location.pathname;
    if (!mayWriteUrl({ pending, away, documentPath, pagePath: pathname })) return;
    try {
      const url = new URL(window.location.href);
      const value = metricParam(picked);
      if (value) url.searchParams.set("metric", value);
      else url.searchParams.delete("metric");
      window.history.replaceState(null, "", url);
    } catch {
      // A blocked history API leaves the URL behind; the chart still follows.
    }
  }, [pending, away, picked, pathname]);

  // Navigations started elsewhere — a rail or top-bar link, the phone
  // drawer, ⌘K — and the back/forward that ends one (navWatch.ts).
  useEffect(() => {
    const observe = (signal: NavSignal) => setAway((was) => awayAfter(was, signal));
    // Bubble phase: by the time a click reaches the window, a <Link> has
    // taken it and its navigation has started.
    const onClick = (event: MouseEvent) =>
      observe({ kind: "click", click: seenClick(event), origin: window.location.origin });
    const onRequest = () => observe({ kind: "request" });
    const onHistory = () => observe({ kind: "history" });
    window.addEventListener("click", onClick);
    window.addEventListener(NAVIGATE_EVENT, onRequest);
    window.addEventListener("popstate", onHistory);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener(NAVIGATE_EVENT, onRequest);
      window.removeEventListener("popstate", onHistory);
    };
  }, []);

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
