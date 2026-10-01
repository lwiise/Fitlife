/**
 * The side panel's data: ONE JSON fetch per family
 * (GET /api/admin/families/:id), cached in memory, prefetched when a row is
 * hovered or focused, and aborted when something newer supersedes it.
 *
 * Plain TypeScript — no React — so the console holds one instance and the
 * policy is unit-tested (panelLoader.test.ts):
 *
 *  - At most ONE prefetch is in flight: a new one aborts the previous one.
 *  - At most ONE open request is in flight: opening another family aborts
 *    it. A prefetch never aborts an open request.
 *  - Opening a family whose prefetch is still running adopts that request
 *    (no second fetch — and no second audit row: every fetch the route
 *    answers is a `view_subscriber_detail` in the audit log).
 *  - Answers are cached for PANEL_TTL_MS (a stale entry is still returned
 *    by `peek`, so it can be shown while it is refreshed), at most
 *    PANEL_CACHE_MAX families, least recently used first out. Failures are
 *    never cached: the next open tries again.
 *  - Only the route's MARKED 404 (lib/admin/panelResponse.ts: the requester
 *    is an admin and the family does not exist) is an answer — "missing",
 *    cached like data. A bare 404 is what anyone who is not (or no longer)
 *    an admin gets — a session that ended, a sign-out in another tab — and
 *    says nothing about the family: "denied", never cached, so the next
 *    open asks again.
 */

import type { FamilyPanelData } from "@/lib/admin/console-types";
import { isFamilyGone } from "@/lib/admin/panelResponse";
import { riyadhTodayISO } from "@/lib/plans/dayMapping";

export type PanelResult =
  | { kind: "ok"; data: FamilyPanelData }
  /** The family does not exist (the route's marked 404). */
  | { kind: "missing" }
  /** The route no longer takes the operator for an admin (a bare 404). */
  | { kind: "denied" }
  | { kind: "error" };

/** Answers worth keeping: the data, or that the family is gone. */
function isCacheable(result: PanelResult): boolean {
  return result.kind === "ok" || result.kind === "missing";
}

export interface PanelEntry {
  id: string;
  result: PanelResult;
  /** Epoch ms the answer arrived. */
  fetchedAt: number;
  /** "Now" for the blocks' relative times, fixed when the answer arrived. */
  nowIso: string;
  /** Today's Riyadh date (YYYY-MM-DD), for the week explorers. */
  todayIso: string;
}

export interface PanelClock {
  now(): number;
  todayIso(): string;
}

export type PanelFetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Two minutes: re-opening a family after that fetches it again. */
export const PANEL_TTL_MS = 120_000;
export const PANEL_CACHE_MAX = 40;

const systemClock: PanelClock = { now: () => Date.now(), todayIso: riyadhTodayISO };

export function panelUrl(id: string): string {
  return `/api/admin/families/${encodeURIComponent(id)}`;
}

/** The four sections the route always sends (a minimal sanity check, not a schema). */
export function isPanelData(value: unknown): value is FamilyPanelData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const isObject = (x: unknown) => !!x && typeof x === "object";
  return isObject(v.header) && isObject(v.meal) && isObject(v.workout) && Array.isArray(v.household);
}

type Role = "open" | "prefetch";

interface InFlight {
  ctrl: AbortController;
  role: Role;
  promise: Promise<PanelEntry | null>;
}

export class PanelLoader {
  private readonly cache = new Map<string, PanelEntry>();
  private readonly inflight = new Map<string, InFlight>();

  constructor(
    private readonly fetcher: PanelFetcher = (url, init) => fetch(url, init),
    private readonly clock: PanelClock = systemClock,
  ) {}

  /** The cached answer (fresh or stale), or undefined. */
  peek(id: string): PanelEntry | undefined {
    const entry = this.cache.get(id);
    if (entry) {
      // Most recently used goes last.
      this.cache.delete(id);
      this.cache.set(id, entry);
    }
    return entry;
  }

  isFresh(entry: PanelEntry): boolean {
    return this.clock.now() - entry.fetchedAt < PANEL_TTL_MS;
  }

  isLoading(id: string): boolean {
    return this.inflight.has(id);
  }

  /**
   * Warm the cache for a family the operator is likely to open. A no-op when
   * anything for it is cached (even stale — the open refreshes it) or already
   * in flight.
   */
  prefetch(id: string): void {
    if (this.cache.has(id) || this.inflight.has(id)) return;
    for (const [other, request] of [...this.inflight]) {
      if (request.role === "prefetch") this.abort(other);
    }
    this.start(id, "prefetch");
  }

  /**
   * Fetch a family for the open panel (whatever is cached — the caller
   * decides whether a cached answer is good enough). Resolves to the answer,
   * or null when the request was aborted.
   */
  load(id: string): Promise<PanelEntry | null> {
    for (const [other, request] of [...this.inflight]) {
      if (other !== id && request.role === "open") this.abort(other);
    }
    const running = this.inflight.get(id);
    if (running) {
      running.role = "open";
      return running.promise;
    }
    return this.start(id, "open").promise;
  }

  /** The panel closed: its request is no longer wanted. */
  abortOpen(): void {
    for (const [id, request] of [...this.inflight]) {
      if (request.role === "open") this.abort(id);
    }
  }

  /** Abort everything in flight (the page is going away). The cache stays. */
  abortAll(): void {
    for (const id of [...this.inflight.keys()]) this.abort(id);
  }

  private abort(id: string): void {
    const request = this.inflight.get(id);
    if (!request) return;
    this.inflight.delete(id);
    request.ctrl.abort();
  }

  private start(id: string, role: Role): InFlight {
    const ctrl = new AbortController();
    const request: InFlight = { ctrl, role, promise: Promise.resolve(null) };
    request.promise = this.request(id, ctrl.signal).then((result) => {
      if (this.inflight.get(id) === request) this.inflight.delete(id);
      if (!result) return null;
      const fetchedAt = this.clock.now();
      const entry: PanelEntry = {
        id,
        result,
        fetchedAt,
        nowIso: new Date(fetchedAt).toISOString(),
        todayIso: this.clock.todayIso(),
      };
      if (isCacheable(result)) this.remember(entry);
      return entry;
    });
    this.inflight.set(id, request);
    return request;
  }

  private async request(id: string, signal: AbortSignal): Promise<PanelResult | null> {
    try {
      const res = await this.fetcher(panelUrl(id), {
        signal,
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (signal.aborted) return null;
      if (res.status === 404) {
        const body: unknown = await res.json().catch(() => null);
        if (signal.aborted) return null;
        return isFamilyGone(body) ? { kind: "missing" } : { kind: "denied" };
      }
      if (!res.ok) return { kind: "error" };
      const body: unknown = await res.json();
      if (signal.aborted) return null;
      return isPanelData(body) ? { kind: "ok", data: body } : { kind: "error" };
    } catch {
      return signal.aborted ? null : { kind: "error" };
    }
  }

  private remember(entry: PanelEntry): void {
    this.cache.delete(entry.id);
    this.cache.set(entry.id, entry);
    while (this.cache.size > PANEL_CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
