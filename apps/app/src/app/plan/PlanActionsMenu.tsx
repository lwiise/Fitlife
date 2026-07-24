"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * The «المزيد» overflow menu for the plan header's secondary actions (history,
 * PDF, housekeeper recipes, workout opt-in). Consolidating them keeps the
 * header's action row two controls wide no matter how many secondaries the
 * account qualifies for — the row used to wrap into a pill stack at laptop
 * widths.
 *
 * Deliberately a disclosure, NOT a `role="menu"` widget: the panel holds plain
 * links and buttons, so the native Tab order is the correct interaction model.
 * Announcing `role="menu"` would promise arrow-key navigation this doesn't
 * implement.
 */
export function PlanActionsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Close on an outside press and on Escape. Escape returns focus to the
  // trigger so keyboard users aren't dropped at the top of the document.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="المزيد"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center justify-center size-11 rounded-full border border-brand-ink/10 bg-white text-brand-purple-900 hover:bg-brand-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={panelId}
          aria-label="إجراءات إضافية"
          // Anchored to the trigger's inline-END so the panel opens INWARD over
          // the card; anchoring to inline-start would push it off the card's
          // edge, since the trigger is the row's last control.
          className="absolute top-full end-0 mt-2 z-20 min-w-52 rounded-2xl border border-brand-ink/10 bg-white p-1.5 shadow-[0_10px_28px_rgba(26,16,35,0.14)]"
          // A link navigates away, so dismiss the panel with it. The PDF entry
          // is a <button> that generates for a second or two — it deliberately
          // does NOT match here, so its spinner stays on screen.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Shared row style for the panel's entries — 44px tall, full-width, start-aligned. */
export const PLAN_MENU_ITEM_CLASS =
  "flex w-full items-center gap-2.5 min-h-11 px-3 rounded-xl text-sm font-bold text-brand-ink text-start whitespace-nowrap hover:bg-brand-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900";
