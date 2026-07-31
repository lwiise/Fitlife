"use client";

import { usePathname } from "next/navigation";

import { CookieConsent } from "@/components/CookieConsent";
import { shouldRenderConsentInAppSlot } from "@/components/consentPlacement";

/**
 * App-wide slot for the analytics consent ask, mounted from the root layout
 * ABOVE {children} — beside AnalyticsProvider/SentryUserSync, the established
 * "client host in the server root layout" idiom here.
 *
 * The ask owns no positioning any more (see CookieConsent's header: as a
 * `fixed bottom-0` bar it covered the primary CTA at every scroll offset), so
 * something has to place it. First block of the document means it is on screen
 * at scroll 0 of whatever page the user landed on — /auth/signup,
 * /onboarding/*, /dashboard, /plan — and in-app headers are in-flow
 * `sticky top-0`, so they are pushed down by it rather than covering it.
 *
 * Reach is unchanged from the old bar (a deep-link signup never sees `/`, and
 * under opt-in consent that would mean never measured) — only the positioning
 * model changed. Routes that place the ask inside their own flow are listed in
 * consentPlacement.ts, which is the one place to record a new one.
 */
export function ConsentSlot() {
  const pathname = usePathname();
  if (!shouldRenderConsentInAppSlot(pathname)) return null;
  return <CookieConsent />;
}
