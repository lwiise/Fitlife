"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";

// The SHA this bundle was built from (inlined at build time via next.config `env`).
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const POLL_MS = 5 * 60_000;
const SAFE_CHECK_MS = 1500;
const RELOAD_NOTICE_MS = 1500;
const RELOAD_GUARD_KEY = "vw:auto-reloaded-for";

// Safe to auto-reload only when the user isn't mid-interaction: tab visible, no
// focused form control, and no open dialog/modal (e.g. the regenerate popup or an
// onboarding/profile form). Avoids yanking the page out from under typing/editing.
function isSafeToReload(): boolean {
  if (document.visibilityState !== "visible") return false;
  const el = document.activeElement as HTMLElement | null;
  if (el) {
    const tag = el.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable
    )
      return false;
  }
  if (document.querySelector('[role="dialog"],[aria-modal="true"],dialog[open]'))
    return false;
  return true;
}

/**
 * Detects when a newer build is deployed while this tab stays open (Netlify serves
 * /_next/static immutable, so an open App-Router tab keeps its old chunks until a
 * full reload — which has made shipped fixes look broken). Polls /api/version on
 * mount, on focus/visibility, and every few minutes; when the live SHA differs from
 * this bundle's, it reloads the page as soon as it's SAFE (no typing / no open
 * dialog), falling back to a manual "refresh" prompt while the user is busy.
 */
export function VersionWatcher() {
  const [latest, setLatest] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  // Learn the currently-deployed build SHA.
  useEffect(() => {
    if (BUILD_ID === "dev") return;
    let active = true;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (active && buildId && buildId !== "dev") setLatest(buildId);
      } catch {
        /* offline / transient — try again next cycle */
      }
    };
    void check();
    const onWake = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    const id = window.setInterval(check, POLL_MS);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.clearInterval(id);
    };
  }, []);

  const updateAvailable =
    latest !== null && latest !== BUILD_ID && latest !== dismissed;

  // Arm the auto-reload: once a newer build is live, flip into "reloading" as soon
  // as it's safe. setState runs only inside the interval callback (never directly
  // in the effect body) per the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    if (!updateAvailable || reloading) return;
    const id = window.setInterval(() => {
      if (isSafeToReload()) setReloading(true);
    }, SAFE_CHECK_MS);
    return () => window.clearInterval(id);
  }, [updateAvailable, reloading]);

  // Show a brief "updating" notice, then reload — guarded against a reload loop.
  useEffect(() => {
    if (!reloading || !latest) return;
    const t = window.setTimeout(() => {
      if (!isSafeToReload()) {
        setReloading(false); // became busy — fall back to the manual prompt
        return;
      }
      try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY) === latest) {
          setReloading(false); // already auto-reloaded for this build — don't loop
          return;
        }
        sessionStorage.setItem(RELOAD_GUARD_KEY, latest);
      } catch {
        /* sessionStorage unavailable (private mode) — proceed without the guard */
      }
      window.location.reload();
    }, RELOAD_NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [reloading, latest]);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 w-full max-w-md sm:w-auto rounded-2xl border border-brand-ink/10 bg-white ps-3 pe-1.5 py-2 shadow-lg shadow-brand-ink/10 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out">
        <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-lavender/40">
          {reloading ? (
            <RefreshCw
              className="size-4 text-brand-purple-900 motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Sparkles className="size-4 text-brand-purple-900" aria-hidden="true" />
          )}
        </span>
        <p className="flex-1 text-brand-ink text-sm font-medium leading-relaxed">
          {reloading
            ? "نحدّث التطبيق للنسخة الأحدث…"
            : "فيه نسخة جديدة من التطبيق"}
        </p>
        {!reloading && (
          <>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-full bg-brand-purple-900 hover:bg-brand-ink text-white font-bold text-sm px-4 min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              حدّثي الآن
            </button>
            <button
              type="button"
              onClick={() => setDismissed(latest)}
              aria-label="إغلاق"
              className="inline-flex size-11 flex-shrink-0 items-center justify-center rounded-full text-brand-ink-muted hover:text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
