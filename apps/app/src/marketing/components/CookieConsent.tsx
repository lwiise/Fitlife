"use client";

import { useEffect, useState } from "react";

import { Sheet, SheetContent } from "@/marketing/components/ui/sheet";
import { track } from "@/marketing/lib/analytics";

const CONSENT_KEY = "fitlife_cookie_consent";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored) return;

    const timer = window.setTimeout(() => setOpen(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const accept = () => {
    window.localStorage.setItem(CONSENT_KEY, "accepted");
    track("cookie_consent_accepted");
    setOpen(false);
  };

  const decline = () => {
    window.localStorage.setItem(CONSENT_KEY, "declined");
    track("cookie_consent_declined");
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[40vh] max-w-3xl rounded-t-2xl bg-surface"
      >
        <div className="flex flex-row items-center justify-between gap-3 p-3 md:p-4">
          <p className="flex-1 text-xs leading-snug text-ink text-center sm:text-sm md:text-start">
            نستخدم ملفات تعريف الارتباط لتحسين تجربتك. بالاستمرار، توافقين على ذلك.
            <a
              href="/privacy"
              className="ms-1 font-medium text-primary hover:underline"
            >
              المزيد
            </a>
          </p>
          <div className="flex shrink-0 flex-row gap-2">
            <button
              type="button"
              onClick={decline}
              className="min-h-11 rounded-lg px-3 text-xs font-medium text-ink-muted transition-colors hover:text-ink sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              رفض
            </button>
            <button
              type="button"
              onClick={accept}
              className="min-h-11 rounded-lg bg-brand-yellow px-4 text-xs font-bold text-primary transition-colors hover:bg-[#FFC927] sm:text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              قبول
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
