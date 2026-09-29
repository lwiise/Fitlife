"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import type { WeekChange } from "@fitlife/plan-engine";
import { SaraAvatar } from "@/components/ui/SaraAvatar";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import {
  hashChanges,
  isOpened,
  moreChangesAr,
  saraSeenStore,
  shouldToast,
  unreadDot,
  withToasted,
  type SaraSeenSnapshot,
} from "@/lib/plans/saraSeen";

export { useSaraUnread } from "./useSaraUnread";

const EASE = [0.16, 1, 0.3, 1] as const;
const SHOW_DELAY_MS = 800;
const VISIBLE_MS = 10_000;
// "Seen" means actually on screen for a moment, not flashed during a
// navigation away.
const TOASTED_AFTER_MS = 1_000;
// After a pause, never vanish the instant the finger lifts.
const RESUME_FLOOR_MS = 2_000;

function subscribeVisibility(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

// Never used in practice (the toast renders only after mount), but storage
// must not be touched on the server.
const SERVER_SNAPSHOT: SaraSeenSnapshot = { persistent: false, seen: null };
const serverSnapshot = () => SERVER_SNAPSHOT;

function recordToasted(week: string) {
  saraSeenStore.update((seen) => withToasted(seen, week));
}

type Props = {
  changes: ReadonlyArray<WeekChange>;
  /** week_start_date — the toast is once per plan week, not per plan row. */
  weekStart: string;
  ownerSex: string | null | undefined;
  /** Open «ما عدّلته سارة هذا الأسبوع». The toast dismisses itself first. */
  onView: () => void;
  /** A sheet or dialog is open: stay hidden (and paused) until it closes. */
  blocked: boolean;
  /** The ••• dot's value, reported after mount and on every change. */
  onSeenChange?: (unread: boolean) => void;
};

/**
 * «سارة عدّلت خطتكِ» — once per plan week, a quiet note above the tab bar that
 * her plan adapted, with the way into the full sheet. Never modal and never
 * takes focus: it waits out any open sheet, pauses while touched, hovered or
 * focused, and leaves on its own after ten seconds on screen.
 *
 * Portaled to <body> so an ancestor's transform can never turn `fixed` into
 * "fixed to the card". Positioned by `.plan-toast-pos`, which clears the tab
 * bar and the «وضع الاختبار» badge — deliberately NOT `data-float-bottom`,
 * whose more specific rule would pull it back down onto the badge.
 */
export function SaraToast(props: Props) {
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag to gate createPortal (SSR-safe); runs once
  useEffect(() => setMounted(true), []);

  if (!mounted || props.changes.length === 0) return null;
  // Keyed on the week: a plan that rolls into a new week mid-visit is a new
  // toast with fresh timers, not the old one's leftovers.
  return createPortal(<WeekToast key={props.weekStart} {...props} />, document.body);
}

function WeekToast({ changes, weekStart, ownerSex, onView, blocked, onSeenChange }: Props) {
  const g = genderPick(ownerSex);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  const shown = changes.slice(0, 3);
  const first = shown[0];
  const more = moreChangesAr(shown.length, arNum);
  const hash = hashChanges(changes);
  const heading = g("سارة عدّلت خطتكِ", "سارة عدّلت خطتك");

  const snap = useSyncExternalStore(saraSeenStore.subscribe, saraSeenStore.load, serverSnapshot);
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );

  const [armed, setArmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  // Opening the sheet from ••• while this is up retires it too.
  const opened = isOpened(snap.seen, weekStart, hash);
  const show = armed && !dismissed && !opened && !blocked && pageVisible;
  const running = show && !hovered && !focusInside;

  // The live region speaks ONCE: filled on the first show and kept while the
  // toast is merely waiting out a sheet or a hidden tab, because refilling it
  // when the toast comes back would announce the same note a second time.
  // (Render-phase adjust, like the viewers' prop resyncs.)
  const [announced, setAnnounced] = useState(false);
  if (show && !announced) setAnnounced(true);

  // Decided once, after hydration: storage is browser-only.
  useEffect(() => {
    if (!shouldToast(saraSeenStore.load().seen, weekStart)) return;
    const id = window.setTimeout(() => setArmed(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [weekStart]);

  // Ten seconds of time actually on screen and unattended: the clock stops
  // while she is touching, hovering or focused inside, and while a sheet or a
  // hidden tab keeps the toast off screen.
  const remaining = useRef(VISIBLE_MS);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const id = window.setTimeout(
      () => setDismissed(true),
      Math.max(remaining.current, RESUME_FLOOR_MS),
    );
    return () => {
      window.clearTimeout(id);
      remaining.current -= Date.now() - started;
    };
  }, [running]);

  // Without storage the in-memory record is what holds this to one toast per
  // page session, so it is written the moment the toast shows.
  const toasted = useRef(false);
  useEffect(() => {
    if (!show || toasted.current) return;
    const id = window.setTimeout(
      () => {
        toasted.current = true;
        recordToasted(weekStart);
      },
      saraSeenStore.load().persistent ? TOASTED_AFTER_MS : 0,
    );
    return () => window.clearTimeout(id);
  }, [show, weekStart]);

  const reportSeen = useEffectEvent((unread: boolean) => onSeenChange?.(unread));
  const unread = unreadDot(snap, weekStart, hash);
  useEffect(() => {
    reportSeen(unread);
  }, [unread]);

  // Where focus was before it entered the toast, to hand it back on dismiss
  // instead of dropping it on <body> as the toast leaves.
  const returnFocus = useRef<HTMLElement | null>(null);

  function dismiss() {
    // Closing it is proof she saw it, however quickly.
    if (!toasted.current) {
      toasted.current = true;
      recordToasted(weekStart);
    }
    const root = rootRef.current;
    const back = returnFocus.current;
    if (root?.contains(document.activeElement) && back?.isConnected) {
      back.focus({ preventScroll: true });
    }
    setDismissed(true);
  }

  function onFocus(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    returnFocus.current = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
    setFocusInside(true);
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    dismiss();
  }

  if (!first) return null;

  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 };

  return (
    <>
      {/* Present and empty from mount, filled when the toast first shows: a
          live region that arrives already holding its text is not announced.
          Emptied for good once it is dismissed or opened — a removal, which a
          polite region does not speak. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announced && !dismissed && !opened
          ? `${heading}: ${first.change_ar}${more ? ` ${more}` : ""}`
          : ""}
      </div>
      <AnimatePresence
        // A pointer or focus that was inside when a sheet hid the toast never
        // sent its leave/blur; without this the clock would stay paused.
        onExitComplete={() => {
          setHovered(false);
          setFocusInside(false);
        }}
      >
        {show && (
          <motion.div
            ref={rootRef}
            key="sara-toast"
            className="plan-toast-pos fixed inset-x-4 z-[45] mx-auto flex min-h-16 max-w-[440px] items-center gap-3 rounded-2xl bg-brand-ink py-1.5 ps-3 pe-1.5 text-white shadow-[0_12px_28px_-12px_rgb(26_16_35/0.5)] print:hidden"
            initial={hidden}
            animate={{ opacity: 1, y: 0 }}
            exit={hidden}
            transition={{ duration: 0.22, ease: EASE }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onTouchStart={() => setHovered(true)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          >
            <SaraAvatar size={40} />
            <div className="min-w-0 flex-1 py-1">
              <p className="text-[15px] font-extrabold leading-snug">{heading}</p>
              <p className="flex min-w-0 gap-1 text-meta text-brand-lavender">
                <span className="truncate">{first.change_ar}</span>
                {more && <span className="shrink-0">{more}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                dismiss();
                onView();
              }}
              aria-label="عرض تعديلات سارة"
              className="min-h-11 shrink-0 rounded-full bg-brand-lavender px-4 text-sm font-extrabold text-brand-ink transition-colors hover:bg-brand-card motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink"
            >
              عرض
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="إغلاق"
              className="grid size-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lavender"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
