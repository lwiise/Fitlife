/**
 * The families list's in-memory query engine: search, filter, sort, paginate,
 * saved-view counts, and the URL <-> query mapping. Pure and client-safe — the
 * browser runs all of it on the lean rows the server sent once, so typing in
 * the search box or flipping a sort never costs a server round-trip.
 *
 * Type-only imports, nothing else: this module ships in the client bundle.
 */

import type { SubscriptionStatus, Tier } from "@fitlife/config";
import {
  FAMILY_VIEWS,
  PANEL_TABS,
  type FamilyListQuery,
  type FamilyRow,
  type FamilySortKey,
  type FamilyTab,
  type FamilyView,
} from "./console-types";

export const FAMILY_PAGE_SIZE = 50;

export const FAMILY_SORT_KEYS: readonly FamilySortKey[] = [
  "displayName",
  "status",
  "beneficiaries",
  "lastActivityAt",
  "lifetimeAiCostUsd",
  "signupAt",
  "plansGenerated",
];

export const DEFAULT_FAMILY_LIST_QUERY: Readonly<FamilyListQuery> = {
  view: "all",
  q: "",
  tier: "",
  status: "",
  sort: "lastActivityAt",
  dir: "desc",
  page: 1,
};

/** Exhaustive by type: adding a tier or a status to @fitlife/config fails compilation here. */
const TIER_SET: Record<Tier, true> = { starter: true, pro: true, family: true, premium: true };
const STATUS_SET: Record<SubscriptionStatus, true> = {
  trialing: true,
  active: true,
  paused: true,
  past_due: true,
  cancelled: true,
  expired: true,
};

/** Longest search string accepted from a URL. */
const MAX_QUERY_LENGTH = 200;

// ── Search ──────────────────────────────────────────────────────────────────

const ARABIC_INDIC_ZERO = 0x0660;
const EXT_ARABIC_INDIC_ZERO = 0x06f0;

/** Arabic-Indic (٠-٩) and extended (۰-۹) digits → ASCII. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= EXT_ARABIC_INDIC_ZERO ? EXT_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - base);
  });
}

/**
 * Fold a string for matching: case, Latin accents, Arabic diacritics
 * (tashkeel, superscript alef, tatweel), the hamza-carrying alefs (أ إ آ ٱ → ا),
 * taa marbuta (ة → ه), alef maqsura (ى → ي), and Arabic-Indic digits.
 */
export function normalizeSearch(s: string): string {
  return toAsciiDigits(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // Latin combining marks
      .normalize("NFC")
      .replace(/[آأإٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[ً-ٰٟـ]/g, ""),
  )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does a row match the search? Every word of the query must appear in the
 * family's name or email («هند عتيبي» finds «هِنْد العتيبي»). Empty = match.
 */
export function matchesSearch(
  row: Pick<FamilyRow, "displayName" | "email">,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  const hay = normalizeSearch(`${row.displayName ?? ""} ${row.email ?? ""}`);
  return normalizedQuery.split(" ").every((word) => hay.includes(word));
}

// ── Views and filters ───────────────────────────────────────────────────────

/**
 * Is a row in a saved view? «cancelling» and «ended» read the row's
 * `cancelState` (subscriptionCancelState, judged with its flags when the
 * dataset was read): a subscription cancelled in the LemonSqueezy portal is
 * still «cancelling» while it is paid through, and only then «ended». A
 * trial that ran out is «ended», not «trialing»: nothing moves an internal
 * trial's status on, so the status alone would keep it a trial for good.
 */
export function familyInView(row: FamilyRow, view: FamilyView): boolean {
  switch (view) {
    case "all":
      return true;
    case "attention":
      return row.flags.length > 0;
    case "trialing":
      return row.status === "trialing" && row.cancelState !== "ended";
    case "active":
    case "past_due":
      return row.status === view;
    case "cancelling":
      return row.cancelState === "scheduled";
    case "ended":
      return row.cancelState === "ended";
  }
}

/** Row count per saved view (for the rail). */
export function viewCounts(rows: readonly FamilyRow[]): Record<FamilyView, number> {
  const counts = Object.fromEntries(FAMILY_VIEWS.map((v) => [v, 0])) as Record<FamilyView, number>;
  for (const row of rows) {
    for (const v of FAMILY_VIEWS) if (familyInView(row, v)) counts[v] += 1;
  }
  return counts;
}

/** View + search + tier + status. */
export function filterFamilies(
  rows: readonly FamilyRow[],
  query: Pick<FamilyListQuery, "view" | "q" | "tier" | "status">,
): FamilyRow[] {
  const q = normalizeSearch(query.q);
  return rows.filter(
    (r) =>
      familyInView(r, query.view) &&
      (!query.tier || r.tier === query.tier) &&
      (!query.status || r.status === query.status) &&
      matchesSearch(r, q),
  );
}

// ── Sort ────────────────────────────────────────────────────────────────────

const time = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Sort a copy. Names compare with the Arabic collation; dates with no value
 * go LAST in both directions (a family that never did anything is never the
 * "most recent"). Ties fall back to the user id so the order is stable across
 * renders.
 */
export function sortFamilies(
  rows: readonly FamilyRow[],
  sort: FamilySortKey,
  dir: "asc" | "desc",
): FamilyRow[] {
  const mult = dir === "asc" ? 1 : -1;
  const collator = new Intl.Collator("ar");
  const compare = (a: FamilyRow, b: FamilyRow): number => {
    switch (sort) {
      case "displayName":
        return mult * collator.compare(a.displayName ?? "", b.displayName ?? "");
      case "status":
        return mult * (a.status ?? "").localeCompare(b.status ?? "");
      case "beneficiaries":
        return mult * (a.beneficiaries - b.beneficiaries);
      case "plansGenerated":
        return mult * (a.plansGenerated - b.plansGenerated);
      case "lifetimeAiCostUsd":
        return mult * (a.lifetimeAiCostUsd - b.lifetimeAiCostUsd);
      case "lastActivityAt":
      case "signupAt": {
        const ta = time(sort === "signupAt" ? a.signupAt : a.lastActivityAt);
        const tb = time(sort === "signupAt" ? b.signupAt : b.lastActivityAt);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return mult * (ta - tb);
      }
    }
  };
  return [...rows].sort(
    (a, b) => compare(a, b) || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
}

// ── Paginate ────────────────────────────────────────────────────────────────

export interface FamilyPage {
  rows: FamilyRow[];
  total: number;
  /** Clamped into [1, pageCount]. */
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paginateFamilies(
  rows: readonly FamilyRow[],
  page: number,
  pageSize: number = FAMILY_PAGE_SIZE,
): FamilyPage {
  const size = Math.max(1, Math.floor(pageSize));
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (safePage - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    total,
    page: safePage,
    pageSize: size,
    pageCount,
  };
}

// ── URL <-> query ───────────────────────────────────────────────────────────

/** What the page receives as searchParams, or the browser's URLSearchParams. */
export type RawListParams = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: RawListParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

const isOneOf = <T extends string>(list: readonly T[], v: string | undefined): v is T =>
  v !== undefined && (list as readonly string[]).includes(v);

/** Parse + validate every list param; anything unknown falls back to the default. */
export function parseFamilyListQuery(params: RawListParams): FamilyListQuery {
  const view = read(params, "view");
  const sort = read(params, "sort");
  const dir = read(params, "dir");
  const tier = read(params, "tier");
  const status = read(params, "status");
  const pageRaw = toAsciiDigits(read(params, "page") ?? "").trim();
  const page = /^\d{1,6}$/.test(pageRaw) ? Math.max(1, Number(pageRaw)) : 1;
  return {
    view: isOneOf(FAMILY_VIEWS, view) ? view : DEFAULT_FAMILY_LIST_QUERY.view,
    q: (read(params, "q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    tier: tier && Object.hasOwn(TIER_SET, tier) ? tier : "",
    status: status && Object.hasOwn(STATUS_SET, status) ? status : "",
    sort: isOneOf(FAMILY_SORT_KEYS, sort) ? sort : DEFAULT_FAMILY_LIST_QUERY.sort,
    dir: dir === "asc" || dir === "desc" ? dir : DEFAULT_FAMILY_LIST_QUERY.dir,
    page,
  };
}

/** The side panel's URL state (`open` = a family id, `tab` = a panel tab). */
export interface FamilyPanelState {
  open: string | null;
  tab: FamilyTab;
}

export function parseFamilyPanelState(params: RawListParams): FamilyPanelState {
  const open = read(params, "open");
  const tab = read(params, "tab");
  return {
    open: open && isFamilyId(open) ? open.toLowerCase() : null,
    tab: isOneOf(PANEL_TABS, tab) ? tab : "summary",
  };
}

/**
 * The query (plus the panel state) as URL params, leaving defaults out so the
 * URL stays short. Round-trips through parseFamilyListQuery.
 */
export function familyListQueryToParams(
  query: FamilyListQuery,
  panel?: Partial<FamilyPanelState>,
): URLSearchParams {
  const p = new URLSearchParams();
  const d = DEFAULT_FAMILY_LIST_QUERY;
  if (query.view !== d.view) p.set("view", query.view);
  if (query.q.trim()) p.set("q", query.q.trim());
  if (query.tier) p.set("tier", query.tier);
  if (query.status) p.set("status", query.status);
  if (query.sort !== d.sort) p.set("sort", query.sort);
  if (query.dir !== d.dir) p.set("dir", query.dir);
  if (query.page > 1) p.set("page", String(Math.floor(query.page)));
  if (panel?.open) {
    p.set("open", panel.open);
    if (panel.tab && panel.tab !== "summary") p.set("tab", panel.tab);
  }
  return p;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A canonical UUID string (family ids, plan ids) — anything else is refused before any read. */
export function isUuid(s: string | null | undefined): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

/** A family id is the owner's auth.users UUID. */
export const isFamilyId = isUuid;
