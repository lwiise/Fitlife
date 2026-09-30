import { FAMILY_COLUMNS, type FamilyColumn } from "@/lib/admin/console-types";
import { Skeleton, SkeletonGroup } from "../_ui";

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const CARDS = [0, 1, 2, 3] as const;
const CHIPS = [0, 1, 2] as const;

/** Columns drawn as a pill (a tag or a state) rather than a line of text. */
const PILL_COLUMNS = new Set<FamilyColumn>(["tier", "status", "workout"]);
/** Columns holding a small number. */
const SHORT_COLUMNS = new Set<FamilyColumn>(["household", "plans"]);

/**
 * The families page while it loads: its head, toolbar, a table of empty
 * 64px rows under the 44px header (below 1024px: the view chips and cards),
 * drawn with the page's own classes so nothing moves when the list arrives.
 * Announced once as a status; the pulse stops under reduced motion.
 */
export function FamiliesSkeleton({ label }: { label: string }) {
  return (
    <div className="ad-a-split ad-fl">
      <SkeletonGroup label={label} className="ad-a-list ad-fl-skel">
        <div className="ad-a-head ad-desk-only">
          <div>
            <Skeleton shape="title" className="ad-fl-skel-h1" />
            <Skeleton shape="text" className="ad-fl-skel-sub" />
          </div>
        </div>

        <div className="ad-ph-top ad-phone-only">
          <div className="ad-ph-bar">
            <Skeleton shape="title" className="ad-fl-skel-h1" />
          </div>
          <div className="ad-ph-chips">
            {CHIPS.map((i) => (
              <Skeleton key={i} shape="pill" className="ad-fl-skel-chip" />
            ))}
          </div>
        </div>

        <div className="ad-a-tools">
          <Skeleton shape="btn" className="ad-fl-skel-search" />
          <Skeleton shape="btn" className="ad-fl-skel-select" />
          <Skeleton shape="btn" className="ad-fl-skel-select" />
          <Skeleton shape="btn" className="ad-fl-skel-cols ad-desk-only" />
        </div>

        <div className="ad-a-tablewrap ad-desk-only">
          <table className="ad-a-table" aria-hidden="true">
            <thead>
              <tr>
                <th className="ad-c-fam" data-col="family">
                  <Skeleton shape="text" className="ad-fl-skel-th" />
                </th>
                {FAMILY_COLUMNS.map((column) => (
                  <th key={column} data-col={column} className={column === "cost" ? "ad-end" : undefined}>
                    <Skeleton shape="text" className="ad-fl-skel-th" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row}>
                  <td className="ad-c-fam">
                    <div className="ad-fam-cell">
                      <Skeleton className="ad-fl-skel-row-name" />
                      <Skeleton shape="text" className="ad-fl-skel-row-email" />
                    </div>
                  </td>
                  {FAMILY_COLUMNS.map((column) => (
                    <td key={column}>
                      {PILL_COLUMNS.has(column) ? (
                        <Skeleton shape="pill" />
                      ) : (
                        <Skeleton
                          shape="text"
                          className={SHORT_COLUMNS.has(column) ? "ad-fl-skel-short" : "ad-fl-skel-cell"}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ad-pcards ad-phone-only">
          {CARDS.map((card) => (
            <div key={card} className="ad-pcard">
              <Skeleton className="ad-fl-skel-row-name" />
              <span className="ad-r2">
                <Skeleton shape="pill" />
                <Skeleton shape="pill" />
              </span>
              <Skeleton shape="text" className="ad-fl-skel-card-line" />
            </div>
          ))}
        </div>
      </SkeletonGroup>
    </div>
  );
}
