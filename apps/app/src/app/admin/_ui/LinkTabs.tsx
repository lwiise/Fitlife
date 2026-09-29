import type { ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { LinkPending } from "./LinkPending";

export interface LinkTab {
  id: string;
  label: ReactNode;
  href: string;
}

/**
 * Tabs that are real links (`.ad-tabs`, `aria-current="page"` on the active
 * one) — for server-rendered tab bodies such as the family page's `?tab=`.
 * A pending navigation dims into a thin underline hint (LinkPending).
 * For in-page (client) tabs, render `<div role="tablist" class="ad-tabs">`
 * with buttons carrying `aria-selected` instead; the CSS covers both.
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
  return (
    <nav aria-label={label} className={clsx("ad-tabs", className)}>
      {items.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === current ? "page" : undefined}
          scroll={false}
        >
          {tab.label}
          <LinkPending />
        </Link>
      ))}
    </nav>
  );
}
