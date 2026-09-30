import { Skeleton, SkeletonGroup } from "../_ui/Skeleton";

/**
 * The Overview's loading shape: the head (title + range row), four metric
 * tiles, the chart card, then the cost and engagement tiles — laid out with
 * the page's own grids and heights so nothing moves when the figures arrive.
 * Announced once as a status; the pulse stops under reduced motion.
 */
export function OverviewSkeleton({ label }: { label: string }) {
  return (
    <div className="ad-a-ov">
      <SkeletonGroup label={label} className="ad-a-ov-in ad-ov-in">
        <div className="ad-ovhead">
          <Skeleton shape="title" className="ad-ov-skel-h1" />
          {/* The range row's four controls, at their drawn widths, so the
              head wraps where the real one does. */}
          <div className="ad-filters">
            <Skeleton shape="btn" className="ad-ov-skel-presets" />
            <Skeleton shape="btn" className="ad-ov-skel-custom" />
            <Skeleton shape="btn" className="ad-ov-skel-interval" />
            <Skeleton shape="btn" className="ad-ov-skel-customize" />
          </div>
        </div>
        <div className="ad-ov-body">
          <div className="ad-kpis">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} shape="tile" className="ad-ov-skel-kpi" />
            ))}
          </div>
          <Skeleton shape="chart" className="ad-ov-skel-chart" />
          <div className="ad-stack">
            <Skeleton className="ad-ov-skel-sec" width={20} />
            <div className="ad-tiles ad-c6">
              <Skeleton shape="tile" className="ad-tile ad-big ad-ov-skel-tile" />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} shape="tile" className="ad-ov-skel-tile" />
              ))}
            </div>
          </div>
          <div className="ad-stack">
            <Skeleton className="ad-ov-skel-sec" width={16} />
            <div className="ad-tiles ad-c6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} shape="tile" className="ad-ov-skel-tile" />
              ))}
            </div>
          </div>
        </div>
      </SkeletonGroup>
    </div>
  );
}
