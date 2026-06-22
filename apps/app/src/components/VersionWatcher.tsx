"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

// The SHA this bundle was built from (inlined at build time via next.config `env`).
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const POLL_MS = 5 * 60_000;

/**
 * Detects when a newer build is deployed while this tab stays open (Netlify serves
 * /_next/static immutable, so an open App-Router tab keeps its old chunks until a
 * full reload — which has made shipped fixes look broken). Polls /api/version on
 * mount, on focus/visibility, and every few minutes; when the live SHA differs from
 * this bundle's, it offers a calm refresh. Never auto-reloads — won't interrupt a
 * plan that's mid-generation.
 */
export function VersionWatcher() {
  const [latest, setLatest] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    // Local/CI builds have no real SHA — nothing meaningful to compare against.
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
    const id = setInterval(check, POLL_MS);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      clearInterval(id);
    };
  }, []);

  const updateAvailable =
    latest !== null && latest !== BUILD_ID && latest !== dismissed;

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 w-full max-w-md sm:w-auto rounded-2xl border border-brand-ink/10 bg-white ps-3 pe-1.5 py-2 shadow-lg shadow-brand-ink/10 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out">
        <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-lavender/40">
          <Sparkles className="size-4 text-brand-purple-900" aria-hidden="true" />
        </span>
        <p className="flex-1 text-brand-ink text-sm font-medium leading-relaxed">
          فيه نسخة جديدة من التطبيق
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-full bg-brand-purple-900 hover:bg-brand-ink text-white font-bold text-sm px-4 min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          حدّثي الصفحة
        </button>
        <button
          type="button"
          onClick={() => setDismissed(latest)}
          aria-label="إغلاق"
          className="inline-flex size-11 flex-shrink-0 items-center justify-center rounded-full text-brand-ink-muted hover:text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
