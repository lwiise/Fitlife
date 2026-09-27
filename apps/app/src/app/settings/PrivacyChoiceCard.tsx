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
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

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
    <Card aria-labelledby="privacy-choice-title">
      <CardHeader
        id="privacy-choice-title"
        title="القياس والتحسين"
        icon={<BarChart3 className="size-5 text-brand-purple-900" aria-hidden="true" />}
      />

      <p className="text-[15px] leading-relaxed text-brand-ink-muted">
        {on
          ? "القياس مفعّل. نجمع إحصاءات مجهولة الهوية عن الاستخدام وحده، ولا نقيس بياناتك الصحية."
          : "القياس متوقف. لا نجمع أي إحصاءات عن استخدامك."}
      </p>

      <Button variant="secondary" onClick={toggle} aria-pressed={on} className="mt-4">
        {on ? g("أوقفي القياس", "أوقف القياس") : g("فعّلي القياس", "فعّل القياس")}
      </Button>
    </Card>
  );
}
