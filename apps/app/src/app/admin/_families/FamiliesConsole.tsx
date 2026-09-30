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
  type FamilyRow,
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
import { Btn, Empty, IconBtn, Kbd, Ltr, Note } from "../_ui";
import {
  FAMILIES_VIEW_EVENT,
  FAMILY_OPEN_EVENT,
  type FamiliesViewDetail,
  type FamilyOpenDetail,
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
  buildSearchIndex,
  countsLine,
  familyPageHref,
  filterRows,
  hasFilters,
  listCounts,
  listSearch,
  nextSort,
  pageOf,
  pageRange,
  rangeText,
  revealOpenFamily,
  rowKeyCommand,
  statusOptionLabel,
  stepRow,
  toggleHidden,
  visibleColumns,
  type RowStep,
} from "./listModel";
import { PanelLoader } from "./panelLoader";
import type { FamilyRowText, SelectOption } from "./types";
import { UrlSync } from "./urlSync";

/** A row hovered this long is fetched ahead of a click. */
const HOVER_PREFETCH_MS = 150;
/** A row keeping focus this long is fetched ahead (key repeat never waits this long). */
const FOCUS_PREFETCH_MS = 100;
/** ↑/↓ open the row they land on after this pause, not on every step. */
const ARROW_OPEN_MS = 150;

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
  /** Every family, lean (the page slices, filters and sorts them here). */
  rows: FamilyRow[];
  /** Server-formatted display strings, by family id. */
  texts: Record<string, FamilyRowText>;
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
 * a phone arriving with a family open — goes through `leave()`: the waiting
 * timers are dropped, the URL is written first and then held, and the row or
 * card shows its pending state (spec §2.3.7) until the next page arrives.
 *
 * The frame talks to the page through two cancelable window events: the rail
 * and the phone chips switch views (FAMILIES_VIEW_EVENT), ⌘K opens a family in
 * the panel (FAMILY_OPEN_EVENT); handling one calls preventDefault() so the
 * frame skips its own navigation. A URL change from anywhere else (back /
 * forward, a link) is adopted; the echo of the page's own write never is.
 */
export function FamiliesConsole({
  rows,
  texts,
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
    return open ? revealOpenFamily(rows, start, open) : start;
  });
  const [sheet, setSheet] = useState<SheetView>({ id: null, entry: null, busy: false });
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
  // put older text back into the search box.
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey);
    if (!sync.isOwnEcho(urlKey)) {
      const params = new URLSearchParams(urlKey);
      const nextQuery = parseFamilyListQuery(params);
      const nextPanel = parseFamilyPanelState(params);
      if (listSearch(nextQuery, nextPanel) !== stateSearch) {
        setQuery(nextQuery);
        setPanel(nextPanel);
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
    setSheet({ id: null, entry: null, busy: false });
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
      if (isWideNow() && !sync.isHeld()) loader.prefetch(id);
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
    leave(href, card.dataset.id ?? null);
  }

  // ── Window: the frame's requests, and the page's keys ──
  // While the page is leaving, a request is left to the frame: its own
  // navigation then replaces the one in flight, as any newer navigation does.
  const onOpenRequest = useEffectEvent((event: Event) => {
    const id = (event as CustomEvent<FamilyOpenDetail>).detail?.id;
    if (typeof id !== "string" || !isFamilyId(id) || !isWideNow() || sync.isHeld()) return;
    event.preventDefault();
    openFamily(id.toLowerCase(), { focus: "panel", tab: "summary", reveal: true });
  });

  const onViewRequest = useEffectEvent((event: Event) => {
    const view = (event as CustomEvent<FamiliesViewDetail>).detail?.view;
    if (!view || !FAMILY_VIEWS.includes(view) || sync.isHeld()) return;
    event.preventDefault();
    changeView(view);
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
    // when its render arrives).
    const onHistory = () => sync.cancel();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPress, true);
    window.addEventListener("popstate", onHistory);
    window.addEventListener(FAMILY_OPEN_EVENT, onOpen);
    window.addEventListener(FAMILIES_VIEW_EVENT, onView);
    onMount();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("popstate", onHistory);
      window.removeEventListener(FAMILY_OPEN_EVENT, onOpen);
      window.removeEventListener(FAMILIES_VIEW_EVENT, onView);
      window.clearTimeout(timers.hover);
      window.clearTimeout(timers.focus);
      window.clearTimeout(timers.arrow);
      sync.cancel();
      loader.abortAll();
    };
  }, [loader, sync]);

  // ── Render ──
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
            <p>{line}</p>
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
                {t(VIEW_LABEL_KEY[view], locale)} · {fmtNumber(counts[view], locale)}
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
          texts={texts}
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
          texts={texts}
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
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {t("fl_kb_rows", locale)} · <Kbd>⏎</Kbd> {t("fl_kb_full", locale)} ·{" "}
              <Kbd>esc</Kbd> {t("fl_kb_close", locale)}
            </span>
          </div>
        ) : null}
      </section>

      {openId ? (
        <FamilySheet
          id={openId}
          tab={panel.tab}
          view={sheet}
          row={rowById.get(openId) ?? null}
          rowText={texts[openId] ?? null}
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
