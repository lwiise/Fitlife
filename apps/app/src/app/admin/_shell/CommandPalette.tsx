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
import { FAMILY_VIEWS, type FamilyView } from "@/lib/admin/console-types";
import { normalizeSearch } from "@/lib/admin/familyList";
import { initialOf } from "../_ui/Avatar";
import { IconBtn } from "../_ui/Button";
import { trapTab, useEscapedKeys } from "../_ui/modalFocus";
import { PALETTE_OPEN_EVENT, requestFamiliesView, requestFamilyOpen } from "./events";
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

type NavFamily = ShellNav["families"][number];

/** A family with its search keys: normalised name + email, lower-cased id. */
interface IndexedFamily extends NavFamily {
  hay: string;
  idKey: string;
}

function buildIndex(families: readonly NavFamily[]): IndexedFamily[] {
  return families.map((f) => ({
    ...f,
    hay: normalizeSearch(`${f.name ?? ""} ${f.email ?? ""}`),
    idKey: f.id.toLowerCase(),
  }));
}

type Item =
  | { kind: "family"; id: string; name: string | null; email: string | null }
  | { kind: "overview" }
  | { kind: "view"; view: FamilyView };

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
 * frame paints; the family list arrives from the layout's promise and the
 * palette says "loading" until it does. Its normalised search index is built
 * lazily — the first time the palette opens with the list in hand, never at
 * page load — and cached in a ref for every re-opening until the list itself
 * changes.
 */
export function CommandPalette({ labels, nav }: { labels: PaletteLabels; nav: NavPromise }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [data, setData] = useState<ShellNav | null | undefined>(undefined);
  // What render reads; set from the cache below when the palette opens.
  const [index, setIndex] = useState<IndexedFamily[] | null>(null);
  const indexCache = useRef<{ source: ShellNav; index: IndexedFamily[] } | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listId = `${baseId}-list`;
  const optionId = useCallback((i: number) => `${baseId}-opt-${i}`, [baseId]);

  /** The search index for this family list — built once, then from the cache. */
  function indexFor(source: ShellNav): IndexedFamily[] {
    const cached = indexCache.current;
    if (cached && cached.source === source) return cached.index;
    const built = buildIndex(source.families);
    indexCache.current = { source, index: built };
    return built;
  }

  // The family list: resolved from the layout's promise (never suspends). The
  // index is only built here when the palette is already open and waiting.
  const onNavData = useEffectEvent((value: ShellNav | null) => {
    setData(value);
    if (open && value) setIndex(indexFor(value));
  });
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

  const q = normalizeSearch(query);
  const matched = useMemo(() => {
    if (!index) return [];
    return q
      ? index.filter((f) => matchesAllTokens(f.hay, q) || (q.length >= 4 && f.idKey.startsWith(q)))
      : index;
  }, [index, q]);

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
  const activeIndex = items.length ? Math.min(active, items.length - 1) : -1;

  const nf = useMemo(
    () => new Intl.NumberFormat(labels.locale === "ar" ? "ar-SA" : "en-US"),
    [labels.locale],
  );

  function openPalette() {
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActive(0);
    if (data) setIndex(indexFor(data));
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
        const current = document.activeElement;
        const lost =
          current == null || current === document.body || current === document.documentElement;
        if (lost && back.isConnected) back.focus({ preventScroll: true });
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
      router.push(familyHref(item.id, wide));
      return;
    }
    if (item.kind === "view") {
      if (onFamilies && requestFamiliesView(item.view)) return;
      router.push(familiesViewHref(item.view));
      return;
    }
    router.push("/admin");
  }

  /** ↑ ↓ move the active option, ⏎ opens it; true when the key was one of them. */
  function listKey(event: { key: string; preventDefault(): void }): boolean {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + step + items.length) % items.length);
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
        if (i !== activeIndex) setActive(i);
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
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
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
                  {labels.palFamilies}
                  {showing ? <small> · {showing}</small> : null}
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
          {data === undefined ? (
            <p className="ad-grp">{labels.palLoading}</p>
          ) : data === null ? (
            <p className="ad-grp">{labels.palUnavailable}</p>
          ) : null}
          {!items.length && data !== undefined ? (
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
