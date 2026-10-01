"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Search, Users, X } from "lucide-react";
import { FAMILY_VIEWS, type FamilySearchEntry, type FamilyView } from "@/lib/admin/console-types";
import { normalizeSearch } from "@/lib/admin/familyList";
import { initialOf } from "../_ui/Avatar";
import { IconBtn } from "../_ui/Button";
import { joinSep } from "../_ui/Sep";
import { focusIsLost, trapTab, useEscapedKeys } from "../_ui/modalFocus";
import {
  PALETTE_OPEN_EVENT,
  requestFamiliesView,
  requestFamilyOpen,
  requestNavigation,
} from "./events";
import { fetchFamilyIndex } from "./familyIndex";
import type { ShellLabels } from "./labels";
import type { NavPromise } from "./Rail";
import type { ShellNav } from "./navData";
import { WIDE_QUERY, familiesViewHref, familyHref } from "./views";

/** Families shown at most; the group header says how many more matched. */
const MAX_FAMILIES = 8;

/** Every word of the (normalised) query occurs in the (normalised) text —
 * the same rule as the families list search («هند عتيبي» finds «هِنْد العتيبي»). */
function matchesAllTokens(haystack: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return normalizedQuery.split(" ").every((word) => haystack.includes(word));
}

/** A family with its search keys: normalised name + email, lower-cased id. */
interface IndexedFamily extends FamilySearchEntry {
  hay: string;
  idKey: string;
}

function buildIndex(families: readonly FamilySearchEntry[]): IndexedFamily[] {
  return families.map((f) => ({
    ...f,
    hay: normalizeSearch(`${f.name ?? ""} ${f.email ?? ""}`),
    idKey: f.id.toLowerCase(),
  }));
}

/**
 * The family index as the palette holds it, keyed by the frame render (`nav`)
 * it was fetched under: a new render of the console layout — a hard load, a
 * refresh, an account erased — makes the next opening fetch it afresh.
 */
type IndexState =
  | { source: NavPromise; status: "loading" }
  | { source: NavPromise; status: "ready"; families: IndexedFamily[] }
  | { source: NavPromise; status: "failed" };

type Item =
  | { kind: "family"; id: string; name: string | null; email: string | null }
  | { kind: "overview" }
  | { kind: "view"; view: FamilyView };

/** An option's identity, so the highlighted one stays put when the list changes under it. */
function itemKey(item: Item): string {
  if (item.kind === "family") return `f-${item.id}`;
  if (item.kind === "view") return `v-${item.view}`;
  return "overview";
}

type PaletteLabels = Pick<
  ShellLabels,
  | "locale"
  | "overview"
  | "families"
  | "views"
  | "searchAny"
  | "close"
  | "palTitle"
  | "palFamilies"
  | "palNav"
  | "palGoOverview"
  | "palMove"
  | "palOpen"
  | "palClose"
  | "palNoMatch"
  | "palNoMatchHint"
  | "palLoading"
  | "palUnavailable"
  | "palShowing"
  | "unnamed"
  | "resultsCount"
>;

/**
 * ⌘K / Ctrl+K command palette: every family by name, email or ID (Arabic-aware
 * matching via familyList's normalizeSearch, so it finds exactly what the
 * families search finds) plus the console's destinations. A combobox + listbox dialog —
 * focus stays in the input, ↑↓ move the active option, ⏎ opens it, Esc (or a
 * click outside) closes and returns focus to where it was.
 *
 * Always mounted and never suspended, so the shortcut works the moment the
 * frame paints, and the destinations are there at once. The family index is
 * subscriber data, so no page carries it: the palette fetches it from GET
 * /api/admin/families the first time it opens (the route writes the audit
 * row), says "loading" until it arrives — a query typed meanwhile applies as
 * soon as it does — and keeps it, normalised for search, for every
 * re-opening until the frame itself is rendered afresh.
 */
export function CommandPalette({ labels, nav }: { labels: PaletteLabels; nav: NavPromise }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The highlighted option, by identity; null = the first one.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // The rail's counts, for the saved views' options.
  const [data, setData] = useState<ShellNav | null | undefined>(undefined);
  const [indexState, setIndexState] = useState<IndexState | null>(null);
  const fetchRef = useRef<AbortController | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listId = `${baseId}-list`;
  const optionId = useCallback((i: number) => `${baseId}-opt-${i}`, [baseId]);

  // The counts: resolved from the layout's promise (never suspends).
  const onNavData = useEffectEvent((value: ShellNav | null) => setData(value));
  useEffect(() => {
    let alive = true;
    nav.then(
      (value) => {
        if (alive) onNavData(value);
      },
      () => {
        if (alive) onNavData(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [nav]);

  // Leaving the console (signing out) drops a fetch still on its way.
  useEffect(
    () => () => {
      const pending = fetchRef.current;
      fetchRef.current = null;
      pending?.abort();
    },
    [],
  );

  /**
   * Fetches the family index for this frame render, once: re-opening reuses
   * it (or the fetch still on its way), and a failed fetch is tried again on
   * the next opening.
   */
  function ensureIndex() {
    if (indexState && indexState.source === nav && indexState.status !== "failed") return;
    fetchRef.current?.abort();
    const controller = new AbortController();
    fetchRef.current = controller;
    const source = nav;
    setIndexState({ source, status: "loading" });
    fetchFamilyIndex(controller.signal).then(
      (families) => {
        if (fetchRef.current !== controller) return;
        fetchRef.current = null;
        setIndexState({ source, status: "ready", families: buildIndex(families) });
      },
      () => {
        // Superseded or aborted: whoever replaced it owns the state.
        if (fetchRef.current !== controller) return;
        fetchRef.current = null;
        setIndexState({ source, status: "failed" });
      },
    );
  }

  // An index fetched under an earlier frame render stays usable while the
  // palette is open; the next opening replaces it (ensureIndex).
  const families = indexState?.status === "ready" ? indexState.families : null;
  const indexLoading = indexState?.status === "loading";
  const indexFailed = indexState?.status === "failed";

  const q = normalizeSearch(query);
  const matched = useMemo(() => {
    if (!families) return [];
    return q
      ? families.filter((f) => matchesAllTokens(f.hay, q) || (q.length >= 4 && f.idKey.startsWith(q)))
      : families;
  }, [families, q]);

  const navItems = useMemo(() => {
    if (!open) return [];
    const all: Item[] = [
      { kind: "overview" },
      ...FAMILY_VIEWS.map((view): Item => ({ kind: "view", view })),
    ];
    return all.filter((item) => {
      const text =
        item.kind === "overview"
          ? `${labels.palGoOverview} ${labels.overview}`
          : item.kind === "view"
            ? `${labels.families} ${labels.views[item.view]}`
            : "";
      return matchesAllTokens(normalizeSearch(text), q);
    });
  }, [open, labels, q]);

  const familyItems: Item[] = matched
    .slice(0, MAX_FAMILIES)
    .map((f) => ({ kind: "family", id: f.id, name: f.name, email: f.email }));
  const items: Item[] = [...familyItems, ...navItems];
  // Families arriving while the palette is open push the destinations down;
  // the option the operator moved to stays highlighted.
  const keyed = activeKey === null ? -1 : items.findIndex((item) => itemKey(item) === activeKey);
  const activeIndex = items.length ? Math.max(keyed, 0) : -1;

  const nf = useMemo(
    () => new Intl.NumberFormat(labels.locale === "ar" ? "ar-SA" : "en-US"),
    [labels.locale],
  );

  function openPalette() {
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActiveKey(null);
    ensureIndex();
    setOpen(true);
  }

  // Returns focus to where it was ONLY if nobody else claimed it. Unmounting
  // the dialog drops focus to <body>; a choice handed to the families page
  // (requestFamilyOpen / requestFamiliesView) may move focus into the side
  // sheet in its own effect, which runs before this frame — restoring then
  // would pull a keyboard user out of the panel they just opened. The same
  // guard leaves Next's post-navigation focus alone.
  function close() {
    setOpen(false);
    const back = restoreRef.current;
    restoreRef.current = null;
    if (back) {
      requestAnimationFrame(() => {
        if (focusIsLost() && back.isConnected) back.focus({ preventScroll: true });
      });
    }
  }

  // ⌘K / Ctrl+K anywhere toggles; the top-bar buttons send PALETTE_OPEN_EVENT.
  // e.code keeps the shortcut working on an Arabic keyboard layout.
  const onGlobalKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.shiftKey) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() !== "k" && event.code !== "KeyK") return;
    event.preventDefault();
    if (open) close();
    else openPalette();
  });
  const onOpenRequest = useEffectEvent(() => {
    if (!open) openPalette();
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => onGlobalKey(event);
    const onOpen = () => onOpenRequest();
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, optionId]);

  function choose(item: Item) {
    close();
    const wide = window.matchMedia(WIDE_QUERY).matches;
    const onFamilies = pathname === "/admin/families";
    if (item.kind === "family") {
      // On the families page the panel opens client-side when the page
      // handles the request; otherwise navigate.
      if (wide && onFamilies && requestFamilyOpen(item.id)) return;
      navigate(familyHref(item.id, wide));
      return;
    }
    if (item.kind === "view") {
      if (onFamilies && requestFamiliesView(item.view)) return;
      navigate(familiesViewHref(item.view));
      return;
    }
    navigate("/admin");
  }

  /** A page that must settle first (the families list) takes the navigation over; else the router. */
  function navigate(href: string) {
    if (!requestNavigation(href)) router.push(href);
  }

  /** ↑ ↓ move the active option, ⏎ opens it; true when the key was one of them. */
  function listKey(event: { key: string; preventDefault(): void }): boolean {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = items[(activeIndex + step + items.length) % items.length];
        if (next) setActiveKey(itemKey(next));
      }
      return true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) choose(item);
      return true;
    }
    return false;
  }

  function onInputKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    listKey(event);
  }

  // Esc closes; Tab stays inside the dialog.
  function onDialogKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (dialogRef.current) trapTab(event, dialogRef.current);
  }

  // Focus normally never leaves the field (see the dialog's onMouseDown); if
  // it does anyway, Esc and Tab still work (the hook), and any other key lands
  // back in the combobox: ↑ ↓ ⏎ act on the list, and a typed character goes
  // into the field, because focus moves before the key's default action.
  useEscapedKeys({
    open,
    containerRef: dialogRef,
    onEscape: close,
    onOtherKey: (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      inputRef.current?.focus();
      listKey(event);
    },
  });

  if (!open) return null;

  const showing =
    matched.length > MAX_FAMILIES
      ? labels.palShowing
          .replace("{shown}", nf.format(MAX_FAMILIES))
          .replace("{total}", nf.format(matched.length))
      : null;
  const liveText = `${labels.resultsCount}: ${nf.format(items.length)}`;

  function option(item: Item, i: number) {
    const selected = i === activeIndex;
    const common = {
      id: optionId(i),
      role: "option" as const,
      "aria-selected": selected,
      className: "ad-opt",
      onMouseMove: () => {
        if (i !== activeIndex) setActiveKey(itemKey(item));
      },
      onClick: () => choose(item),
    };
    if (item.kind === "family") {
      const name = item.name?.trim() || null;
      return (
        <div key={`f-${item.id}`} {...common}>
          <span className="ad-avatar" aria-hidden="true">
            {initialOf(name ?? item.email)}
          </span>
          <span>
            <b>
              <bdi>{name ?? labels.unnamed}</bdi>
            </b>
            {item.email ? (
              <small>
                <span dir="ltr" translate="no">
                  {item.email}
                </span>
              </small>
            ) : null}
          </span>
          <span />
        </div>
      );
    }
    if (item.kind === "overview") {
      return (
        <div key="overview" {...common}>
          <span className="ad-avatar ad-nav" aria-hidden="true">
            <LayoutGrid className="ad-ic" />
          </span>
          <span>
            <b>{labels.palGoOverview}</b>
          </span>
          <span />
        </div>
      );
    }
    return (
      <div key={`v-${item.view}`} {...common}>
        <span className="ad-avatar ad-nav" aria-hidden="true">
          <Users className="ad-ic" />
        </span>
        <span>
          <b>{labels.views[item.view]}</b>
          <small>{labels.families}</small>
        </span>
        <span className="ad-ct">{data ? data.countText[item.view] : ""}</span>
      </div>
    );
  }

  const familyGroupId = `${baseId}-g-fam`;
  const navGroupId = `${baseId}-g-nav`;

  return (
    <div
      className="ad-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className="ad-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onDialogKey}
        onMouseDown={(event) => {
          // Keep focus in the combobox. A press on anything but the field —
          // an option, a group label, padding, the footer — would otherwise
          // move focus to <body>, out of reach of ↑↓ ⏎ Esc and Tab. (The
          // close button still receives its click; it just never takes focus.)
          if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
        }}
      >
        <h2 id={titleId} className="ad-sr">
          {labels.palTitle}
        </h2>
        <div className="ad-pin">
          <Search className="ad-ic" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-label={labels.searchAny}
            placeholder={labels.searchAny}
            // A name, an email or an id: once there is text, its first strong
            // character sets the direction («hind.» never reads «.hind»);
            // empty, the page's direction keeps the placeholder by the icon.
            dir={query ? "auto" : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveKey(null);
            }}
            onKeyDown={onInputKey}
          />
          <kbd className="ad-kbd ad-desk-only" aria-hidden="true" dir="ltr">
            esc
          </kbd>
          <IconBtn className="ad-phone-only" label={labels.close} icon={X} onClick={close} />
        </div>

        <div className="ad-res">
          <div role="listbox" id={listId} aria-label={labels.palTitle}>
            {familyItems.length ? (
              <div role="group" aria-labelledby={familyGroupId}>
                <p id={familyGroupId} role="presentation" className="ad-grp">
                  {joinSep(labels.palFamilies, showing ? <small>{showing}</small> : null)}
                </p>
                {familyItems.map((item, i) => option(item, i))}
              </div>
            ) : null}
            {navItems.length ? (
              <div role="group" aria-labelledby={navGroupId}>
                <p id={navGroupId} role="presentation" className="ad-grp">
                  {labels.palNav}
                </p>
                {navItems.map((item, j) => option(item, familyItems.length + j))}
              </div>
            ) : null}
          </div>
          {indexLoading ? (
            <p className="ad-grp">{labels.palLoading}</p>
          ) : indexFailed ? (
            <p className="ad-grp">{labels.palUnavailable}</p>
          ) : null}
          {!items.length && !indexLoading ? (
            <div className="ad-empty">
              <b>{labels.palNoMatch}</b>
              {labels.palNoMatchHint}
            </div>
          ) : null}
        </div>

        <p className="ad-sr" aria-live="polite">
          {liveText}
        </p>
        <div className="ad-foot ad-desk-only" aria-hidden="true">
          <span>
            <kbd className="ad-kbd">↑</kbd>
            <kbd className="ad-kbd">↓</kbd>
            {labels.palMove}
          </span>
          <span>
            <kbd className="ad-kbd">⏎</kbd>
            {labels.palOpen}
          </span>
          <span>
            <kbd className="ad-kbd" dir="ltr">
              esc
            </kbd>
            {labels.palClose}
          </span>
        </div>
      </div>
    </div>
  );
}
