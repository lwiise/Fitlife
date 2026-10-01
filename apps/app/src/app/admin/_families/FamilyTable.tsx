import {
  memo,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import type { FamilyColumn, FamilyRow, FamilySortKey } from "@/lib/admin/console-types";
import { renewalDateAt } from "@/lib/admin/familyFlags";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { Flag, Ltr, StatusPill, TierBadge, joinSep } from "../_ui";
import { HouseholdCell, MealPlanPill, WorkoutPlanPill, cancelMarkNode } from "../_blocks";
import { COLUMN_LABEL, COLUMN_SORT, familyPageHref, type TableColumn } from "./listModel";
import type { FamilyRowText } from "./types";

/**
 * The families table (the prototype's `aTable`): a sticky 44px header of
 * sort buttons, 64px rows, the family column pinned at the inline start.
 *
 * Rows carry no handlers and no hooks — the console hands ONE delegated set
 * of handlers to <tbody> (click, keys, focus, hover) and finds the row by its
 * `data-id`. Each row is memoised on its data, so moving focus or opening a
 * family re-renders the two rows that changed, not the page.
 *
 * The family name is a real link to the full page (middle click / ⌘-click
 * open it in a new tab); a plain click on a wide screen is taken over by the
 * console to open the side panel instead. The links sit out of the tab
 * order: rows are the keyboard stops (one at a time — a roving tabindex),
 * ↑/↓ move between them and Enter opens the full page. While that page is
 * on its way the row reports aria-busy and its start edge pulses.
 */

const NO_TEXT: FamilyRowText = { cost: null, signup: "—", last: null, lastDay: null, renewal: "—" };

export interface FamilyTableProps {
  /** Accessible name — the saved view's name. */
  label: string;
  /** The current page only. */
  rows: readonly FamilyRow[];
  texts: Readonly<Record<string, FamilyRowText>>;
  columns: readonly FamilyColumn[];
  sort: FamilySortKey;
  dir: "asc" | "desc";
  /** The family open in the side panel (its row reads selected). */
  openId: string | null;
  /** The one row in the tab order. */
  rovingId: string | null;
  /** The row whose full page is on its way (aria-busy + a pulsing edge). */
  pendingId: string | null;
  locale: AdminLocale;
  wrapRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLTableSectionElement | null>;
  onSort: (key: FamilySortKey) => void;
  onBodyClick: (event: MouseEvent<HTMLTableSectionElement>) => void;
  onBodyKeyDown: (event: KeyboardEvent<HTMLTableSectionElement>) => void;
  onBodyFocus: (event: FocusEvent<HTMLTableSectionElement>) => void;
  onBodyPointerOver: (event: PointerEvent<HTMLTableSectionElement>) => void;
  onBodyPointerLeave: () => void;
  /** Shown under the header when there are no rows. */
  empty: ReactNode;
}

export function FamilyTable({
  label,
  rows,
  texts,
  columns,
  sort,
  dir,
  openId,
  rovingId,
  pendingId,
  locale,
  wrapRef,
  bodyRef,
  onSort,
  onBodyClick,
  onBodyKeyDown,
  onBodyFocus,
  onBodyPointerOver,
  onBodyPointerLeave,
  empty,
}: FamilyTableProps) {
  return (
    <div ref={wrapRef} className="ad-a-tablewrap ad-desk-only">
      <table className="ad-a-table" aria-label={label}>
        <thead>
          <tr>
            <HeaderCell column="family" sort={sort} dir={dir} locale={locale} onSort={onSort} />
            {columns.map((column) => (
              <HeaderCell
                key={column}
                column={column}
                sort={sort}
                dir={dir}
                locale={locale}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody
          ref={bodyRef}
          onClick={onBodyClick}
          onKeyDown={onBodyKeyDown}
          onFocus={onBodyFocus}
          onPointerOver={onBodyPointerOver}
          onPointerLeave={onBodyPointerLeave}
        >
          {rows.map((row) => (
            <Row
              key={row.userId}
              row={row}
              text={texts[row.userId] ?? NO_TEXT}
              columns={columns}
              selected={row.userId === openId}
              tabbable={row.userId === rovingId}
              pending={row.userId === pendingId}
              locale={locale}
            />
          ))}
        </tbody>
      </table>
      {/* Outside the table on purpose: a block in the scroller is as wide as
          what shows, so the message stays centred however wide the table is. */}
      {rows.length === 0 ? empty : null}
    </div>
  );
}

function HeaderCell({
  column,
  sort,
  dir,
  locale,
  onSort,
}: {
  column: TableColumn;
  sort: FamilySortKey;
  dir: "asc" | "desc";
  locale: AdminLocale;
  onSort: (key: FamilySortKey) => void;
}) {
  const key = COLUMN_SORT[column];
  const text = t(COLUMN_LABEL[column], locale);
  const className = column === "family" ? "ad-c-fam" : column === "cost" ? "ad-end" : undefined;
  if (!key) {
    return (
      <th scope="col" className={className} data-col={column}>
        {text}
      </th>
    );
  }
  const active = key === sort;
  return (
    <th
      scope="col"
      className={className}
      data-col={column}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onSort(key)}>
        {text}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="ad-ic" aria-hidden="true" />
          ) : (
            <ChevronDown className="ad-ic" aria-hidden="true" />
          )
        ) : null}
      </button>
    </th>
  );
}

const Row = memo(function Row({
  row,
  text,
  columns,
  selected,
  tabbable,
  pending,
  locale,
}: {
  row: FamilyRow;
  text: FamilyRowText;
  columns: readonly FamilyColumn[];
  selected: boolean;
  tabbable: boolean;
  pending: boolean;
  locale: AdminLocale;
}) {
  const name = row.displayName?.trim() || null;
  const onboarding = t("fm_flag_onboarding", locale);
  return (
    <tr
      data-id={row.userId}
      tabIndex={tabbable ? 0 : -1}
      data-selected={selected ? "" : undefined}
      aria-current={selected ? "true" : undefined}
      aria-busy={pending || undefined}
    >
      <td className="ad-c-fam">
        {pending ? <span aria-hidden="true" className="ad-lp ad-on" /> : null}
        <div className="ad-fam-cell">
          <b>
            <a href={familyPageHref(row.userId)} className="ad-fl-name" tabIndex={-1}>
              {name ?? <span className="ad-muted">{t("sh_unnamed", locale)}</span>}
            </a>
            {row.onboardingComplete ? null : (
              <Flag tone="warn" icon={TriangleAlert} title={onboarding}>
                <span className="ad-sr">{onboarding}</span>
              </Flag>
            )}
          </b>
          <small>{row.email ? <Ltr>{row.email}</Ltr> : "—"}</small>
        </div>
      </td>
      {columns.map((column) => cell(column, row, text, locale))}
    </tr>
  );
});

/** One non-family cell (the prototype's `aCell`), with the old list's content. */
function cell(column: FamilyColumn, row: FamilyRow, text: FamilyRowText, locale: AdminLocale) {
  switch (column) {
    case "tier":
      return (
        <td key={column}>
          <TierBadge tier={row.tier} locale={locale} />
        </td>
      );
    case "status":
      return (
        <td key={column}>
          <StatusPill status={row.status} locale={locale} />
        </td>
      );
    case "meal":
      return (
        <td key={column}>
          <MealPlanPill cell={row.meal} locale={locale} />
        </td>
      );
    case "workout":
      return (
        <td key={column}>
          <WorkoutPlanPill cell={row.workout} locale={locale} />
        </td>
      );
    case "household":
      return (
        <td key={column}>
          <HouseholdCell
            beneficiaries={row.beneficiaries}
            hasHousekeeper={row.hasHousekeeper}
            overLimit={row.overLimit}
            locale={locale}
          />
        </td>
      );
    case "lastActivity":
      return (
        <td key={column} className="ad-muted">
          {row.lastActivityAt && text.last ? (
            <time dateTime={row.lastActivityAt} title={text.lastDay ?? undefined}>
              {text.last}
            </time>
          ) : (
            "—"
          )}
        </td>
      );
    case "cost":
      return (
        <td key={column} className="ad-end">
          {text.cost ? (
            <span className="ad-num">{text.cost}</span>
          ) : (
            <span className="ad-muted">—</span>
          )}
        </td>
      );
    case "renewal":
      return <td key={column}>{renewal(row, text, locale)}</td>;
    case "signup":
      return (
        <td key={column} className="ad-muted">
          <time dateTime={row.signupAt}>{text.signup}</time>
        </td>
      );
    case "plans":
      return (
        <td key={column}>
          {joinSep(
            <span className="ad-num">{fmtNumber(row.plansGenerated, locale)}</span>,
            row.failedPlans > 0 ? (
              <span className="ad-bad">
                {fmtNumber(row.failedPlans, locale)} {t("fl_failed", locale)}
              </span>
            ) : null,
          )}
        </td>
      );
  }
}

/**
 * The renewal cell — RenewalCell's rule (the trial end while trialing, else
 * the paid-through date: `renewalDateAt`; plus the cancellation mark behind a
 * separator — cancelMarkNode, the same function RenewalCell uses), printing
 * the server-formatted date.
 */
function renewal(row: FamilyRow, text: FamilyRowText, locale: AdminLocale) {
  if (!row.status) return "—";
  const iso = renewalDateAt(row);
  const date = iso ? <time dateTime={iso}>{text.renewal}</time> : "—";
  const cancelling = cancelMarkNode(row.status, row.cancelState, locale);
  if (row.status === "trialing") {
    return (
      <>
        {joinSep(
          <>
            <span className="ad-muted">{t("fm_trial_ends", locale)}</span> {date}
          </>,
          cancelling,
        )}
      </>
    );
  }
  return <>{joinSep(date, cancelling)}</>;
}
