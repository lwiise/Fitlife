"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Trash2, Loader2, TriangleAlert, Ban, ShieldCheck } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import {
  deleteSubscriberAccount,
  setSubscriberActive,
} from "@/app/admin/actions";

/** Submit button that reflects the form action's pending state. */
function PendingSubmit({
  children,
  pendingLabel,
  disabled,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={className}>
      {pending ? (
        <>
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Destructive account controls for the subscriber-detail page (any admin):
 *  - Deactivate / Reactivate — reversible GoTrue ban toggle; deactivating asks a
 *    quick confirm (it blocks login but keeps data).
 *  - Delete — irreversible erasure behind a typed-email confirmation modal.
 * Both submit to server actions, which re-gate (requireAdmin) and refuse to touch
 * an admin account; delete re-verifies the typed email server-side.
 */
export function AccountDangerZone({
  userId,
  email,
  deactivated,
  locale,
}: {
  userId: string;
  email: string | null;
  deactivated: boolean;
  locale: AdminLocale;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag for SSR-safe portal; runs once
  useEffect(() => setMounted(true), []);

  const matches =
    !!email && typed.trim().toLowerCase() === email.trim().toLowerCase();

  function close() {
    setOpen(false);
    setTyped("");
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tm = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(tm);
    };
  }, [open]);

  const toggleBtn =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="rounded-xl border border-red-300 bg-red-50/40 p-4 shadow-sm sm:p-6"
    >
      <h2 id="danger-zone-heading" className="adm-h2 text-red-700">
        {t("danger_zone", locale)}
      </h2>

      {/* Deactivate / Reactivate */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="adm-body font-semibold text-brand-ink">
            {deactivated
              ? t("account_deactivated", locale)
              : t("account_active", locale)}
          </p>
          <p className="adm-micro text-brand-ink-muted">
            {t("deactivate_desc", locale)}
          </p>
        </div>
        <form action={setSubscriberActive}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={deactivated ? "true" : "false"} />
          <PendingSubmit
            pendingLabel={t("saving", locale)}
            className={
              deactivated
                ? `${toggleBtn} border-brand-emerald/40 text-brand-emerald hover:bg-brand-emerald/10 focus-visible:ring-brand-emerald`
                : `${toggleBtn} border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-500`
            }
          >
            {deactivated ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <Ban className="size-4" aria-hidden="true" />
            )}
            {deactivated
              ? t("reactivate_account", locale)
              : t("deactivate_account", locale)}
          </PendingSubmit>
        </form>
      </div>

      {/* Delete */}
      <div className="mt-4 flex flex-col gap-3 border-t border-red-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="adm-micro text-brand-ink-muted">{t("delete_desc", locale)}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${toggleBtn} border-red-600 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t("delete_account", locale)}
        </button>
      </div>

      {mounted &&
        createPortal(
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
                  onClick={close}
                  aria-hidden="true"
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="admin-delete-title"
                  dir={locale === "ar" ? "rtl" : "ltr"}
                  className="relative w-full max-w-md rounded-3xl border border-brand-ink/5 bg-white p-6 shadow-xl md:p-7"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2
                    id="admin-delete-title"
                    className="text-xl font-extrabold leading-tight text-brand-ink"
                  >
                    {t("delete_modal_title", locale)}
                  </h2>

                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-2.5">
                      <TriangleAlert
                        className="mt-0.5 size-5 shrink-0 text-red-600"
                        aria-hidden="true"
                      />
                      <div className="text-sm leading-relaxed text-brand-ink">
                        <p className="font-bold">{t("delete_modal_warn", locale)}</p>
                        <ul className="mt-2 list-disc space-y-1 ps-5 text-brand-ink-muted">
                          <li>{t("delete_item_account", locale)}</li>
                          <li>{t("delete_item_family", locale)}</li>
                          <li>{t("delete_item_plans", locale)}</li>
                          <li>{t("delete_item_billing", locale)}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <form action={deleteSubscriberAccount}>
                    <input type="hidden" name="userId" value={userId} />
                    <label
                      htmlFor="admin-delete-confirm"
                      className="mt-5 block text-sm leading-relaxed text-brand-ink"
                    >
                      {t("delete_confirm_prompt", locale)}
                    </label>
                    <input
                      id="admin-delete-confirm"
                      ref={inputRef}
                      name="confirmEmail"
                      type="email"
                      dir="ltr"
                      autoComplete="off"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={email ?? ""}
                      className="mt-2 w-full rounded-xl border border-brand-ink/10 bg-brand-surface px-4 py-3 text-brand-ink transition-all placeholder:text-brand-ink-muted/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple-900"
                    />

                    <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={close}
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-ink/10 px-5 py-2.5 text-sm font-bold text-brand-ink transition-colors hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        {t("action_cancel", locale)}
                      </button>
                      <PendingSubmit
                        disabled={!matches}
                        pendingLabel={t("deleting", locale)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        {t("delete_confirm_btn", locale)}
                      </PendingSubmit>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </section>
  );
}
