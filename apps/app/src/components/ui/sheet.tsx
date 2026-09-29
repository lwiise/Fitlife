"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { trapTab } from "./focusTrap";

const EASE = [0.16, 1, 0.3, 1] as const;

// Scroll lock by attribute + CSS (body[data-sheet-lock] in globals.css), not
// by saving/restoring body's inline overflow: a ConfirmDialog opened from a
// sheet does the inline save/restore itself, and if both unmount in one commit
// the sheet's cleanup runs first, so a second inline restore would leave the
// page stuck. Counted, so a sheet closing while the next opens cannot unlock it.
let locks = 0;
function lockScroll() {
  locks += 1;
  document.body.setAttribute("data-sheet-lock", "");
}
function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.body.removeAttribute("data-sheet-lock");
}

// A ConfirmDialog opened from inside a sheet sits above it: it owns Escape (and
// may be mid-request), moves focus into itself and traps Tab (ConfirmDialog.tsx).
function dialogAbove() {
  return document.querySelector("[data-dialog-root]") !== null;
}

/**
 * A bottom sheet on phones, a centred card from lg up — the plan bar's member
 * switcher, its ••• actions, recipes and Sara's changes. Modal: focus moves in
 * on open, Tab stays inside, Escape and the scrim close, and focus returns to
 * the trigger that opened it (`returnFocusRef`), else to whatever was focused.
 *
 * Known limitation: the phone's back gesture does not close a sheet (no
 * history entry is pushed); it navigates back as it would without one.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  ariaLabel,
  dir,
  lang,
  closeLabel = "إغلاق",
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  /** Rendered as the sheet's <h2>. */
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Accessible name when `title` is not plain text. */
  ariaLabel?: string;
  /** For the housekeeper's translated view; inherits otherwise. */
  dir?: "rtl" | "ltr";
  lang?: string;
  closeLabel?: string;
  /** The trigger that opens this sheet — where focus goes back on close. Safari
   * (and Firefox on macOS) never focus a tapped button, so the element that
   * was focused at open time is <body> there; and a sheet opened from a
   * transient control (the Sara toast) must not hand focus to a node that is
   * about to leave. Read at open time. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const subtitleId = useId();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag to gate createPortal (SSR-safe); runs once
  useEffect(() => setMounted(true), []);

  // An event, not a dependency: callers pass inline arrows, and re-running the
  // effect below on every render would re-focus the close button and forget
  // which element to hand focus back to.
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open || !mounted) return;
    const opener =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    lockScroll();
    closeRef.current?.focus({ preventScroll: true });

    function onKeyDown(e: KeyboardEvent) {
      if (dialogAbove()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      trapTab(e, panelRef.current);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // returnFocusRef is a stable ref object; its .current is read at open time.
  }, [open, mounted, returnFocusRef]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          data-sheet-root=""
          dir={dir}
          lang={lang}
          className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE }}
        >
          <div className="absolute inset-0 bg-brand-ink/40" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabel ? undefined : titleId}
            aria-label={ariaLabel}
            aria-describedby={subtitle ? subtitleId : undefined}
            className="relative w-full max-h-[86dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-brand-card pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl lg:max-w-md lg:rounded-3xl"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE }}
          >
            {/* Pinned, so a long sheet (a day's recipes) never scrolls its
                close button out of reach. */}
            <div className="sticky top-0 z-10 bg-brand-card px-4 pb-2 pt-2">
              <div aria-hidden="true" className="mx-auto h-[5px] w-9 rounded-full bg-brand-ink/15" />
              <div className="mt-2 flex items-start gap-3">
                <div className="min-w-0 flex-1 pt-1.5">
                  <h2 id={titleId} className="text-lg font-extrabold leading-snug text-brand-ink">
                    {title}
                  </h2>
                  {subtitle && (
                    <p id={subtitleId} className="mt-0.5 text-meta text-brand-ink-muted">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label={closeLabel}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-brand-ink transition-colors hover:bg-brand-surface motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="px-2">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
