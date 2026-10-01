"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  FAMILY_VIEWS,
  type FamilyColumn,
  type FamilyListQuery,
  type FamilySortKey,
  type FamilyTab,
  type FamilyView,
} from "@/lib/admin/console-types";
import {
  FAMILY_PAGE_SIZE,
  isFamilyId,
  paginateFamilies,
  parseFamilyListQuery,
  parseFamilyPanelState,
  sortFamilies,
  viewCounts,
  type FamilyPanelState,
} from "@/lib/admin/familyList";
import { fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { Btn, Count, Empty, IconBtn, Kbd, Ltr, Note, joinSep } from "../_ui";
import {
  FAMILIES_VIEW_EVENT,
  FAMILY_OPEN_EVENT,
  NAVIGATE_EVENT,
  type FamiliesViewDetail,
  type FamilyOpenDetail,
  type NavigateDetail,
} from "../_shell/events";
import { VIEW_LABEL_KEY, WIDE_QUERY } from "../_shell/views";
import { ColumnsMenu } from "./ColumnsMenu";
import {
  getHiddenColumns,
  getServerHiddenColumns,
  setHiddenColumns,
  subscribeHiddenColumns,
} from "./columnsStore";
import { FamilyCards } from "./FamilyCards";
import { FamilySheet, type SheetActions, type SheetView } from "./FamilySheet";
import { FamilyTable } from "./FamilyTable";
import {
  adoptUrl,
  buildSearchIndex,
  countsLine,
  countsParts,
  familyPageHref,
  filterRows,
  hasFilters,
  isAppPath,
  listCounts,
  listSearch,
  nextSort,
  pageOf,
  pageRange,
  parseSortOrder,
  rangeText,
  rowKeyCommand,
  SORT_ORDERS,
  sortOrderLabel,
  sortOrderValue,
  startingQuery,
  startsNavigationAway,
  statusOptionLabel,
  stepRow,
  toggleHidden,
  visibleColumns,
  type LinkClick,
  type RowStep,
  type SortOrder,
} from "./listModel";
import { PanelLoader } from "./panelLoader";
import { unpackFamilyRows, type PackedFamilyRow } from "./rowCodec";
import { rowTextFormatter, textsFor } from "./rowText";
import type { FamilyRowText, SelectOption } from "./types";
import { UrlSync } from "./urlSync";

/** A row hovered this long is fetched ahead of a click. */
const HOVER_PREFETCH_MS = 150;
/** A row keeping focus this long is fetched ahead (key repeat never waits this long). */
const FOCUS_PREFETCH_MS = 100;
/** ↑/↓ open the row they land on after this pause, not on every step. */
const ARROW_OPEN_MS = 150;

/** The panel with nothing on it: closed, or about to load the family the URL names. */
const NO_SHEET: SheetView = { id: null, entry: null, busy: false };

// ── Media and preference stores (browser-only snapshots) ────────────────────

function subscribeWide(listener: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const isWideNow = () => window.matchMedia(WIDE_QUERY).matches;
/** The server cannot know; nothing rendered depends on it, only effects. */
const isWideOnServer = () => false;

function toggleColumn(column: FamilyColumn): void {
  setHiddenColumns(toggleHidden(getHiddenColumns(), column));
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** A finished click's button, keys and prevention, for startsNavigationAway. */
function clickKeys(event: globalThis.MouseEvent): Omit<LinkClick, "link"> {
  const { defaultPrevented, button, altKey, ctrlKey, metaKey, shiftKey } = event;
  return { defaultPrevented, button, altKey, ctrlKey, metaKey, shiftKey };
}

type FocusRequest = { to: "panel" } | { to: "search" } | { to: "row"; id: string | null };

interface Timers {
  hover: number | undefined;
  focus: number | undefined;
  arrow: number | undefined;
}

interface Actions {
  openFamily: (id: string, how: OpenHow) => void;
  closePanel: (restoreFocus: boolean) => void;
  selectTab: (tab: FamilyTab) => void;
  retry: () => void;
  stepFrom: (from: string | null, step: RowStep) => void;
}

interface OpenHow {
  /** "panel": focus moves to the panel heading; "keep": it stays where it is. */
  focus: "panel" | "keep";
  /** Open on this tab (default: the tab the panel was last on). */
  tab?: FamilyTab;
  /** Turn to the page the family is on, when it is in the list. */
  reveal?: boolean;
}

/** On the way to a family's page: the URL writer's hold, and the row or card it left from. */
interface Leaving {
  token: number;
  id: string | null;
}

export interface FamiliesConsoleProps {
  /** Every family, lean, packed for the wire (rowCodec.ts); the console slices, filters and sorts them. */
  rows: PackedFamilyRow[];
  /** Server-formatted display strings, by family id: the rows the first render shows. */
  texts: Record<string, FamilyRowText>;
  /** The server's "now" for those strings — the console formats every other row from it too. */
  nowIso: string;
  /** The server's parse of the request URL: the fallback — the live URL seeds the state. */
  initialQuery: FamilyListQuery;
  initialPanel: FamilyPanelState;
  locale: AdminLocale;
  currency: Currency;
  tierOptions: SelectOption[];
  statusOptions: SelectOption[];
  /** Tables whose load ceiling was hit — the list may be incomplete. */
  truncated: string[];
}

/**
 * /admin/families (Concept A · Console): the families table with its toolbar
 * and footer, the side panel, and the phone card list.
 *
 * Everything the operator does here is client state. Search, filters, sort,
 * paging, saved views, the open family and its tab live in React and are
 * written to the URL with history.replaceState — never a server round trip,
 * never router.push — so every change is instant and the URL still restores
 * the screen. Typing waits 300ms before the URL catches up; the list itself
 * follows each keystroke through useDeferredValue.
 *
 * Those writes go through UrlSync (urlSync.ts), because a replaceState that
 * lands while a navigation is pending makes Next discard the navigation. A
 * waiting write goes out on any pointer press and when the search box loses
 * focus, and everything that leaves the page — Enter on a row, a tapped card,
 * a phone arriving with a family open, a ⌘K destination — goes through
 * `leave()`: the waiting timers are dropped, the URL is written first and
 * then held, and the row or card shows its pending state (spec §2.3.7) until
 * the next page arrives. A link that navigates on its own — the rail, the top
 * bar, the panel's footer and history rows, the health dialog — pauses the
 * writes too, from the moment its click reaches the window
 * (startsNavigationAway): the list keeps answering, only the URL waits.
 *
 * The frame talks to the page through three cancelable window events: the
 * rail and the phone chips switch views (FAMILIES_VIEW_EVENT), ⌘K opens a
 * family in the panel (FAMILY_OPEN_EVENT) or hands over a navigation
 * (NAVIGATE_EVENT); handling one calls preventDefault() so the frame skips
 * its own navigation. A URL change from anywhere else (back / forward, a
 * link) is adopted; the echo of the page's own write never is.
 */
export function FamiliesConsole({
  rows: packedRows,
  texts,
  nowIso,
  initialQuery,
  initialPanel,
  locale,
  currency,
  tierOptions,
  statusOptions,
  truncated,
}: FamiliesConsoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams?.toString() ?? "";
  // Rebuilt once per server render (a new list), never per keystroke.
  const rows = useMemo(() => unpackFamilyRows(packedRows), [packedRows]);

  // The state starts from the LIVE URL, not the server's parse of it. They
  // are the same on a fresh load; after back/forward the router may re-show
  // this page's cached render (props parsed from the URL it was first loaded
  // with) while the address bar holds what replaceState wrote since.
  const [panel, setPanel] = useState<FamilyPanelState>(() =>
    searchParams ? parseFamilyPanelState(searchParams) : initialPanel,
  );
  // A family opened by the URL (a shared link, ⌘K from another page) shows
  // its row: the list starts on the page it is on.
  const [query, setQuery] = useState<FamilyListQuery>(() => {
    const start = searchParams ? parseFamilyListQuery(searchParams) : initialQuery;
    const open = searchParams ? parseFamilyPanelState(searchParams).open : initialPanel.open;
    return startingQuery(rows, start, open);
  });
  const [sheet, setSheet] = useState<SheetView>(NO_SHEET);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [seenUrl, setSeenUrl] = useState(urlKey);
  const [loader] = useState(() => new PanelLoader());
  const [sync] = useState(() => new UrlSync());
  // Set inside the leaving transition, so it lasts exactly as long as the
  // navigation is pending — and clears itself if the page stays after all.
  const [leaving, setLeaving] = useOptimistic<Leaving | null>(null);

  const hidden = useSyncExternalStore(
    subscribeHiddenColumns,
    getHiddenColumns,
    getServerHiddenColumns,
  );
  const wide = useSyncExternalStore(subscribeWide, isWideNow, isWideOnServer);

  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openIdRef = useRef<string | null>(panel.open);
  const hoverIdRef = useRef<string | null>(null);
  const timersRef = useRef<Timers>({ hover: undefined, focus: undefined, arrow: undefined });
  const actionsRef = useRef<Actions | null>(null);
  /** The last click the table or the cards handled themselves (see onClickDone). */
  const ownClickRef = useRef<Event | null>(null);

  // ── The list, in memory ──
  const deferredQ = useDeferredValue(query.q);
  const index = useMemo(() => buildSearchIndex(rows), [rows]);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.userId, row])), [rows]);
  const counts = useMemo(() => viewCounts(rows), [rows]);
  const filtered = useMemo(
    () =>
      filterRows(rows, index, {
        view: query.view,
        q: deferredQ,
        tier: query.tier,
        status: query.status,
      }),
    [rows, index, query.view, deferredQ, query.tier, query.status],
  );
  const sorted = useMemo(
    () => sortFamilies(filtered, query.sort, query.dir),
    [filtered, query.sort, query.dir],
  );
  const pageData = useMemo(() => paginateFamilies(sorted, query.page), [sorted, query.page]);
  const pageIds = useMemo(() => pageData.rows.map((row) => row.userId), [pageData.rows]);
  const head = useMemo(() => listCounts(filtered), [filtered]);
  const columns = useMemo(() => visibleColumns(hidden), [hidden]);
  // Display strings: the server's for the rows it rendered (hydrated as
  // sent), this formatter's — same options, same "now" — for the rest.
  const formatText = useMemo(
    () => rowTextFormatter({ locale, currency, nowIso }),
    [locale, currency, nowIso],
  );
  const pageTexts = useMemo(
    () => textsFor(pageData.rows, texts, formatText),
    [pageData.rows, texts, formatText],
  );
  // The page the URL says, clamped to the pages that exist.
  const effectiveQuery = useMemo(
    () => (pageData.page === query.page ? query : { ...query, page: pageData.page }),
    [query, pageData.page],
  );
  const stateSearch = listSearch(effectiveQuery, panel);

  // The URL changed under the page (back/forward, a link, a server redirect):
  // adopt it. Every write of the page's own comes back here too, later, as a
  // low-priority echo — by then the state may have moved on (a keystroke
  // between the write and its echo), so an echo is never adopted: that would
  // put older text back into the search box. A URL naming another open
  // family (or none) also resets the panel, as closePanel and openFamily do:
  // the load effect then asks the loader for the family the URL names.
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey);
    if (!sync.isOwnEcho(urlKey)) {
      const adopted = adoptUrl(urlKey, { search: stateSearch, open: panel.open });
      if (adopted) {
        setQuery(adopted.query);
        setPanel(adopted.panel);
        if (adopted.resetSheet) setSheet(NO_SHEET);
      }
    }
  }
  useEffect(() => {
    sync.settle(seenUrl);
  }, [sync, seenUrl]);

  // ── The URL follows the state (UrlSync: debounced typing, held while leaving) ──
  useEffect(() => {
    if (leaving) sync.holdShown(leaving.token);
    else sync.holdGone();
    sync.push(pathname, stateSearch);
  }, [sync, pathname, stateSearch, leaving]);

  // ── The panel's data when it was opened by the URL (first load, back/forward) ──
  const openId = panel.open;
  useLayoutEffect(() => {
    openIdRef.current = openId;
  }, [openId]);
  useEffect(() => {
    if (!openId || !wide || sheet.id === openId) return;
    let alive = true;
    const cached = loader.peek(openId);
    const pending = cached && loader.isFresh(cached) ? Promise.resolve(cached) : loader.load(openId);
    void pending.then((entry) => {
      if (alive && entry && openIdRef.current === openId) {
        setSheet({ id: openId, entry, busy: false });
      }
    });
    return () => {
      alive = false;
    };
  }, [openId, wide, sheet.id, loader]);

  // ── Focus moves after the DOM has the element ──
  useLayoutEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.to === "panel") {
      headingRef.current?.focus({ preventScroll: true });
    } else if (focusRequest.to === "search") {
      searchRef.current?.focus();
    } else {
      const body = bodyRef.current;
      const row =
        (focusRequest.id ? rowElement(body, focusRequest.id) : null) ??
        body?.querySelector<HTMLElement>('tr[tabindex="0"]') ??
        null;
      if (row) {
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusRequest]);

  // ── Actions ──
  function openFamily(id: string, how: OpenHow) {
    // On the way to another page: opening would write the URL and discard
    // that navigation (and fetch a family nobody will see).
    if (sync.isHeld()) return;
    // Whatever opens now wins over an ↑/↓ open still waiting to fire.
    window.clearTimeout(timersRef.current.arrow);
    openIdRef.current = id;
    setPanel((current) => ({ open: id, tab: how.tab ?? current.tab }));
    if (how.reveal) {
      const target = pageOf(
        sorted.map((row) => row.userId),
        id,
        FAMILY_PAGE_SIZE,
      );
      if (target !== null && target !== pageData.page) {
        setQuery((current) => ({ ...current, page: target }));
      }
    }
    const cached = loader.peek(id);
    if (cached && loader.isFresh(cached)) {
      setSheet({ id, entry: cached, busy: false });
    } else {
      // A stale answer stays on screen, dimmed, while it is refreshed.
      setSheet({ id, entry: cached?.result.kind === "ok" ? cached : null, busy: true });
      void loader.load(id).then((entry) => {
        if (entry && openIdRef.current === id) setSheet({ id, entry, busy: false });
      });
    }
    if (how.focus === "panel") setFocusRequest({ to: "panel" });
  }

  function closePanel(restoreFocus: boolean) {
    const id = panel.open;
    // An ↑/↓ open still waiting must not bring the panel back.
    window.clearTimeout(timersRef.current.arrow);
    openIdRef.current = null;
    setPanel((current) => ({ ...current, open: null }));
    // Forget what was on screen: a later open (even by the URL) starts clean.
    setSheet(NO_SHEET);
    loader.abortOpen();
    if (restoreFocus) setFocusRequest({ to: "row", id });
  }

  function selectTab(tab: FamilyTab) {
    setPanel((current) => ({ ...current, tab }));
  }

  /**
   * Leave for another page (a family's full page). Nothing the page still
   * owes may land after the navigation starts — Next would discard it — so
   * the waiting timers go, the URL is written first and then held, and only
   * then does the router move. Until the next page arrives the row or card it
   * left from reports aria-busy and the list dims; if the page stays after
   * all, the hold lifts with the transition.
   */
  function leave(href: string, from: string | null, how: "push" | "replace" = "push") {
    const timers = timersRef.current;
    window.clearTimeout(timers.arrow);
    window.clearTimeout(timers.focus);
    window.clearTimeout(timers.hover);
    const token = sync.hold();
    startTransition(() => {
      setLeaving({ token, id: from });
      if (how === "replace") router.replace(href);
      else router.push(href);
    });
  }

  function retry() {
    const id = panel.open;
    if (!id) return;
    setSheet({ id, entry: null, busy: true });
    void loader.load(id).then((entry) => {
      if (entry && openIdRef.current === id) setSheet({ id, entry, busy: false });
    });
  }

  /**
   * Focus the row a key moves to; on a wide screen, open it after a pause.
   * Past the page's last row ↓ carries on to the next page (↑ to the
   * previous one), so the keyboard can walk the whole list.
   */
  function stepFrom(from: string | null, step: RowStep) {
    let next = stepRow(pageIds, from, step);
    if (next === null && from !== null && pageIds.includes(from)) {
      const turn = step === "next" ? 1 : step === "prev" ? -1 : 0;
      const page = pageData.page + turn;
      if (turn === 0 || page < 1 || page > pageData.pageCount) return;
      const size = pageData.pageSize;
      const ids = sorted.slice((page - 1) * size, page * size).map((row) => row.userId);
      next = (turn === 1 ? ids[0] : ids[ids.length - 1]) ?? null;
      if (!next) return;
      setQuery((current) => ({ ...current, page }));
      setFocusRequest({ to: "row", id: next });
    } else if (!next || next === from) {
      return;
    } else {
      rowElement(bodyRef.current, next)?.focus();
    }
    const target = next;
    const timers = timersRef.current;
    window.clearTimeout(timers.arrow);
    if (!isWideNow()) return;
    timers.arrow = window.setTimeout(() => {
      // Only while the keyboard is still on that row: a click, a link or a
      // key since then has moved on, and a late open would write the URL
      // under whatever that started.
      if (document.activeElement !== rowElement(bodyRef.current, target)) return;
      actionsRef.current?.openFamily(target, { focus: "keep" });
    }, ARROW_OPEN_MS);
  }

  function prefetchSoon(slot: "hover" | "focus", id: string, delay: number) {
    const timers = timersRef.current;
    window.clearTimeout(timers[slot]);
    timers[slot] = window.setTimeout(() => {
      // Not while a navigation is on its way: every fetch is an audited view.
      if (isWideNow() && !sync.isPaused()) loader.prefetch(id);
    }, delay);
  }

  function resetListScroll() {
    if (isWideNow()) wrapRef.current?.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  }

  /** Another saved view is another list: it starts at the top, panel closed (the prototype's). */
  function changeView(view: FamilyView) {
    if (view === query.view) return;
    setQuery((current) => ({ ...current, view, page: 1 }));
    if (panel.open) closePanel(false);
    resetListScroll();
  }

  function changeFilter(patch: Partial<Pick<FamilyListQuery, "q" | "tier" | "status">>) {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  }

  function clearFilters() {
    changeFilter({ q: "", tier: "", status: "" });
    setFocusRequest({ to: "search" });
  }

  function sortBy(key: FamilySortKey) {
    setQuery((current) => ({ ...current, ...nextSort(current, key), page: 1 }));
    resetListScroll();
  }

  /** The narrow screens' sort select: an order at once — what a header click sets, from page 1. */
  function sortTo(order: SortOrder) {
    setQuery((current) => ({ ...current, ...order, page: 1 }));
    resetListScroll();
  }

  function goToPage(page: number) {
    setQuery((current) => ({ ...current, page }));
    resetListScroll();
  }

  // Stable entry points for the memoised panel and for timers.
  useLayoutEffect(() => {
    actionsRef.current = { openFamily, closePanel, selectTab, retry, stepFrom };
  });
  const sheetActions = useMemo<SheetActions>(
    () => ({
      close: () => actionsRef.current?.closePanel(true),
      tab: (tab) => actionsRef.current?.selectTab(tab),
      retry: () => actionsRef.current?.retry(),
      step: (step) => actionsRef.current?.stepFrom(openIdRef.current, step),
    }),
    [],
  );

  // ── The table's delegated handlers ──
  function onBodyClick(event: MouseEvent<HTMLTableSectionElement>) {
    if (event.defaultPrevented || isModifiedClick(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest<HTMLTableRowElement>("tr[data-id]");
    const id = row?.dataset.id;
    if (!row || !id) return;
    const link = target?.closest<HTMLAnchorElement>("a[href]") ?? null;
    if (!link) {
      // Selecting text in a row is not a request to open it.
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && row.contains(selection.anchorNode)) return;
    }
    event.preventDefault();
    // Handled here — an open or leave() — so the window does not take the
    // name link's click for a navigation someone else started.
    ownClickRef.current = event.nativeEvent;
    if (isWideNow()) openFamily(id, { focus: "panel" });
    else leave(link?.getAttribute("href") ?? familyPageHref(id), id);
  }

  function onBodyKeyDown(event: KeyboardEvent<HTMLTableSectionElement>) {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest<HTMLTableRowElement>("tr[data-id]") ?? null;
    const id = row?.dataset.id;
    if (!target || !row || !id) return;
    // The row, or its name link — the row's only link, click-focusable (a
    // ⌘-click leaves focus on it) — which answers to the same keys.
    if (target !== row && target.closest("a[href]") === null) return;
    const command = rowKeyCommand(event);
    if (!command) return;
    switch (command.kind) {
      case "step":
        event.preventDefault();
        stepFrom(id, command.step);
        return;
      case "page":
        // preventDefault also stops the link's own Enter, which would click it
        // and open the panel instead.
        event.preventDefault();
        leave(familyPageHref(id, panel.open === id ? panel.tab : null), id);
        return;
      case "panel":
        event.preventDefault();
        if (isWideNow()) openFamily(id, { focus: "keep" });
        else leave(familyPageHref(id), id);
        return;
      case "close":
        if (!panel.open) return;
        event.preventDefault();
        closePanel(false);
    }
  }

  function onBodyFocus(event: FocusEvent<HTMLTableSectionElement>) {
    const target = event.target instanceof Element ? event.target : null;
    const id = target?.closest<HTMLTableRowElement>("tr[data-id]")?.dataset.id;
    if (!id) return;
    if (id !== focusId) setFocusId(id);
    prefetchSoon("focus", id, FOCUS_PREFETCH_MS);
  }

  function onBodyPointerOver(event: PointerEvent<HTMLTableSectionElement>) {
    if (event.pointerType !== "mouse") return;
    const target = event.target instanceof Element ? event.target : null;
    const id = target?.closest<HTMLTableRowElement>("tr[data-id]")?.dataset.id ?? null;
    if (id === hoverIdRef.current) return;
    hoverIdRef.current = id;
    window.clearTimeout(timersRef.current.hover);
    if (id) prefetchSoon("hover", id, HOVER_PREFETCH_MS);
  }

  function onBodyPointerLeave() {
    hoverIdRef.current = null;
    window.clearTimeout(timersRef.current.hover);
  }

  function onCardsClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || isModifiedClick(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest<HTMLAnchorElement>("a[href]") ?? null;
    const href = card?.getAttribute("href");
    if (!card || !href) return;
    event.preventDefault();
    ownClickRef.current = event.nativeEvent;
    leave(href, card.dataset.id ?? null);
  }

  // ── Window: the frame's requests, and the page's keys ──
  // While a navigation is on its way (the page leaving, or a link elsewhere),
  // a request is left to the frame: its own navigation then replaces the one
  // in flight, as any newer navigation does.
  const onOpenRequest = useEffectEvent((event: Event) => {
    const id = (event as CustomEvent<FamilyOpenDetail>).detail?.id;
    if (typeof id !== "string" || !isFamilyId(id) || !isWideNow() || sync.isPaused()) return;
    event.preventDefault();
    openFamily(id.toLowerCase(), { focus: "panel", tab: "summary", reveal: true });
  });

  const onViewRequest = useEffectEvent((event: Event) => {
    const view = (event as CustomEvent<FamiliesViewDetail>).detail?.view;
    if (!view || !FAMILY_VIEWS.includes(view) || sync.isPaused()) return;
    event.preventDefault();
    changeView(view);
  });

  // A navigation the frame is about to start with the router (⌘K): the page
  // takes it over, so its URL writes wait and the list shows it pending.
  const onNavigateRequest = useEffectEvent((event: Event) => {
    const href = (event as CustomEvent<NavigateDetail>).detail?.href;
    if (typeof href !== "string" || !isAppPath(href)) return;
    event.preventDefault();
    leave(href, null);
  });

  // A link elsewhere on screen — the rail, the top bar, the panel and its
  // blocks — started a navigation of its own: the URL waits until it ends,
  // or a write landing meanwhile would discard it (urlSync.ts).
  const onClickDone = useEffectEvent((event: globalThis.MouseEvent) => {
    if (event === ownClickRef.current) return;
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest("a[href]");
    const link =
      anchor instanceof HTMLAnchorElement
        ? { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") }
        : null;
    const here = { origin: window.location.origin, pathname: window.location.pathname };
    if (startsNavigationAway({ ...clickKeys(event), link }, here)) sync.navigationStarted();
  });

  const onWindowKey = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    // A console dialog (⌘K, the drawer, the health confirm) owns the keys.
    if (document.querySelector('[aria-modal="true"]')) return;
    const target = event.target instanceof Element ? event.target : null;
    const typing = !!target?.closest('input, select, textarea, [contenteditable="true"]');
    if (event.key === "Escape") {
      if (!panel.open || typing) return;
      event.preventDefault();
      closePanel(true);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || typing) return;
    if (event.key === "/" || (event.code === "Slash" && !event.shiftKey)) {
      event.preventDefault();
      searchRef.current?.focus();
      return;
    }
    // With nothing focused, ↑/↓ still walk the rows from the open family.
    const idle = target === null || target === document.body || target.id === "main";
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && panel.open && idle) {
      event.preventDefault();
      stepFrom(panel.open, event.key === "ArrowDown" ? "next" : "prev");
    }
  });

  // Arriving with a family open (a shared link, ⌘K from another page): its
  // panel takes focus — or, below 1024px where there is no panel, its page
  // opens instead.
  const onMount = useEffectEvent(() => {
    const open = panel.open;
    if (!open) return;
    if (!isWideNow()) leave(familyPageHref(open, panel.tab), open, "replace");
    else headingRef.current?.focus({ preventScroll: true });
  });

  useEffect(() => {
    const timers = timersRef.current;
    const onKey = (event: globalThis.KeyboardEvent) => onWindowKey(event);
    const onOpen = (event: Event) => onOpenRequest(event);
    const onView = (event: Event) => onViewRequest(event);
    const onNavigate = (event: Event) => onNavigateRequest(event);
    // Bubble phase: by the time a click reaches the window, a <Link> has
    // taken it and its navigation has started.
    const onClick = (event: globalThis.MouseEvent) => onClickDone(event);
    // A press anywhere is the pointer taking over: a keyboard open still
    // waiting is dropped, and a URL write still waiting goes out now —
    // before whatever the press starts (a link, a card, the currency or
    // language form) can be discarded by it.
    const onPress = () => {
      window.clearTimeout(timers.arrow);
      sync.flush();
    };
    // Back/forward moved the browser to another entry: a write still
    // waiting for the old state must not land on it (the new URL is adopted
    // when its render arrives), and a link's navigation on its way was
    // replaced by this one.
    const onHistory = () => {
      sync.cancel();
      sync.navigationEnded();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPress, true);
    window.addEventListener("click", onClick);
    window.addEventListener("popstate", onHistory);
    window.addEventListener(FAMILY_OPEN_EVENT, onOpen);
    window.addEventListener(FAMILIES_VIEW_EVENT, onView);
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    onMount();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onHistory);
      window.removeEventListener(FAMILY_OPEN_EVENT, onOpen);
      window.removeEventListener(FAMILIES_VIEW_EVENT, onView);
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
      window.clearTimeout(timers.hover);
      window.clearTimeout(timers.focus);
      window.clearTimeout(timers.arrow);
      sync.cancel();
      loader.abortAll();
    };
  }, [loader, sync]);

  // ── Render ──
  const openRow = openId ? (rowById.get(openId) ?? null) : null;
  const openText = useMemo(
    () => (openId ? (texts[openId] ?? (openRow ? formatText(openRow) : null)) : null),
    [openId, openRow, texts, formatText],
  );
  const viewLabel = t(VIEW_LABEL_KEY[query.view], locale);
  const line = countsLine(head, locale);
  const range = pageRange(pageData.page, pageData.pageSize, pageData.total);
  const rovingId =
    (focusId && pageIds.includes(focusId) ? focusId : null) ??
    (openId && pageIds.includes(openId) ? openId : null) ??
    pageIds[0] ??
    null;
  // A status the URL brought in later (back/forward) that the server did not list.
  const statusChoices =
    query.status && !statusOptions.some((option) => option.value === query.status)
      ? [...statusOptions, { value: query.status, label: statusOptionLabel(query.status, locale) }]
      : statusOptions;

  let empty = null;
  if (rows.length === 0) {
    empty = <Empty title={t("fl_empty", locale)}>{t("fl_empty_b", locale)}</Empty>;
  } else if (pageData.total === 0 && hasFilters(query)) {
    empty = (
      <Empty title={t("fl_no_match", locale)}>
        {t("fl_no_match_b", locale)}
        <span className="ad-fl-empty-act">
          <Btn variant="secondary" onClick={clearFilters}>
            {t("fl_clear_filters", locale)}
          </Btn>
        </span>
      </Empty>
    );
  } else if (pageData.total === 0) {
    empty = (
      <Empty title={t("fl_view_empty", locale)}>
        {t("fl_view_empty_b", locale)}
        {query.view !== "all" ? (
          <span className="ad-fl-empty-act">
            <Btn variant="secondary" onClick={() => changeView("all")}>
              {t("fl_show_all", locale)}
            </Btn>
          </span>
        ) : null}
      </Empty>
    );
  }

  return (
    <div className="ad-a-split ad-fl">
      <section className="ad-a-list" aria-label={viewLabel} aria-busy={leaving ? true : undefined}>
        <div className="ad-a-head ad-desk-only">
          <div>
            <h1>{viewLabel}</h1>
            <p>{joinSep(...countsParts(head, locale))}</p>
          </div>
        </div>

        <div className="ad-ph-top ad-phone-only">
          <div className="ad-ph-bar">
            <h1>{t("sh_families", locale)}</h1>
          </div>
          <div className="ad-ph-chips" role="group" aria-label={t("fl_views", locale)}>
            {FAMILY_VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={view === query.view}
                onClick={() => changeView(view)}
              >
                {t(VIEW_LABEL_KEY[view], locale)}
                <Count>{fmtNumber(counts[view], locale)}</Count>
              </button>
            ))}
          </div>
        </div>

        {/* The counts, announced when a search or a filter changes them. */}
        <p className="ad-sr" role="status">
          {line}
        </p>

        {truncated.length > 0 ? (
          <Note tone="warn" className="ad-fl-note">
            {t("fl_truncated", locale)} <Ltr mono>{truncated.join(", ")}</Ltr>
          </Note>
        ) : null}

        <div className="ad-a-tools">
          <label className="ad-search">
            <Search className="ad-ic" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              name="q"
              // Names are Arabic, emails Latin: once there is text, its first
              // strong character decides, so «hind.» reads «hind.» — never
              // «.hind». Empty, the field keeps the page's direction (an empty
              // dir=auto field is LTR, which would push the Arabic
              // placeholder away from the icon).
              dir={query.q ? "auto" : undefined}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={200}
              value={query.q}
              placeholder={t("search_placeholder", locale)}
              aria-label={t("search_placeholder", locale)}
              onChange={(event) => changeFilter({ q: event.target.value })}
              // Done typing: the URL catches up now rather than 300ms later.
              onBlur={() => sync.flush()}
            />
          </label>
          <select
            className="ad-select"
            aria-label={t("col_tier", locale)}
            value={query.tier}
            onChange={(event) => changeFilter({ tier: event.target.value })}
          >
            <option value="">{t("fl_tier_all", locale)}</option>
            {tierOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="ad-select"
            aria-label={t("col_status", locale)}
            value={query.status}
            onChange={(event) => changeFilter({ status: event.target.value })}
          >
            <option value="">{t("fl_status_all", locale)}</option>
            {statusChoices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Below 1024px the cards have no header row to sort by: every
              order a header click gives, as one select. */}
          <select
            className="ad-select ad-phone-only"
            aria-label={t("fl_sort", locale)}
            value={sortOrderValue(query)}
            onChange={(event) => {
              const order = parseSortOrder(event.target.value);
              if (order) sortTo(order);
            }}
          >
            {SORT_ORDERS.map((order) => (
              <option key={sortOrderValue(order)} value={sortOrderValue(order)}>
                {sortOrderLabel(order, locale)}
              </option>
            ))}
          </select>
          <ColumnsMenu
            hidden={hidden}
            onToggle={toggleColumn}
            locale={locale}
            className="ad-desk-only"
          />
        </div>

        <FamilyTable
          label={viewLabel}
          rows={pageData.rows}
          texts={pageTexts}
          columns={columns}
          sort={query.sort}
          dir={query.dir}
          openId={openId}
          rovingId={rovingId}
          pendingId={leaving?.id ?? null}
          locale={locale}
          wrapRef={wrapRef}
          bodyRef={bodyRef}
          onSort={sortBy}
          onBodyClick={onBodyClick}
          onBodyKeyDown={onBodyKeyDown}
          onBodyFocus={onBodyFocus}
          onBodyPointerOver={onBodyPointerOver}
          onBodyPointerLeave={onBodyPointerLeave}
          empty={empty}
        />

        <FamilyCards
          rows={pageData.rows}
          texts={pageTexts}
          sort={query.sort}
          pendingId={leaving?.id ?? null}
          locale={locale}
          onClick={onCardsClick}
          empty={empty}
        />

        {pageData.total > 0 ? (
          // Phones get the bar only when there is another page to turn to.
          <div className={pageData.pageCount > 1 ? "ad-a-foot" : "ad-a-foot ad-desk-only"}>
            <div className="ad-fl-pages">
              <span className="ad-num">{rangeText(range, pageData.total, locale)}</span>
              {pageData.pageCount > 1 ? (
                <nav className="ad-fl-pager" aria-label={t("nav_pagination", locale)}>
                  {/* aria-disabled, not disabled: a button that disables itself
                      under the pointer or the keyboard would drop focus. */}
                  <IconBtn
                    label={t("page_prev", locale)}
                    icon={ChevronLeft}
                    flip
                    aria-disabled={pageData.page <= 1}
                    onClick={() => {
                      if (pageData.page > 1) goToPage(pageData.page - 1);
                    }}
                  />
                  <IconBtn
                    label={t("page_next", locale)}
                    icon={ChevronRight}
                    flip
                    aria-disabled={pageData.page >= pageData.pageCount}
                    onClick={() => {
                      if (pageData.page < pageData.pageCount) goToPage(pageData.page + 1);
                    }}
                  />
                </nav>
              ) : null}
            </div>
            <span className="ad-kb ad-desk-only">
              {joinSep(
                <>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> {t("fl_kb_rows", locale)}
                </>,
                <>
                  <Kbd>⏎</Kbd> {t("fl_kb_full", locale)}
                </>,
                <>
                  <Kbd>esc</Kbd> {t("fl_kb_close", locale)}
                </>,
              )}
            </span>
          </div>
        ) : null}
      </section>

      {openId ? (
        <FamilySheet
          id={openId}
          tab={panel.tab}
          view={sheet}
          row={openRow}
          rowText={openText}
          locale={locale}
          currency={currency}
          headingRef={headingRef}
          actions={sheetActions}
        />
      ) : null}
    </div>
  );
}

function rowElement(body: HTMLTableSectionElement | null, id: string): HTMLTableRowElement | null {
  return body?.querySelector<HTMLTableRowElement>(`tr[data-id="${CSS.escape(id)}"]`) ?? null;
}
