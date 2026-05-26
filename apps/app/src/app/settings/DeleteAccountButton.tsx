"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Trash2, Loader2, TriangleAlert } from "lucide-react";

export function DeleteAccountButton({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  const matches = typed.trim().toLowerCase() === userEmail.trim().toLowerCase();

  function close() {
    if (isDeleting) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  // ESC to cancel; lock body scroll while open; focus the input on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleConfirm() {
    if (!matches || isDeleting) return;
    setError(null);
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (res.ok) {
        window.location.href = "/auth/login?deleted=1";
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "حدث خطأ في حذف حسابك. حاولي مرة ثانية");
      setIsDeleting(false);
    } catch {
      setError("تعذّر الاتصال. تأكدي من اتصالك وحاولي مرة ثانية");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 min-h-11 px-5 py-2.5 rounded-full border border-red-300 text-red-700 hover:bg-red-50 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        حذف حسابي
      </button>

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
                  aria-labelledby="delete-account-title"
                  className="relative bg-white rounded-3xl border border-brand-ink/5 shadow-xl w-full max-w-md p-6 md:p-7"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2
                    id="delete-account-title"
                    className="font-extrabold text-xl text-brand-ink leading-tight"
                  >
                    حذف حسابك بشكل نهائي
                  </h2>

                  <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-4">
                    <div className="flex items-start gap-2.5">
                      <TriangleAlert
                        className="size-5 text-red-600 flex-shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="text-sm text-brand-ink leading-relaxed">
                        <p className="font-bold">هذي العملية لا يمكن التراجع عنها. سيتم حذف:</p>
                        <ul className="mt-2 space-y-1 list-disc ps-5 text-brand-ink-muted">
                          <li>بياناتك الشخصية</li>
                          <li>كل أفراد عائلتك</li>
                          <li>كل خططك الغذائية وسجل التوليد</li>
                          <li>اشتراكك الحالي سيتم إلغاؤه (بدون استرداد)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <label
                    htmlFor="delete-confirm-email"
                    className="block mt-5 text-sm text-brand-ink leading-relaxed"
                  >
                    لتأكيد الحذف، اكتبي بريدك الإلكتروني في الحقل أدناه:
                  </label>
                  <input
                    id="delete-confirm-email"
                    ref={inputRef}
                    type="email"
                    dir="ltr"
                    autoComplete="off"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={userEmail}
                    disabled={isDeleting}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-brand-surface text-brand-ink placeholder:text-brand-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-purple-900 focus:border-transparent transition-all disabled:opacity-50"
                  />

                  {error && (
                    <p role="alert" className="mt-3 text-red-700 text-sm leading-relaxed">
                      {error}
                    </p>
                  )}

                  <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={close}
                      disabled={isDeleting}
                      className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 rounded-full border border-brand-ink/10 text-brand-ink hover:bg-brand-surface text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={!matches || isDeleting}
                      className="inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2.5 rounded-full bg-red-600 text-white hover:bg-red-700 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {isDeleting && (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      )}
                      {isDeleting ? "جاري الحذف…" : "حذف نهائي"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
