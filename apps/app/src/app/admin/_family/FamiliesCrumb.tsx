"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LinkPending } from "../_ui/LinkPending";
import {
  readRememberedView,
  serverRememberedView,
  subscribeRememberedView,
} from "../_shell/rememberedView";
import { familiesViewHref } from "../_shell/views";

/**
 * «العائلات» — back to the families list, on the view the operator last had
 * open (the one the rail keeps lit on this page), not always «كل العائلات».
 * The server renders the plain list; the remembered view is applied after
 * hydration. The family page's desktop crumb; below 1024px the top bar
 * carries the same way back (_shell/PhoneBarTitle).
 */
export function FamiliesCrumb({ label }: { label: string }) {
  const view = useSyncExternalStore(
    subscribeRememberedView,
    readRememberedView,
    serverRememberedView,
  );
  return (
    <Link href={familiesViewHref(view)} className="ad-crumb ad-desk-only">
      <ChevronLeft className="ad-ic ad-flip" aria-hidden="true" />
      {label}
      <LinkPending />
    </Link>
  );
}
