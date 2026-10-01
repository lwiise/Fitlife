/**
 * The families console's list logic, pure and client-safe: sorting, the
 * search index, paging, row navigation, what goes into the URL and when, the
 * column preference, links, and the list's count texts. No React, no I/O, no
 * clock — the console and the tests call the same functions.
 *
 * Search, view and filter semantics are familyList.ts's (lib/admin — the ONE
 * definition, also used by the ⌘K palette); this module only avoids
 * re-normalising every row on every keystroke.
 */

import {
  FAMILY_COLUMNS,
  PANEL_TABS,
  type FamilyColumn,
  type FamilyListQuery,
  type FamilyRow,
  type FamilySortKey,
  type FamilyTab,
  type MealPlanCell,
  type WorkoutPlanCell,
} from "@/lib/admin/console-types";
import {
  FAMILY_PAGE_SIZE,
  familyInView,
  familyListQueryToParams,
  filterFamilies,
  normalizeSearch,
  paginateFamilies,
  parseFamilyListQuery,
  parseFamilyPanelState,
  sortFamilies,
  type FamilyPanelState,
} from "@/lib/admin/familyList";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { statusLabel, t, type AdminStringKey } from "@/lib/admin/i18n";
import { joinText } from "@/lib/admin/separators";
import { fill, planStateLabel } from "../_blocks/helpers";
import type { FamilyRowText } from "./types";

// ── Columns and sorting ─────────────────────────────────────────────────────

/** The always-shown family column plus the toggleable ones, in table order. */
export type TableColumn = "family" | FamilyColumn;

/** The sort key a column header sorts by; columns missing here do not sort. */
export const COLUMN_SORT: Readonly<Partial<Record<TableColumn, FamilySortKey>>> = {
  family: "displayName",
  status: "status",
  household: "beneficiaries",
  lastActivity: "lastActivityAt",
  cost: "lifetimeAiCostUsd",
  signup: "signupAt",
  plans: "plansGenerated",
};

/** Column header names. */
export const COLUMN_LABEL: Readonly<Record<TableColumn, AdminStringKey>> = {
  family: "fl_col_family",
  tier: "col_tier",
  status: "col_status",
  meal: "fl_meal_plan",
  workout: "fl_exercise_plan",
  household: "col_household",
  lastActivity: "col_activity",
  cost: "col_ai_cost",
  renewal: "col_renewal",
  signup: "col_signup",
  plans: "col_plans",
};

/**
 * The first direction of a newly chosen sort: names and statuses A→Z,
 * everything else largest / newest first (the old subscriber table's
 * defaults, and the prototype's).
 */
export function defaultSortDir(key: FamilySortKey): "asc" | "desc" {
  return key === "displayName" || key === "status" ? "asc" : "desc";
}

/** A header click: the active column flips direction, another starts at its default. */
export function nextSort(
  current: Pick<FamilyListQuery, "sort" | "dir">,
  key: FamilySortKey,
): Pick<FamilyListQuery, "sort" | "dir"> {
  if (current.sort === key) return { sort: key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { sort: key, dir: defaultSortDir(key) };
}

/** A sort with its direction: what one header click — or one option of the narrow sort select — sets. */
export type SortOrder = Pick<FamilyListQuery, "sort" | "dir">;

/** How each key reads in each direction: a date «الأحدث أولاً», an amount «الأعلى أولاً», a name «أ–ي». */
const ORDER_WORDS: Readonly<Record<FamilySortKey, Record<"asc" | "desc", AdminStringKey>>> = {
  displayName: { asc: "fl_order_az", desc: "fl_order_za" },
  status: { asc: "fl_order_asc", desc: "fl_order_desc" },
  beneficiaries: { desc: "fl_order_largest", asc: "fl_order_smallest" },
  lastActivityAt: { desc: "fl_order_newest", asc: "fl_order_oldest" },
  lifetimeAiCostUsd: { desc: "fl_order_highest", asc: "fl_order_lowest" },
  signupAt: { desc: "fl_order_newest", asc: "fl_order_oldest" },
  plansGenerated: { desc: "fl_order_most", asc: "fl_order_fewest" },
};

/**
 * Every order the table's headers can produce — each sortable column in the
 * table's order, its first direction (defaultSortDir) then the other. Below
 * 1024px there is no header row (the cards replace the table), so the
 * toolbar's sort select offers exactly these, and nothing a header click can
 * do is lost on a phone or a tablet in portrait.
 */
export const SORT_ORDERS: ReadonlyArray<SortOrder & { column: TableColumn }> = (
  Object.entries(COLUMN_SORT) as Array<[TableColumn, FamilySortKey]>
).flatMap(([column, sort]) => {
  const first = defaultSortDir(sort);
  return [
    { column, sort, dir: first },
    { column, sort, dir: first === "asc" ? "desc" : "asc" },
  ];
});

/** An order as a select value («lastActivityAt:desc»). */
export function sortOrderValue(order: SortOrder): string {
  return `${order.sort}:${order.dir}`;
}

/** A select value back to its order; null when it names none. */
export function parseSortOrder(value: string): SortOrder | null {
  const order = SORT_ORDERS.find((o) => sortOrderValue(o) === value);
  return order ? { sort: order.sort, dir: order.dir } : null;
}

/** An order's name: the column's header, then the direction («آخر نشاط: الأحدث أولاً»). */
export function sortOrderLabel(order: SortOrder & { column: TableColumn }, locale: AdminLocale): string {
  return fill(t("fl_order", locale), {
    col: t(COLUMN_LABEL[order.column], locale),
    dir: t(ORDER_WORDS[order.sort][order.dir], locale),
  });
}

// ── Search ──────────────────────────────────────────────────────────────────

/** Each family's normalised name + email, by user id (familyList's matching text). */
export type SearchIndex = ReadonlyMap<string, string>;

export function buildSearchIndex(rows: readonly FamilyRow[]): SearchIndex {
  const index = new Map<string, string>();
  for (const row of rows) {
    index.set(row.userId, normalizeSearch(`${row.displayName ?? ""} ${row.email ?? ""}`));
  }
  return index;
}

/**
 * `filterFamilies` (view + search + tier + status) over a prebuilt index, so
 * a keystroke normalises the query once instead of every row. Same rule:
 * every word of the query must occur in the name or the email.
 */
export function filterRows(
  rows: readonly FamilyRow[],
  index: SearchIndex,
  query: Pick<FamilyListQuery, "view" | "q" | "tier" | "status">,
): FamilyRow[] {
  const words = normalizeSearch(query.q).split(" ").filter(Boolean);
  return rows.filter((row) => {
    if (!familyInView(row, query.view)) return false;
    if (query.tier && row.tier !== query.tier) return false;
    if (query.status && row.status !== query.status) return false;
    if (words.length === 0) return true;
    const hay =
      index.get(row.userId) ?? normalizeSearch(`${row.displayName ?? ""} ${row.email ?? ""}`);
    return words.every((word) => hay.includes(word));
  });
}

/** The statuses the status filter always offers — the old list's, in its order. */
export const STATUS_FILTERS: readonly string[] = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
];

/** A status the URL accepts (familyList's validation — the one definition). */
export function isFilterableStatus(status: string): boolean {
  return parseFamilyListQuery({ status }).status === status;
}

/**
 * The status filter's values: the fixed ones, then any other valid status
 * that some family has (e.g. paused), then the current one if it is still
 * missing — so the select always shows what the list is filtered by.
 */
export function statusFilterValues(
  present: Iterable<string | null>,
  current: string,
): string[] {
  const out = [...STATUS_FILTERS];
  const extra = new Set<string>();
  for (const status of present) {
    if (status && !out.includes(status) && isFilterableStatus(status)) extra.add(status);
  }
  out.push(...[...extra].sort());
  if (current && !out.includes(current) && isFilterableStatus(current)) out.push(current);
  return out;
}

/** A status filter option's label. */
export function statusOptionLabel(status: string, locale: AdminLocale): string {
  return status === "paused" ? t("fl_status_paused", locale) : statusLabel(status, locale);
}

/** Any narrowing besides the view (the "clear filters" button's condition). */
export function hasFilters(query: Pick<FamilyListQuery, "q" | "tier" | "status">): boolean {
  return query.q.trim() !== "" || query.tier !== "" || query.status !== "";
}

// ── Paging and rows ─────────────────────────────────────────────────────────

/** The 1-based positions a page shows («١–٥٠»); 0–0 for an empty list. */
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  return { from: (page - 1) * pageSize + 1, to: Math.min(total, page * pageSize) };
}

/** The page a family sits on in a sorted list, or null when it is not in it. */
export function pageOf(ids: readonly string[], id: string, pageSize: number): number | null {
  const i = ids.indexOf(id);
  return i < 0 ? null : Math.floor(i / pageSize) + 1;
}

/**
 * The query turned to the page the open family sits on, so its row shows
 * selected; unchanged when the family is not in the (filtered) list.
 */
export function revealOpenFamily(
  rows: readonly FamilyRow[],
  query: FamilyListQuery,
  openId: string,
  pageSize: number = FAMILY_PAGE_SIZE,
): FamilyListQuery {
  const ids = sortFamilies(filterFamilies(rows, query), query.sort, query.dir).map((row) => row.userId);
  const page = pageOf(ids, openId, pageSize);
  return page !== null && page !== query.page ? { ...query, page } : query;
}

/**
 * The query the console starts from for a URL's query and open family: on
 * the page the open family sits on, so its row shows selected (a shared
 * link, ⌘K from another page).
 */
export function startingQuery(
  rows: readonly FamilyRow[],
  query: FamilyListQuery,
  openId: string | null,
): FamilyListQuery {
  return openId ? revealOpenFamily(rows, query, openId) : query;
}

/**
 * The rows a query shows — the page of the filtered, sorted list. For the
 * starting query these are the rows the server renders and the browser then
 * hydrates: the only ones whose display strings the server page formats.
 */
export function pageRows(rows: readonly FamilyRow[], query: FamilyListQuery): FamilyRow[] {
  return paginateFamilies(sortFamilies(filterFamilies(rows, query), query.sort, query.dir), query.page)
    .rows;
}

export type RowStep = "next" | "prev" | "first" | "last";

/**
 * The row a key moves to within the page's ids. From an id that is not on
 * the page, next/prev land on the first/last row; at either end there is
 * nowhere to go (null) — the list does not wrap.
 */
export function stepRow(ids: readonly string[], from: string | null, step: RowStep): string | null {
  if (ids.length === 0) return null;
  if (step === "first") return ids[0] ?? null;
  if (step === "last") return ids[ids.length - 1] ?? null;
  const i = from ? ids.indexOf(from) : -1;
  if (i < 0) return (step === "next" ? ids[0] : ids[ids.length - 1]) ?? null;
  return ids[step === "next" ? i + 1 : i - 1] ?? null;
}

/** What a key does on a focused row — or on its name link, which is the same row. */
export type RowKeyCommand =
  | { kind: "step"; step: RowStep }
  /** Enter: the family's full page (a link's own Enter would open the panel). */
  | { kind: "page" }
  /** Space: the side panel (below 1024px, the full page). */
  | { kind: "panel" }
  /** Esc: close the panel. */
  | { kind: "close" };

/**
 * The table's keys. Any modifier leaves the key to the browser (⌘/Ctrl+Enter
 * on the name link opens it in a new tab, Shift+Enter in a new window).
 */
export function rowKeyCommand(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): RowKeyCommand | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  switch (event.key) {
    case "ArrowDown":
      return { kind: "step", step: "next" };
    case "ArrowUp":
      return { kind: "step", step: "prev" };
    case "Home":
      return { kind: "step", step: "first" };
    case "End":
      return { kind: "step", step: "last" };
    case "Enter":
      return { kind: "page" };
    case " ":
      return { kind: "panel" };
    case "Escape":
      return { kind: "close" };
    default:
      return null;
  }
}

/** The head's figures over the filtered set: families, paying (active), in trial. */
export function listCounts(rows: readonly FamilyRow[]): {
  families: number;
  paying: number;
  trialing: number;
} {
  let paying = 0;
  let trialing = 0;
  for (const row of rows) {
    if (row.status === "active") paying += 1;
    else if (row.status === "trialing") trialing += 1;
  }
  return { families: rows.length, paying, trialing };
}

// ── The URL ─────────────────────────────────────────────────────────────────

/** The list + panel state as its canonical query string (defaults left out). */
export function listSearch(query: FamilyListQuery, panel: FamilyPanelState): string {
  return familyListQueryToParams(query, panel).toString();
}

/** A URL from outside, as the state the console takes on. */
export interface AdoptedUrl {
  query: FamilyListQuery;
  panel: FamilyPanelState;
  /**
   * The URL names another open family, or none: the panel must start clean,
   * as closing or opening one leaves it. What it showed, or was loading,
   * belongs to the family it leaves — and a load still on its way for that
   * family is dropped when it lands, so a panel left waiting for it would
   * wait forever if the URL came back to that family.
   */
  resetSheet: boolean;
}

/**
 * The state to adopt when the URL changed under the console (back/forward, a
 * link, a redirect): null when the screen already shows what `search` says.
 * `shown` is what the screen shows now — its canonical search and the open
 * family.
 */
export function adoptUrl(
  search: string,
  shown: { search: string; open: string | null },
): AdoptedUrl | null {
  const params = new URLSearchParams(search);
  const query = parseFamilyListQuery(params);
  const panel = parseFamilyPanelState(params);
  if (listSearch(query, panel) === shown.search) return null;
  return { query, panel, resetSheet: panel.open !== shown.open };
}

/** How long typing waits before the URL catches up. */
export const TYPING_WRITE_DELAY_MS = 300;

/**
 * When to write `next` to the URL, given what it holds now: null when there
 * is nothing to write; after TYPING_WRITE_DELAY_MS when only the search text
 * changed, so a burst of keystrokes costs one history update (browsers
 * throttle replaceState — Safari throws past 100 calls in 30 seconds); at
 * once for anything else, so the rail follows a view switch immediately.
 */
export function urlWriteDelay(current: string | null, next: string): number | null {
  if (current === next) return null;
  if (current === null) return 0;
  const a = new URLSearchParams(current);
  const b = new URLSearchParams(next);
  a.delete("q");
  b.delete("q");
  return a.toString() === b.toString() ? TYPING_WRITE_DELAY_MS : 0;
}

/** A click as the window sees it once every handler has run. */
export interface LinkClick {
  /** preventDefault() was called — by Next's <Link> when it navigates. */
  defaultPrevented: boolean;
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  /** The closest a[href]: its resolved URL, target and download attribute; null without one. */
  link: { href: string; target: string; download: boolean } | null;
}

/**
 * Did this click start a client-side navigation to another page? Next's
 * <Link> takes a plain primary click on an in-app link: it calls
 * preventDefault() and starts the navigation before the click reaches the
 * window. So a click that ends prevented, unmodified, on a same-tab link to
 * another path of this origin is one — a rail or top-bar link, the panel's
 * footer, its plan history, the health dialog's «متابعة». A link to the
 * list's own path is not: the rail's views are handled in-page (or, while
 * the page is leaving, come back as a URL the console adopts). Clicks the
 * console handles itself (the table's and the cards') are told apart by
 * the caller.
 */
export function startsNavigationAway(
  click: LinkClick,
  here: { origin: string; pathname: string },
): boolean {
  const { link } = click;
  if (!link || !click.defaultPrevented || click.button !== 0) return false;
  if (click.altKey || click.ctrlKey || click.metaKey || click.shiftKey) return false;
  if ((link.target && link.target !== "_self") || link.download) return false;
  let url: URL;
  try {
    url = new URL(link.href, here.origin);
  } catch {
    return false;
  }
  return url.origin === here.origin && url.pathname !== here.pathname;
}

/** An in-app path the console may navigate to (`/…`, never `//host` or a scheme). */
export function isAppPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
}

// ── Column preference ───────────────────────────────────────────────────────

/** localStorage key of the operator's hidden columns (per browser). */
export const COLUMNS_STORAGE_KEY = "admin.families.columns";

/**
 * The stored hidden columns. Anything unreadable — no value, bad JSON, the
 * wrong shape, unknown columns — falls back to showing everything. Stored as
 * the HIDDEN set so a column added later shows up by default.
 */
export function parseHiddenColumns(raw: string | null | undefined): FamilyColumn[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const hidden = (parsed as { hidden?: unknown }).hidden;
  if (!Array.isArray(hidden)) return [];
  return FAMILY_COLUMNS.filter((column) => hidden.includes(column));
}

export function serializeHiddenColumns(hidden: readonly FamilyColumn[]): string {
  return JSON.stringify({ hidden: FAMILY_COLUMNS.filter((column) => hidden.includes(column)) });
}

/** Show a hidden column, or hide a shown one (table order kept). */
export function toggleHidden(hidden: readonly FamilyColumn[], column: FamilyColumn): FamilyColumn[] {
  return hidden.includes(column)
    ? hidden.filter((c) => c !== column)
    : FAMILY_COLUMNS.filter((c) => c === column || hidden.includes(c));
}

export function visibleColumns(hidden: readonly FamilyColumn[]): FamilyColumn[] {
  return FAMILY_COLUMNS.filter((column) => !hidden.includes(column));
}

// ── Links ───────────────────────────────────────────────────────────────────

/** A family's full page, opened on a tab (the summary is its default). */
export function familyPageHref(id: string, tab?: FamilyTab | null): string {
  const base = `/admin/subscribers/${encodeURIComponent(id)}`;
  return tab && tab !== "summary" ? `${base}?tab=${tab}` : base;
}

export function isPanelTab(tab: string): tab is FamilyTab {
  return (PANEL_TABS as readonly string[]).includes(tab);
}

/**
 * The panel's tab names («ملخص», «الخطة الغذائية», …). Billing is the full
 * page's own tab name (fp_tab_billing: «الاشتراك» / «Billing»), so a section
 * is called the same in the panel and on the page — and the English row of
 * five tabs fits the 440px panel (the prototype's «Billing»).
 */
export const PANEL_TAB_LABEL: Readonly<Partial<Record<FamilyTab, AdminStringKey>>> = {
  summary: "fl_tab_summary",
  meal: "fl_meal_plan",
  exercise: "fl_exercise_plan",
  household: "section_household",
  billing: "fp_tab_billing",
};

export function panelTabLabel(tab: FamilyTab, locale: AdminLocale): string {
  const key = PANEL_TAB_LABEL[tab];
  return key ? t(key, locale) : tab;
}

// ── Texts ───────────────────────────────────────────────────────────────────

const PLURAL: Record<AdminLocale, Intl.PluralRules> = {
  ar: new Intl.PluralRules("ar"),
  en: new Intl.PluralRules("en"),
};

const FAMILY_COUNT_KEY: Record<Intl.LDMLPluralRule, AdminStringKey> = {
  zero: "fl_n_families_zero",
  one: "fl_n_families_one",
  two: "fl_n_families_two",
  few: "fl_n_families_few",
  many: "fl_n_families_many",
  other: "fl_n_families_other",
};

/** «١٠ عائلات» / «عائلتان» / «10 families», with Arabic number agreement. */
export function countFamilies(n: number, locale: AdminLocale): string {
  const key = FAMILY_COUNT_KEY[PLURAL[locale].select(n)] ?? FAMILY_COUNT_KEY.other;
  return fill(t(key, locale), { n: fmtNumber(n, locale) });
}

/**
 * The head line's parts: «١٠ عائلات», «٦ مدفوعة», «٣ تجريبية». The page
 * draws a separator between them (never «·», which beside an Arabic-Indic
 * digit reads as «٠»).
 */
export function countsParts(
  counts: { families: number; paying: number; trialing: number },
  locale: AdminLocale,
): string[] {
  return [
    countFamilies(counts.families, locale),
    fill(t("fl_n_paying", locale), { n: fmtNumber(counts.paying, locale) }),
    fill(t("fl_n_trial", locale), { n: fmtNumber(counts.trialing, locale) }),
  ];
}

/** The head line as one text, for the live region: «١٠ عائلات، ٦ مدفوعة، ٣ تجريبية». */
export function countsLine(
  counts: { families: number; paying: number; trialing: number },
  locale: AdminLocale,
): string {
  return joinText(countsParts(counts, locale), locale);
}

/** The footer's range: «١–٥٠ من ١٢٠». */
export function rangeText(
  range: { from: number; to: number },
  total: number,
  locale: AdminLocale,
): string {
  return fill(t("fl_range", locale), {
    from: fmtNumber(range.from, locale),
    to: fmtNumber(range.to, locale),
    total: fmtNumber(total, locale),
  });
}

/**
 * A phone card's corner value. The prototype's card shows the last activity
 * there; when the list is sorted by something the card does not otherwise
 * show — the signup date, the AI cost, the plans generated — the corner shows
 * that instead, named, so an order picked in the sort select can be read off
 * the cards. (Status, household and name are on the card already.)
 */
export function cardCorner(
  sort: FamilySortKey,
  row: Pick<FamilyRow, "plansGenerated">,
  text: Pick<FamilyRowText, "signup" | "cost" | "last"> | null | undefined,
  locale: AdminLocale,
): string {
  switch (sort) {
    case "signupAt":
      return `${t("col_signup", locale)} ${text?.signup ?? "—"}`;
    case "lifetimeAiCostUsd":
      return `${t("col_ai_cost", locale)} ${text?.cost ?? "—"}`;
    case "plansGenerated":
      return `${t("col_plans", locale)} ${fmtNumber(row.plansGenerated, locale)}`;
    default:
      return text?.last ?? "—";
  }
}

/**
 * A phone card's meal line, as the state's words and the days ready: the days
 * alone («٦/٧») when ready and known; the state in front of them while
 * generating («قيد الإنشاء» + «٤/٧» — the card sets the days apart as a count,
 * never behind a separator); else the state alone, «لا يوجد» without a plan.
 * Never a guessed day count.
 */
export function mealCardParts(
  cell: MealPlanCell,
  locale: AdminLocale,
): { state: string | null; days: string | null } {
  if (cell.state === "none") return { state: t("fm_state_none", locale), days: null };
  if (cell.state === "failed") return { state: planStateLabel("failed", locale), days: null };
  const days =
    cell.daysReady != null
      ? `${fmtNumber(cell.daysReady, locale)}/${fmtNumber(cell.daysTotal, locale)}`
      : null;
  if (cell.state === "generating") return { state: planStateLabel("generating", locale), days };
  return days ? { state: null, days } : { state: planStateLabel("ready", locale), days: null };
}

/** A phone card's exercise line: the program's state, or «لا يوجد». */
export function workoutCardText(cell: WorkoutPlanCell, locale: AdminLocale): string {
  return planStateLabel(cell.state, locale);
}
