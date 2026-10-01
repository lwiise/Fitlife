"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LinkPending } from "../_ui/LinkPending";
import type { ShellLabels } from "./labels";
import {
  readRememberedView,
  serverRememberedView,
  subscribeRememberedView,
} from "./rememberedView";
import { familiesViewHref } from "./views";

/** A family's own page — not its health, plan or program views. */
const FAMILY_PAGE = /^\/admin\/subscribers\/[^/]+\/?$/;

/**
 * The middle of the top bar below 1024px, where the approved phone screens
 * put the page's title or its way back, so a phone shows ONE bar — not the
 * frame's brand bar stacked over a page header band (the brand lives in the
 * drawer there). Taken from the route, so it is in the server's HTML, holds
 * through a page's loading state and changes with every navigation:
 *  - the families list: «العائلات» (the page keeps its heading for assistive
 *    tech, so this one is hidden from it);
 *  - a family's page: «‹ العائلات», back to the saved view last open.
 * Every other page shows its own heading, and the plan, program and health
 * views their own way back, named after the family.
 */
export function PhoneBarTitle({ labels }: { labels: Pick<ShellLabels, "families"> }) {
  const pathname = usePathname() ?? "";
  const view = useSyncExternalStore(
    subscribeRememberedView,
    readRememberedView,
    serverRememberedView,
  );
  if (pathname === "/admin/families") {
    return (
      <p className="ad-top-title ad-phone-only" aria-hidden="true">
        {labels.families}
      </p>
    );
  }
  if (FAMILY_PAGE.test(pathname)) {
    return (
      <Link href={familiesViewHref(view)} className="ad-ph-back ad-phone-only">
        <ChevronLeft className="ad-ic ad-flip" aria-hidden="true" />
        {labels.families}
        <LinkPending />
      </Link>
    );
  }
  return null;
}
