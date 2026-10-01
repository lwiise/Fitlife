"use client";

import { startTransition, useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { shouldQuietRefresh } from "@/lib/admin/freshness";

/**
 * Keeps an open families list current. The list is client state — search,
 * filters, sort and paging never go back to the server — so a tab left open
 * would otherwise show the data it was loaded with until it is reloaded by
 * hand: runs it calls live that have since died, trials since ended, new
 * families missing. When the operator comes back to the tab (it regains
 * focus or becomes visible) and the data is older than the cache's TTL, the
 * page refreshes itself (shouldQuietRefresh, lib/admin/freshness.ts).
 *
 * `router.refresh()` re-renders the route on the server, the console frame
 * with it: new rows reach the console as props while its search, filters,
 * sort, page and open family — client state — stay as they are, and the
 * rail's counts and «updated» time come back with them. It runs in a
 * transition, so nothing on screen blanks while it loads.
 *
 * The data's age is measured on server clocks (the render's `nowIso` minus
 * the dataset's `loadedAt`) plus the browser time since that render arrived,
 * so a device clock that is off cannot make fresh data look old or old data
 * fresh.
 *
 * `canRefresh` is asked first: the console declines while a navigation is on
 * its way (a URL write — or this refresh — must not land on it) and sends a
 * waiting URL write out before saying yes. A write that lands while the
 * refresh is still pending makes the router drop it; the next return to the
 * tab asks again.
 */
export function useQuietRefresh({
  loadedAt,
  nowIso,
  canRefresh,
}: {
  /** When the list's dataset was read (ISO, server clock). */
  loadedAt: string;
  /** When the server rendered the page (ISO, server clock). */
  nowIso: string;
  canRefresh: () => boolean;
}): void {
  const router = useRouter();
  /** Browser time this render's data arrived; null until the first effect. */
  const receivedAt = useRef<number | null>(null);
  /** Browser time of the last refresh this page asked for. */
  const lastAttempt = useRef<number | null>(null);

  useEffect(() => {
    receivedAt.current = Date.now();
  }, [loadedAt, nowIso]);

  const onReturn = useEffectEvent(() => {
    if (document.visibilityState !== "visible" || receivedAt.current === null) return;
    const now = Date.now();
    const refresh = shouldQuietRefresh({
      ageAtRenderMs: Date.parse(nowIso) - Date.parse(loadedAt),
      sinceRenderMs: now - receivedAt.current,
      sinceLastAttemptMs: lastAttempt.current === null ? Infinity : now - lastAttempt.current,
    });
    if (!refresh || !canRefresh()) return;
    lastAttempt.current = now;
    startTransition(() => router.refresh());
  });

  useEffect(() => {
    const onChange = () => onReturn();
    window.addEventListener("focus", onChange);
    document.addEventListener("visibilitychange", onChange);
    return () => {
      window.removeEventListener("focus", onChange);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, []);
}
