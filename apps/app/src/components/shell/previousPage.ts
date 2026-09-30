import { activeNavKey, NAV_ITEMS } from "./nav";

/**
 * Where a settings page's «رجوع» returns to (owner directive 09/2026: the
 * settings pages go back to the PREVIOUS page — /journey opened from the plan
 * returns to the plan, not to a fixed parent).
 *
 * Given the tab's history entry URLs (the Navigation API's same-origin list),
 * the index of the current one and the current pathname, returns how many steps
 * back the previous page is, or null when there is none — the link then follows
 * its own href instead.
 *
 * Walking back, an entry is passed over when it is:
 * - this page again: a member chip, a hash link, `?edited=…` after a save;
 * - one of this page's own sub-pages: the form a save just came from, which a
 *   plain history.back() would reopen;
 * - anywhere in the section, when this page is the section's root (/settings,
 *   the «حسابي» tab): back from the hub leaves the account area. Stepping back
 *   into a page the hub opened would bounce between the two — a page reached
 *   with no history behind it falls back to the hub, whose back would then
 *   return straight to it.
 * The walk gives up at an entry it cannot read, and at a sign-in page: nothing
 * before signing in is a page to go back to.
 */
export function previousPageDelta(
  urls: readonly (string | null | undefined)[],
  currentIndex: number,
  here: string,
): number | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const path = pathnameOf(urls[i]);
    if (path === null || isAuthPath(path)) return null;
    if (!isPartOf(path, here)) return i - currentIndex;
  }
  return null;
}

function isPartOf(path: string, here: string): boolean {
  if (path === here || path.startsWith(`${here}/`)) return true;
  const section = NAV_ITEMS.find((item) => item.href === here);
  return section !== undefined && activeNavKey(path) === section.key;
}

function isAuthPath(path: string): boolean {
  return path === "/auth" || path.startsWith("/auth/");
}

function pathnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
