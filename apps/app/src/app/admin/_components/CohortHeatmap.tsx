import type { AdminLocale } from "@/lib/admin/format";
import { fmtNumber, fmtPctInt } from "@/lib/admin/format";

/**
 * Cohort retention heatmap rendered as a real (semantic + accessible) table —
 * rows are signup-month cohorts, columns are months-since-signup, cells are the
 * % currently active. Color-graded by brand purple opacity. Forced dir="ltr" so
 * "months since signup" always reads left→right; row labels localize. `null`
 * cells (future, not yet observable) render blank.
 *
 * HONESTY: with no status-history table this is a current-snapshot triangle,
 * not historical decay — the caller surfaces that note. Cells are computed
 * opacity → inline style is the one place a runtime value can't be a class.
 */
export interface CohortHeatmapRow {
  label: string;
  size: number;
  cells: Array<number | null>;
}

export function CohortHeatmap({
  rows,
  colLabels,
  ariaLabel,
  cohortHeader,
  sizeHeader,
  locale,
}: {
  rows: CohortHeatmapRow[];
  colLabels: string[];
  ariaLabel: string;
  cohortHeader: string;
  sizeHeader: string;
  locale: AdminLocale;
}) {
  return (
    <div dir="ltr" className="overflow-x-auto">
      <table className="w-full border-collapse text-center text-xs">
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1.5 text-start font-semibold text-brand-ink-muted">
              {cohortHeader}
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold text-brand-ink-muted">
              {sizeHeader}
            </th>
            {colLabels.map((c, i) => (
              <th key={i} scope="col" className="px-2 py-1.5 font-semibold tabular-nums text-brand-ink-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-start font-medium text-brand-ink">
                {row.label}
              </th>
              <td className="px-2 py-1.5 tabular-nums text-brand-ink-muted">
                {fmtNumber(row.size, locale)}
              </td>
              {row.cells.map((cell, j) => {
                if (cell == null) {
                  return <td key={j} className="px-1 py-1.5" aria-hidden="true" />;
                }
                // Cap alpha at 0.45 so cells never get dark enough to hurt
                // dark-text contrast — brand-purple-900 (#4E2490) over white
                // stays a light→medium lavender, and ink text always passes AA.
                const alpha = 0.08 + (cell / 100) * 0.37;
                return (
                  <td key={j} className="p-0.5">
                    <span
                      className="block rounded px-1 py-1.5 tabular-nums text-brand-ink"
                      style={{ backgroundColor: `rgb(78 36 144 / ${alpha})` }}
                    >
                      {fmtPctInt(cell, locale)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
