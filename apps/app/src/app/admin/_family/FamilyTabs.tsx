"use client";

import { useSearchParams } from "next/navigation";
import { LinkTabs, type LinkTab } from "../_ui/LinkTabs";
import { parseFamilyTab } from "./model";

/**
 * The family page's tab bar. It is part of the head, which the family layout
 * renders once per visit: `?tab` is the page's own state, and a tab switch
 * re-renders the page alone. So the bar reads the tab shown from the URL
 * itself — by the page's own rule (parseFamilyTab), the first `tab` value —
 * and keeps `aria-current` on that tab until the switch has landed, as
 * LinkTabs does for any tab bar. The links and their labels come from the
 * server.
 */
export function FamilyTabs({
  items,
  label,
  className,
}: {
  items: LinkTab[];
  label: string;
  className?: string;
}) {
  const current = parseFamilyTab(useSearchParams().getAll("tab"));
  return <LinkTabs items={items} current={current} label={label} className={className} />;
}
