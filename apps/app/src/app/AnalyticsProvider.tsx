"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { capture, initPostHog } from "@/lib/analytics";

/**
 * App-wide analytics host. Zero UI, mounted from the server root layout beside
 * SentryUserSync — the established pattern for a client-side sync component
 * there, and it keeps the root layout free of cookie/session access so public
 * pages stay prerenderable (see SentryUserSync's own note).
 *
 * This exists because PostHog was previously initialised ONLY under
 * app/(marketing), so no authenticated route was measured at all — no signup,
 * no onboarding, no free-path-vs-paid.
 *
 * $pageview lives here rather than in marketing/Providers so it fires exactly
 * once per navigation across the whole app. The root layout also wraps the
 * marketing group, so keeping it in both would double-count the landing page.
 *
 * NOTE: no identify(). Tracking is anonymous by design — see lib/analytics.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    // No-ops unless consent has been granted and a key is configured.
    initPostHog();
  }, []);

  useEffect(() => {
    // Queued until posthog-js lazy-loads, so the first pageview still lands.
    capture("$pageview", { path: pathname });
  }, [pathname]);

  return null;
}
