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
  parseFamilyListQuery,
  sortFamilies,
  type FamilyPanelState,
} from "@/lib/admin/familyList";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { statusLabel, t, type AdminStringKey } from "@/lib/admin/i18n";
import { fill, planStateLabel } from "../_blocks/helpers";

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

/** The panel's tab names («ملخص», «الخطة الغذائية», …). */
export const PANEL_TAB_LABEL: Readonly<Partial<Record<FamilyTab, AdminStringKey>>> = {
  summary: "fl_tab_summary",
  meal: "fl_meal_plan",
  exercise: "fl_exercise_plan",
  household: "section_household",
  billing: "section_subscription",
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

/** The head line: «١٠ عائلات · ٦ مدفوعة · ٣ تجريبية». */
export function countsLine(
  counts: { families: number; paying: number; trialing: number },
  locale: AdminLocale,
): string {
  return [
    countFamilies(counts.families, locale),
    fill(t("fl_n_paying", locale), { n: fmtNumber(counts.paying, locale) }),
    fill(t("fl_n_trial", locale), { n: fmtNumber(counts.trialing, locale) }),
  ].join(" · ");
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
 * A phone card's meal line: days ready («٦/٧») when known — while generating
 * with the state in front («قيد الإنشاء · ٤/٧») — else the state alone;
 * «لا يوجد» without a plan. Never a guessed day count.
 */
export function mealCardText(cell: MealPlanCell, locale: AdminLocale): string {
  if (cell.state === "none") return t("fm_state_none", locale);
  if (cell.state === "failed") return planStateLabel("failed", locale);
  const days =
    cell.daysReady != null
      ? `${fmtNumber(cell.daysReady, locale)}/${fmtNumber(cell.daysTotal, locale)}`
      : null;
  if (cell.state === "generating") {
    return days ? `${planStateLabel("generating", locale)} · ${days}` : planStateLabel("generating", locale);
  }
  return days ?? planStateLabel("ready", locale);
}

/** A phone card's exercise line: the program's state, or «لا يوجد». */
export function workoutCardText(cell: WorkoutPlanCell, locale: AdminLocale): string {
  return planStateLabel(cell.state, locale);
}
