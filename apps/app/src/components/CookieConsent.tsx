"use client";

import { useEffect, useState } from "react";

import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  track,
} from "@/lib/analytics";
import { CONSENT_ASK_CLASS, CONSENT_ASK_LABEL } from "./consentPlacement";

/**
 * Analytics consent ask — IN the page, never OVER it.
 *
 * This is the THIRD build of this component, and the two before it are the
 * reason it now looks this plain. None of them may come back:
 *
 * 1. A Radix Sheet. That is a modal — overlay, focus trap and
 *    `pointer-events: none` on the body — survivable on a landing page, but it
 *    froze the onboarding wizard 1.5s after load until answered.
 * 2. A `fixed inset-x-0 bottom-0 z-50` bar. Non-modal, so nothing froze — but a
 *    viewport-anchored bar still COVERS the bottom ~170px of the viewport at
 *    EVERY scroll offset, and in this app that band is where the primary control
 *    always sits: «التالي» on every wizard step, the check-in chips on /plan,
 *    the pricing CTAs on `/`. Production QA at 420×900 reported «التالي» as
 *    visible, enabled and stable while every click failed with
 *    "<section aria-label='إعدادات القياس والخصوصية'> intercepts pointer events".
 * 3. Reserving the bar's height via `document.body.style.paddingBottom`, bolted
 *    onto (2). It lengthens the DOCUMENT, so it only guarantees clearance at
 *    MAXIMUM scroll — not where the user is standing mid-form.
 *
 * (2) and (3) together say the geometry was never the problem: any bar of height
 * h covers h pixels of viewport, and Arabic copy that wraps plus 44px tap
 * targets (CLAUDE.md) cannot get below ~90px anyway. So the positioning MODEL
 * changed instead — the ask takes REAL layout space and carries no positioning
 * classes at all (see consentPlacement.ts). Whoever owns the slot decides where
 * it sits: ConsentSlot for the app, the landing page for `/`. An element in
 * normal flow cannot cover a control, at any scroll offset, on any page,
 * including pages nobody has written yet; the worst a wrong slot can now do is
 * look odd.
 *
 * Still non-modal: no focus trap, nothing inert, no `pointer-events` games. And
 * no animation — a slide-in would be a moving target for a finger already on its
 * way to a CTA, which is the same mis-tap this change exists to remove (so there
 * is nothing left for prefers-reduced-motion to gate).
 *
 * Consent stays opt-in — lib/analytics refuses to init until "accepted" — so
 * ignoring this forever simply means never measured, and /settings
 * («القياس والتحسين») can flip the choice at any time afterwards.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Decided at mount, NOT on the old 1.5s timer. The delay was harmless for an
    // overlay and is not for a block in flow: content shifting down 1.5s after
    // paint moves a CTA out from under a finger already descending on it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only localStorage read; [] deps, no render loop
    if (getAnalyticsConsent() === "unset") setOpen(true);
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
    <section aria-label={CONSENT_ASK_LABEL} className={CONSENT_ASK_CLASS}>
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
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
