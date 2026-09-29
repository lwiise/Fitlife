"use client";

import { useLinkStatus } from "next/link";

/**
 * A fixed-size pending hint for the enclosing `<Link>` — it only toggles its
 * opacity, so a slow navigation is acknowledged without moving anything.
 * Must be rendered inside a next/link `<Link>`.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={pending ? "ad-lp ad-on" : "ad-lp"} />;
}
