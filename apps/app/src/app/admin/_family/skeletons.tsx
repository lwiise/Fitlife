import type { ReactNode } from "react";
import type { FamilyTab } from "@/lib/admin/console-types";
import { Skeleton, SkeletonGroup } from "../_ui/Skeleton";

/**
 * Loading shapes for the family page and its audited views, laid out with the
 * real pages' own containers and heights so nothing jumps when the content
 * arrives. Presentational only (no hooks), so the route skeleton — a client
 * component — can use them too. Each loading region is announced once
 * (SkeletonGroup); the pulse stops under prefers-reduced-motion.
 */

function Panel({ children }: { children: ReactNode }) {
  return <div className="ad-card ad-panel">{children}</div>;
}

function Title({ width = 28 }: { width?: number }) {
  return <Skeleton shape="text" width={width} />;
}

function Rows({ count }: { count: number }) {
  return (
    <div className="ad-fp-skel-rows">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} />
      ))}
    </div>
  );
}

function Kv({ count }: { count: number }) {
  return (
    <div className="ad-kv">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ad-fp-skel-id">
          <Skeleton shape="text" width={40} />
          <Skeleton width={i % 3 === 2 ? 55 : 75} />
        </div>
      ))}
    </div>
  );
}

function Chips({ count }: { count: number }) {
  return (
    <div className="ad-fp-skel-row">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="ad-fp-skel-chip" />
      ))}
    </div>
  );
}

function Grid7({ className }: { className: string }) {
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </>
  );
}

/** The shape of one tab's body, in the page's own grid. */
export function TabBodySkeleton({ tab }: { tab: FamilyTab }) {
  switch (tab) {
    case "meal":
      return (
        <div className="ad-grid-2">
          <Panel>
            <Chips count={4} />
            <div className="ad-days7">
              <Grid7 className="ad-fp-skel-day" />
            </div>
            <Rows count={5} />
            <Skeleton shape="btn" />
          </Panel>
          <div className="ad-col">
            <Panel>
              <Title />
              <Skeleton className="ad-fp-skel-box" />
            </Panel>
            <Panel>
              <Title />
              <Rows count={3} />
            </Panel>
          </div>
        </div>
      );
    case "exercise":
      return (
        <>
          <Panel>
            <div className="ad-panel-h">
              <Title width={22} />
              <Skeleton shape="btn" />
            </div>
            <Skeleton className="ad-fp-skel-box" />
            <Chips count={2} />
            <div className="ad-wk">
              <Grid7 className="ad-fp-skel-wd" />
            </div>
          </Panel>
          <div className="ad-grid-2">
            <Panel>
              <Title />
              <Rows count={2} />
            </Panel>
            <Panel>
              <Title />
              <Rows count={2} />
            </Panel>
          </div>
        </>
      );
    case "household":
      return (
        <Panel>
          <div className="ad-panel-h">
            <Title width={22} />
            <Skeleton shape="btn" />
          </div>
          <Rows count={5} />
        </Panel>
      );
    case "billing":
      return (
        <div className="ad-grid-2">
          <Panel>
            <Title />
            <Kv count={9} />
          </Panel>
          <Panel>
            <Title />
            <Kv count={7} />
          </Panel>
        </div>
      );
    case "runs":
      return (
        <Panel>
          <Title width={18} />
          <Rows count={6} />
        </Panel>
      );
    case "account":
      return (
        <Panel>
          <Title width={18} />
          {[0, 1].map((i) => (
            <div key={i} className="ad-dz-row">
              <div className="ad-fp-skel-id">
                <Skeleton shape="text" width={30} />
                <Skeleton shape="text" width={70} />
              </div>
              <Skeleton shape="btn" />
            </div>
          ))}
        </Panel>
      );
    default:
      return (
        <div className="ad-grid-2">
          <div className="ad-col">
            <Panel>
              <Title width={24} />
              <Skeleton className="ad-fp-skel-box" />
            </Panel>
            <Panel>
              <Title width={24} />
              <Skeleton className="ad-fp-skel-box" />
            </Panel>
          </div>
          <div className="ad-col">
            <Panel>
              <Title width={20} />
              <Kv count={6} />
            </Panel>
            <Panel>
              <Title width={20} />
              <Kv count={3} />
            </Panel>
          </div>
        </div>
      );
  }
}

/** The tab body's Suspense fallback — a sibling of the tab bar, like the body. */
export function TabSkeleton({ tab, label }: { tab: FamilyTab; label: string }) {
  return (
    <SkeletonGroup label={label} className="ad-fp-skel">
      <TabBodySkeleton tab={tab} />
    </SkeletonGroup>
  );
}

function PageHeadSkeleton({ chips }: { chips: number }) {
  return (
    <div className="ad-fp-skel-id">
      <Skeleton shape="title" className="ad-fp-skel-h1" />
      <Skeleton shape="text" className="ad-fp-skel-sub" />
      <div className="ad-fp-skel-row">
        {Array.from({ length: chips }, (_, i) => (
          <Skeleton key={i} shape="pill" />
        ))}
      </div>
    </div>
  );
}

/**
 * The whole family page while its head loads: the phone band below 1024px;
 * from 1024px the crumb, the head, the seven tabs, and the summary's shape
 * (the body a direct link most often opens on).
 */
export function FamilyPageSkeleton({ label }: { label: string }) {
  return (
    <div className="ad-a-page">
      <div className="ad-ph-top ad-phone-only" aria-hidden="true">
        <Skeleton shape="text" className="ad-fp-skel-crumb" />
        <PageHeadSkeleton chips={3} />
        <div className="ad-fp-skel-tabs">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      </div>
      <SkeletonGroup label={label} className="ad-a-page-in ad-fp-skel">
        <Skeleton shape="text" className="ad-fp-skel-crumb ad-desk-only" />
        <div className="ad-p-head ad-desk-only">
          <PageHeadSkeleton chips={3} />
          <Skeleton shape="btn" />
        </div>
        <div className="ad-fp-skel-tabs ad-desk-only">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
        <TabBodySkeleton tab="summary" />
      </SkeletonGroup>
    </div>
  );
}

/** The audited health page: the head, the audit note, a card per member. */
export function HealthPageSkeleton({ label }: { label: string }) {
  return (
    <div className="ad-a-page">
      <SkeletonGroup label={label} className="ad-a-page-in ad-fp-skel">
        <Skeleton shape="text" className="ad-fp-skel-crumb" />
        <Skeleton shape="title" className="ad-fp-skel-h1" />
        <Skeleton className="ad-fp-skel-note" />
        <div className="ad-health-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="ad-fp-skel-hcard" />
          ))}
        </div>
      </SkeletonGroup>
    </div>
  );
}

/** The meal-plan and program views: the head, the audit line, the viewer. */
export function ViewerPageSkeleton({ label }: { label: string }) {
  return (
    <div className="ad-a-page">
      <SkeletonGroup label={label} className="ad-a-page-in ad-fp-skel">
        <Skeleton shape="text" className="ad-fp-skel-crumb" />
        <PageHeadSkeleton chips={1} />
        <Skeleton shape="text" width={30} />
        <Skeleton className="ad-fp-skel-viewer" />
      </SkeletonGroup>
    </div>
  );
}
