"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  type ConsentState,
} from "@/lib/analytics";
import { isMeasurementOn } from "@/components/consentPlacement";
import { genderPick } from "@/lib/copy/gender";

/**
 * Permanent way back to the measurement choice.
 *
 * The ask used to be a `fixed bottom-0` bar that stayed glued to the viewport
 * until answered; it is now a one-time block in the page flow (that bar covered
 * the primary CTA — see CookieConsent). A block can be scrolled past, so without
 * this card "ask non-intrusively" would quietly mean "ask once, ever" — and a
 * refusal would be irreversible.
 */
export function PrivacyChoiceCard({ ownerSex }: { ownerSex?: string | null }) {
  const g = genderPick(ownerSex);
  const [state, setState] = useState<ConsentState>("unset");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only localStorage read; [] deps, no render loop
    setState(getAnalyticsConsent());
  }, []);

  const on = isMeasurementOn(state);

  const toggle = () => {
    setAnalyticsConsent(!on);
    setState(on ? "declined" : "accepted");
  };

  return (
    <section className="bg-white rounded-2xl border border-brand-ink/5 p-6 md:p-7">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-10 rounded-full bg-brand-lavender/30 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="size-5 text-brand-purple-900" aria-hidden="true" />
        </div>
        <h2 className="font-bold text-lg text-brand-ink">القياس والتحسين</h2>
      </div>

      <p className="text-brand-ink-muted text-sm leading-relaxed">
        {on
          ? "القياس مفعّل. نجمع إحصاءات مجهولة الهوية عن الاستخدام وحده، ولا نقيس بياناتك الصحية."
          : "القياس متوقف. لا نجمع أي إحصاءات عن استخدامك."}
      </p>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        className="mt-4 min-h-11 rounded-xl border-2 border-brand-purple-900 px-5 text-sm font-bold text-brand-purple-900 transition-colors hover:bg-brand-purple-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {on ? g("أوقفي القياس", "أوقف القياس") : g("فعّلي القياس", "فعّل القياس")}
      </button>
    </section>
  );
}
