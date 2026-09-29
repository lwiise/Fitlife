"use client";

import { Suspense, use, useEffect, useSyncExternalStore, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChartLine, LayoutGrid, Users } from "lucide-react";
import { FAMILY_VIEWS, type FamilyView } from "@/lib/admin/console-types";
import { Dot } from "../_ui/Pill";
import { LinkPending } from "../_ui/LinkPending";
import { requestFamiliesView } from "./events";
import type { ShellLabels } from "./labels";
import type { ShellNav } from "./navData";
import {
  readRememberedView,
  rememberView,
  serverRememberedView,
  subscribeRememberedView,
} from "./rememberedView";
import { VIEW_TONE, familiesViewHref, parseView } from "./views";

export type NavPromise = Promise<ShellNav | null>;

type RailLabels = Pick<
  ShellLabels,
  | "nav"
  | "overview"
  | "families"
  | "views"
  | "insights"
  | "hidden"
  | "updated"
  | "countsPartial"
  | "countsUnavailable"
>;

/** The desktop rail (≥1024px): sections, the saved views with live counts,
 * the hidden Insights entry and the data timestamp. */
export function Rail({ labels, nav }: { labels: RailLabels; nav: NavPromise }) {
  return (
    <nav className="ad-a-rail" aria-label={labels.nav}>
      <RailItems labels={labels} nav={nav} variant="rail" />
      <Suspense fallback={<div className="ad-rail-foot" />}>
        <RailFoot labels={labels} nav={nav} />
      </Suspense>
    </nav>
  );
}

/**
 * The navigation items, shared by the rail and the phone drawer. Active state
 * comes from the URL: Overview on /admin exactly; Families (and the matching
 * view) on /admin/families and on a family's own pages.
 */
export function RailItems({
  labels,
  nav,
  variant,
  onNavigate,
}: {
  labels: RailLabels;
  nav: NavPromise;
  /** The drawer shows the sections only, as in the phone design. */
  variant: "rail" | "drawer";
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  const queryView = params?.get("view") ?? null;
  const onOverview = pathname === "/admin";
  const onFamilies = pathname === "/admin/families";
  const onFamily = pathname.startsWith("/admin/subscribers/");
  const urlView = parseView(queryView);

  useEffect(() => {
    if (onFamilies) rememberView(urlView);
  }, [onFamilies, urlView]);
  const remembered = useSyncExternalStore(
    subscribeRememberedView,
    readRememberedView,
    serverRememberedView,
  );

  const currentView: FamilyView | null = onFamilies
    ? urlView
    : onFamily
      ? queryView
        ? urlView
        : remembered
      : null;
  const inFamilies = onFamilies || onFamily;

  // On the families page a view switch is client state — hand it to the page
  // (no server round-trip) and fall back to a normal navigation otherwise.
  function viewClick(event: MouseEvent<HTMLAnchorElement>, view: FamilyView) {
    onNavigate?.();
    if (!onFamilies) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (requestFamiliesView(view)) event.preventDefault();
  }

  return (
    <>
      <Link
        href="/admin"
        className="ad-ri"
        aria-current={onOverview ? "page" : undefined}
        onClick={onNavigate}
      >
        <LayoutGrid className="ad-ic" aria-hidden="true" />
        {labels.overview}
        <LinkPending />
      </Link>
      <Link
        href="/admin/families"
        className={variant === "rail" ? "ad-ri ad-parent" : "ad-ri"}
        aria-current={inFamilies ? (variant === "rail" ? "true" : "page") : undefined}
        onClick={(event) => viewClick(event, "all")}
      >
        <Users className="ad-ic" aria-hidden="true" />
        {labels.families}
        <LinkPending />
      </Link>
      {variant === "rail" ? (
        <>
          <div className="ad-rsub">
            {FAMILY_VIEWS.map((view) => (
              <Link
                key={view}
                href={familiesViewHref(view)}
                className="ad-rs"
                aria-current={currentView === view ? (onFamilies ? "page" : "true") : undefined}
                onClick={(event) => viewClick(event, view)}
              >
                <Dot tone={VIEW_TONE[view]} />
                {labels.views[view]}
                <Suspense fallback={<span className="ad-ct" />}>
                  <ViewCount nav={nav} view={view} />
                </Suspense>
                <LinkPending />
              </Link>
            ))}
          </div>
          <div className="ad-rsep" />
        </>
      ) : null}
      {/* Insights is hidden on purpose (INSIGHTS_HIDDEN) — shown, not linked. */}
      <p className="ad-ri ad-dim">
        <ChartLine className="ad-ic" aria-hidden="true" />
        {labels.insights}
        <span className="ad-rtag">{labels.hidden}</span>
      </p>
    </>
  );
}

function ViewCount({ nav, view }: { nav: NavPromise; view: FamilyView }) {
  const data = use(nav);
  return <span className="ad-ct">{data ? data.countText[view] : ""}</span>;
}

function RailFoot({ labels, nav }: { labels: RailLabels; nav: NavPromise }) {
  const data = use(nav);
  if (!data) {
    return (
      <div className="ad-rail-foot">
        <p>{labels.countsUnavailable}</p>
      </div>
    );
  }
  return (
    <div className="ad-rail-foot">
      <p>
        {labels.updated} <span className="ad-num">{data.updatedText}</span>
      </p>
      {data.partial ? <p className="ad-warn-text">{labels.countsPartial}</p> : null}
    </div>
  );
}
