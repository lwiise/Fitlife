"use client";

import { startTransition, useOptimistic, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

export interface LinkTab {
  id: string;
  label: ReactNode;
  href: string;
}

/**
 * Tabs that are real links (`.ad-tabs`, `aria-current="page"` on the active
 * one) — for server-rendered tab bodies such as the family page's `?tab=`.
 * They stay links for everything a link does (middle-click, open in a new
 * tab, prefetch); only a plain in-app click is taken over, so the round trip
 * can be shown:
 *
 * the navigation runs in a transition, and until the new tab has rendered
 * the tab list reports `aria-busy`, the chosen tab carries `aria-busy` and a
 * pulsing underline hint, and the tab body being replaced dims — never a
 * frozen screen. The CSS finds the body by position: whatever follows the tab
 * list in its container, or, when the list closes a phone header
 * (`.ad-ph-top`), whatever follows that header. `aria-current` stays on the
 * tab actually shown until the server answers.
 *
 * A client component (it needs the router); server pages render it with
 * plain props. For in-page (client) tabs, render
 * `<div role="tablist" class="ad-tabs">` with buttons carrying
 * `aria-selected` instead; the CSS covers both.
 */
export function LinkTabs({
  items,
  current,
  label,
  className,
}: {
  items: LinkTab[];
  current: string;
  /** Accessible name of the tab navigation. */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  // Lives exactly as long as the navigation's transition, then clears itself.
  const [pendingId, setPendingId] = useOptimistic<string | null>(null);

  return (
    <nav
      aria-label={label}
      aria-busy={pendingId !== null || undefined}
      className={clsx("ad-tabs", className)}
    >
      {items.map((tab) => {
        const pending = tab.id === pendingId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === current ? "page" : undefined}
            aria-busy={pending || undefined}
            scroll={false}
            onNavigate={(event) => {
              // Only in-app navigations reach here (not new-tab clicks).
              if (tab.id === current) return;
              event.preventDefault();
              startTransition(() => {
                setPendingId(tab.id);
                router.push(tab.href, { scroll: false });
              });
            }}
          >
            {tab.label}
            <span aria-hidden="true" className={pending ? "ad-lp ad-on" : "ad-lp"} />
          </Link>
        );
      })}
    </nav>
  );
}
