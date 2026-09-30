"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { previousPageDelta } from "@/components/shell/previousPage";

/** The slice of the Navigation API used here — TypeScript's DOM lib has no `window.navigation` yet. */
type NavigationApi = {
  readonly currentEntry: Pick<NavigationHistoryEntry, "index"> | null;
  entries(): ReadonlyArray<Pick<NavigationHistoryEntry, "url">>;
};

/**
 * A link back to the page the user came from. It goes BACK through the tab's
 * history instead of pushing that page again, so the phone's back gesture keeps
 * going backwards afterwards and the previous page gets its scroll position back.
 * Which entry counts as "the page the user came from" is `previousPageDelta`.
 *
 * `href` is only the fallback: where the link goes when this tab has no
 * previous page to return to (a deep link, a new tab, the return from
 * checkout), when the browser lacks the Navigation API, and what a middle-click
 * or «open in new tab» opens.
 */
export function PreviousPageLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const here = usePathname();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const navigation = (window as Window & { navigation?: NavigationApi }).navigation;
    const current = navigation?.currentEntry;
    if (!navigation || !current) return;
    const delta = previousPageDelta(
      navigation.entries().map((entry) => entry.url),
      current.index,
      here,
    );
    if (delta === null) return;
    event.preventDefault();
    window.history.go(delta);
  }

  return <Link {...props} href={href} onClick={goBack} />;
}
