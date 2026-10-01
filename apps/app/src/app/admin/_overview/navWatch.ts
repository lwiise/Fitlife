/**
 * Navigations the overview did not start (pure, client-safe).
 *
 * A metric picked on a tile reaches the URL through history.replaceState.
 * Next turns that into a router "restore", and a restore DISCARDS a
 * navigation still in flight (next/dist/client/components/
 * app-router-instance.js, dispatchAction): written while the families page
 * the operator has just asked for is loading, it would keep them on the
 * overview. The overview's own range and interval changes run in its own
 * transition (OverviewScope's `pending`); a navigation started anywhere else
 * — a rail or top-bar link, the phone drawer, a ⌘K destination, or a link
 * the overview's content may one day carry — is watched for here, and holds
 * the write until it is over:
 *
 *  - it landed on this page, or a navigation that replaced it did: a new
 *    server render of the overview arrives (`render`);
 *  - the browser moved to another history entry, which replaces whatever
 *    was on its way (`history`);
 *  - it left the page: the overview unmounts, and the write with it.
 *
 * The pick itself is kept meanwhile — the chart shows it, and links built
 * from the scope's query carry it — and reaches the URL once nothing is
 * loading.
 */

/**
 * Marks a link the overview follows itself — RangeControls' presets and
 * intervals take the click and navigate in the overview's transition, or,
 * on the option already shown, not at all. Spread `ownLink` onto it.
 */
export const OWN_LINK_ATTR = "data-ov-own";
export const ownLink = { [OWN_LINK_ATTR]: "" } as const;

/** A click as the window sees it once every handler has run (bubble phase). */
export interface SeenClick {
  /** preventDefault() was called — by Next's <Link> when it navigates. */
  defaultPrevented: boolean;
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  /**
   * The closest a[href] on the click's path: its resolved URL, target,
   * download attribute and whether the overview follows it itself
   * (OWN_LINK_ATTR); null without one.
   */
  link: { href: string; target: string; download: boolean; own: boolean } | null;
}

/**
 * Did this click start a client-side navigation the overview did not start?
 * Next's <Link> takes a plain primary click on an in-app link: it calls
 * preventDefault() and starts the navigation before the click reaches the
 * window. So a click that ends prevented, unmodified, on a same-tab link of
 * this origin that the overview does not follow itself is one — to ANY path,
 * the overview's own included: the rail's «نظرة عامة» and the brand reach
 * /admin through the router too, and a restore landing meanwhile discards
 * them just the same. (The families console's startsNavigationAway asks the
 * same question with one exemption, links to its own path, which it handles
 * in-page; the overview handles none.)
 */
export function clickStartsNavigation(click: SeenClick, origin: string): boolean {
  const { link } = click;
  if (!link || link.own || !click.defaultPrevented || click.button !== 0) return false;
  if (click.altKey || click.ctrlKey || click.metaKey || click.shiftKey) return false;
  if ((link.target && link.target !== "_self") || link.download) return false;
  let url: URL;
  try {
    url = new URL(link.href, origin);
  } catch {
    return false;
  }
  return url.origin === origin;
}

/** What the overview observes about navigations it did not start. */
export type NavSignal =
  /** A click, as the window saw it once every handler had run; `origin` is the page's. */
  | { kind: "click"; click: SeenClick; origin: string }
  /** The frame is about to push a ⌘K destination (NAVIGATE_EVENT). */
  | { kind: "request" }
  /** The browser moved to another history entry (popstate). */
  | { kind: "history" }
  /** A new server render of the overview arrived. */
  | { kind: "render" };

/** Whether a navigation the overview did not start is on its way after `signal`. */
export function awayAfter(away: boolean, signal: NavSignal): boolean {
  switch (signal.kind) {
    case "click":
      return away || clickStartsNavigation(signal.click, signal.origin);
    case "request":
      return true;
    case "history":
    case "render":
      return false;
  }
}

/**
 * The URL may be written now: nothing is loading — neither the overview's
 * own transition (`pending`) nor a navigation started elsewhere (`away`) —
 * and the document is still on the overview's path, so a write never lands
 * on another page's history entry.
 */
export function mayWriteUrl(state: {
  pending: boolean;
  away: boolean;
  documentPath: string;
  pagePath: string;
}): boolean {
  return !state.pending && !state.away && state.documentPath === state.pagePath;
}
