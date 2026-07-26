"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics";

/**
 * Landing-page-only effects.
 *
 * initPostHog() and $pageview used to live here. They moved to
 * app/AnalyticsProvider.tsx (mounted from the ROOT layout) when the
 * authenticated funnel was instrumented — the root layout also wraps this
 * marketing group, so keeping them here as well would initialise twice and
 * double-count every landing-page view.
 *
 * What is left is genuinely landing-page-specific: scroll depth only means
 * something on a long marketing page.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const trackedDepths = new Set<number>();
    const depths = [25, 50, 75, 100] as const;

    function handleScroll() {
      const scrolled = window.scrollY;
      const total =
        document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const percent = (scrolled / total) * 100;

      for (const depth of depths) {
        if (percent >= depth && !trackedDepths.has(depth)) {
          trackedDepths.add(depth);
          track("scroll_depth", { depth });
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <>{children}</>;
}
