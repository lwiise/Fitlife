import type { ReactNode } from "react";

/**
 * Responsive data table for the admin drill-downs. On md+ it renders a real
 * <table> (frozen first column, horizontal scroll only as a last resort); below
 * md each row collapses into a stacked label/value card so narrow screens never
 * force a horizontal scroll. One source of truth per table — the column list
 * drives both layouts.
 *
 * The flags below shape the MOBILE card only (desktop always shows every column):
 *  - primary: rendered as the card's lead/title row, no label
 *  - block:   label sits above a full-width value (use for chips / rich content)
 *  - full:    no label, rendered in a full-width footer row (actions / overflow)
 *  - hide:    drop this field from the card on rows where it's empty/irrelevant
 */
export type DataColumn<T> = {
  key: string;
  /** Column header; also the field label in the mobile card. */
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-align on desktop (numeric columns). */
  align?: "end";
  primary?: boolean;
  block?: boolean;
  full?: boolean;
  hide?: (row: T) => boolean;
};

const TH =
  "whitespace-nowrap px-4 py-3 text-start adm-label uppercase text-brand-ink/70";
const TD = "whitespace-nowrap px-4 py-3 adm-body text-brand-ink";
// Frozen first column for the rare horizontal scroll on md/lg. No zebra in these
// tables, so an opaque surface-elevated bg occludes content scrolling beneath.
const STICKY_HEAD = "sticky start-0 z-20 bg-surface-elevated";
const STICKY_CELL = "sticky start-0 z-10 bg-surface-elevated";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  minWidthClass,
  empty,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  minWidthClass: string;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-14 text-center adm-body text-brand-ink-muted">
        {empty}
      </p>
    );
  }

  const title = columns.find((c) => c.primary);
  const fields = columns.filter(
    (c) => !c.primary && !c.full && c.header !== "",
  );
  const footers = columns.filter(
    (c) => c.full || (!c.primary && c.header === ""),
  );

  return (
    <>
      {/* Desktop: real table */}
      <div className="hidden overflow-x-auto md:block">
        <table className={`w-full ${minWidthClass} border-collapse`}>
          <thead className="border-b border-brand-ink/10">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`${TH} ${i === 0 ? STICKY_HEAD : ""} ${
                    c.align === "end" ? "text-end" : ""
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={rowKey(row, ri)}
                className="border-t border-brand-ink/10"
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={`${TD} ${i === 0 ? STICKY_CELL : ""} ${
                      c.align === "end" ? "text-end" : ""
                    }`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one stacked card per row */}
      <ul className="divide-y divide-brand-ink/10 md:hidden">
        {rows.map((row, ri) => (
          <li key={rowKey(row, ri)} className="px-4 py-4">
            {title ? (
              <div className="mb-2.5 adm-body font-bold text-brand-ink">
                {title.cell(row)}
              </div>
            ) : null}
            <dl className="space-y-2">
              {fields
                .filter((c) => !c.hide?.(row))
                .map((c) =>
                  c.block ? (
                    <div key={c.key} className="space-y-1">
                      <dt className="adm-label text-brand-ink/60">
                        {c.header}
                      </dt>
                      <dd className="adm-body text-brand-ink">{c.cell(row)}</dd>
                    </div>
                  ) : (
                    <div
                      key={c.key}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <dt className="adm-label shrink-0 text-brand-ink/60">
                        {c.header}
                      </dt>
                      <dd className="adm-body min-w-0 text-end text-brand-ink">
                        {c.cell(row)}
                      </dd>
                    </div>
                  ),
                )}
            </dl>
            {footers.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-brand-ink/5 pt-3">
                {footers
                  .filter((c) => !c.hide?.(row))
                  .map((c) => (
                    <div key={c.key}>{c.cell(row)}</div>
                  ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
