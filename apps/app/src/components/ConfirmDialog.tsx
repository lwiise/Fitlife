"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";

/**
 * Centered, brand-styled confirmation dialog — replaces native window.confirm.
 * Backdrop + ESC cancel, focus moves to the confirm button on open, body scroll
 * locked while open, motion respects prefers-reduced-motion.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  children,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  isPending = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  /** Optional extra content (e.g. a form) rendered below the body. */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag to gate createPortal (SSR-safe); runs once
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Don't steal focus to the confirm button when there's a form to fill in.
    const t = children ? undefined : setTimeout(() => confirmRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (t) clearTimeout(t);
    };
  }, [open, isPending, onCancel, children]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
        >
          <div
            className="absolute inset-0 bg-brand-ink/50"
            onClick={() => !isPending && onCancel()}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative bg-white rounded-3xl border border-brand-ink/5 shadow-xl w-full max-w-md p-6 md:p-7"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2
              id="confirm-dialog-title"
              className="font-extrabold text-xl text-brand-ink leading-tight"
            >
              {title}
            </h2>
            {body && (
              <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">{body}</p>
            )}

            {children && <div className="mt-4">{children}</div>}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3"
              >
                <p className="text-red-700 text-sm leading-relaxed">{error}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 rounded-full border border-brand-ink/10 text-brand-ink hover:bg-brand-surface text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-full bg-brand-purple-900 hover:bg-brand-purple-700 disabled:bg-brand-purple-900/40 text-white text-sm font-bold transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {isPending && (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
