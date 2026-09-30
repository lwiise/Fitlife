/**
 * The families console's URL writer. The list's state reaches the address bar
 * through history.replaceState — after a pause while the operator types, at
 * once for anything else — so the URL restores the screen without a server
 * round trip.
 *
 * It is more than a timer because Next patches replaceState: every write
 * dispatches a router "restore", and a restore that arrives while a
 * navigation or a server action is still pending DISCARDS that navigation
 * (next/dist/client/components/app-router-instance.js, dispatchAction). A
 * write that lands late can therefore swallow the navigation the operator
 * has just started. So:
 *
 *  - At most one write waits; a newer one replaces it (`push`).
 *  - `flush()` performs the waiting write now. The console calls it on any
 *    pointer press, when the search box loses focus, and before it navigates,
 *    so whatever starts next is never followed by a late write.
 *  - `hold()` flushes, then refuses every write until the hold ends: the page
 *    is on its way to another one. A hold ends only after its pending state
 *    has been on screen and gone again (`holdShown` / `holdGone`), i.e. the
 *    navigation settled without leaving; the console then writes what the
 *    list wants by then.
 *  - A write happens only while the document is still on the list's own
 *    path — never onto another page's history entry.
 *  - Every search written is remembered until its echo comes back through
 *    useSearchParams, so the console can tell its own writes from a URL that
 *    changed under it (`isOwnEcho`, `settle`).
 *
 * Plain TypeScript with an injectable host, so the policy is unit-tested
 * (urlSync.test.ts).
 */

import { urlWriteDelay } from "./listModel";

export interface UrlHost {
  /** The document's location now (`search` with its "?", `hash` with its "#"). */
  location(): { pathname: string; search: string; hash: string };
  /** history.replaceState to this path + query + hash. */
  replace(url: string): void;
  setTimeout(run: () => void, ms: number): number;
  clearTimeout(id: number | undefined): void;
}

const browserHost: UrlHost = {
  location: () => window.location,
  replace: (url) => {
    try {
      window.history.replaceState(null, "", url);
    } catch {
      // Throttled by the browser (Safari: 100 calls in 30 seconds): the next
      // write catches the URL up.
    }
  },
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

/** Writes remembered while their echo is due — a bound, not a budget. */
const ECHO_MEMORY = 16;

export class UrlSync {
  /** The list's own path (the page's usePathname()). */
  private path: string | null = null;
  private timer: number | undefined;
  /** The write waiting for its timer. */
  private waiting: string | null = null;
  private held: { token: number; shown: boolean } | null = null;
  private holds = 0;
  /** Searches written whose echo has not been seen yet, oldest first. */
  private readonly unechoed: string[] = [];

  constructor(private readonly host: UrlHost = browserHost) {}

  /**
   * The list now wants `search` (canonical, without "?") in the URL of
   * `path`: written after a pause when only the search text changed, at once
   * otherwise, not at all when the URL already says it. Held: nothing.
   */
  push(path: string, search: string): void {
    this.path = path;
    if (this.held) return;
    const here = this.here();
    const delay = here === null ? null : urlWriteDelay(here, search);
    // Whatever waited is outdated now (or, off the list's path, unwanted).
    this.cancel();
    if (delay === null) return;
    if (delay === 0) {
      this.write(search);
      return;
    }
    this.waiting = search;
    this.timer = this.host.setTimeout(() => this.flush(), delay);
  }

  /** Perform the waiting write now; nothing waits → nothing happens. */
  flush(): void {
    const search = this.waiting;
    this.cancel();
    if (search !== null) this.write(search);
  }

  /** Drop the waiting write (the page unmounts, or the browser moved to another entry). */
  cancel(): void {
    this.host.clearTimeout(this.timer);
    this.timer = undefined;
    this.waiting = null;
  }

  /** On the way to another page: write what waits, then nothing. Returns the hold's token. */
  hold(): number {
    this.flush();
    this.holds += 1;
    this.held = { token: this.holds, shown: false };
    return this.holds;
  }

  isHeld(): boolean {
    return this.held !== null;
  }

  /** The hold's pending state has rendered. */
  holdShown(token: number): void {
    if (this.held?.token === token) this.held.shown = true;
  }

  /**
   * The pending state is off the screen again: a hold that had rendered ends
   * (the navigation settled and the page stayed). A hold that has not
   * rendered yet is kept — a render that ran before it knows nothing of it.
   */
  holdGone(): void {
    if (this.held?.shown) this.held = null;
  }

  /** True when `search` is one of this page's writes whose echo is still due. Pure. */
  isOwnEcho(search: string): boolean {
    return this.unechoed.includes(search);
  }

  /**
   * The page now shows `search`. An own echo retires that write and every
   * earlier one (echoes come back in order, and several can arrive as one);
   * any other URL came from outside, and no earlier write can echo after it.
   */
  settle(search: string): void {
    const i = this.unechoed.lastIndexOf(search);
    this.unechoed.splice(0, i >= 0 ? i + 1 : this.unechoed.length);
  }

  /** The search the address bar holds, or null when the document is not on the list's path. */
  private here(): string | null {
    const { pathname, search } = this.host.location();
    return pathname === this.path ? search.replace(/^\?/, "") : null;
  }

  private write(search: string): void {
    const here = this.here();
    // The document moved on (a navigation committed first), or already says it.
    if (here === null || here === search) return;
    this.unechoed.push(search);
    if (this.unechoed.length > ECHO_MEMORY) this.unechoed.shift();
    const { pathname, hash } = this.host.location();
    this.host.replace(`${pathname}${search ? `?${search}` : ""}${hash}`);
  }
}
