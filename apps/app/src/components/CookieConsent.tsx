"use client";

import { useEffect, useState } from "react";

import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  track,
} from "@/lib/analytics";

/**
 * Analytics consent banner — mounted APP-WIDE from the root layout.
 *
 * Two things changed when the authenticated funnel was instrumented:
 *
 * 1. It moved out of app/(marketing)/layout.tsx. A user who signs up from a
 *    deep link never sees the landing page, so under opt-in consent they could
 *    never be measured at all.
 * 2. It is no longer a Radix Sheet. That is a modal — overlay, focus trap and
 *    `pointer-events: none` on the body — which is survivable on a landing page
 *    but would freeze the onboarding wizard 1.5s after load until answered.
 *    This is a plain non-modal bar: it never steals focus and never blocks a
 *    tap behind it.
 *
 * The choice now actually gates tracking (see lib/analytics). Undecided means
 * NOT tracked.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (getAnalyticsConsent() !== "unset") return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      // Second frame so the enter transition has a start state to animate from.
      requestAnimationFrame(() => setShown(true));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) return null;

  const accept = () => {
    // Consent first: this is what starts the SDK, so the event below is the
    // first thing it sends rather than something dropped on the floor.
    setAnalyticsConsent(true);
    track("cookie_consent_accepted");
    setOpen(false);
  };

  const decline = () => {
    // Deliberately NO event here. Firing one after a refusal was the exact
    // thing the refusal said no to.
    setAnalyticsConsent(false);
    setOpen(false);
  };

  return (
    <section
      aria-label="إعدادات القياس والخصوصية"
      className={`fixed inset-x-0 bottom-0 z-50 p-3 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-lg sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-relaxed text-ink">
          نستخدم أدوات قياس مجهولة الهوية لنعرف أين يتعثّر الاستخدام ونحسّنه. لا
          نقيس بياناتك الصحية، ولا يبدأ القياس قبل موافقتك.
          <a
            href="/privacy"
            className="ms-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            تفاصيل الخصوصية
          </a>
        </p>
        <div className="flex shrink-0 flex-row gap-2">
          <button
            type="button"
            onClick={decline}
            className="min-h-11 min-w-11 rounded-lg px-4 text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            رفض
          </button>
          <button
            type="button"
            onClick={accept}
            className="min-h-11 min-w-11 rounded-lg bg-brand-yellow px-5 text-sm font-bold text-primary transition-colors hover:bg-[#FFC927] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            موافقة
          </button>
        </div>
      </div>
    </section>
  );
}
