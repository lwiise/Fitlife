"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

/**
 * «أضيفي فت لايف لشاشتك» — quiet home-screen install nudge. A mobile-web
 * product with no push channel lives or dies by whether the icon is on her
 * phone; the installed standalone app is also the prerequisite for iOS web
 * push later.
 *
 * Behavior by platform:
 *  - Chromium/Android: captures `beforeinstallprompt` and triggers the native
 *    prompt on tap.
 *  - iOS Safari: no install API exists — shows the share-sheet instruction
 *    instead (detected via platform sniff, hidden when already standalone).
 * Dismissal persists in localStorage for 30 days — the nudge must never
 * become a nag.
 */

const DISMISS_KEY = "fitlife-install-dismissed-at";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isRecentlyDismissed(): boolean {
  try {
    const at = localStorage.getItem(DISMISS_KEY);
    if (!at) return false;
    return Date.now() - Number(at) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's non-standard flag for installed web apps.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (isStandalone() || isRecentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("native");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only platform detection; UA is unavailable during SSR
      setMode("ios");
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private browsing — the nudge simply reappears next visit.
    }
    setMode("hidden");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setMode("hidden");
    else dismiss();
  }

  return (
    <div className="rounded-2xl border border-brand-ink/10 bg-white px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
      <Smartphone
        className="size-5 text-brand-purple-900 flex-shrink-0"
        aria-hidden="true"
      />
      <p className="flex-1 min-w-40 text-sm font-medium text-brand-ink leading-relaxed">
        {mode === "native"
          ? "أضيفي فت لايف لشاشتك — خطتك على بُعد لمسة كل يوم."
          : "أضيفي فت لايف لشاشتك: من زر المشاركة في المتصفح اختاري «إضافة إلى الشاشة الرئيسية»."}
      </p>
      {mode === "native" && (
        <button
          type="button"
          onClick={install}
          className="flex-shrink-0 inline-flex items-center justify-center min-h-11 px-5 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          إضافة الآن
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="إخفاء"
        className="flex-shrink-0 size-11 inline-flex items-center justify-center rounded-full text-brand-ink-muted hover:bg-brand-lavender/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
