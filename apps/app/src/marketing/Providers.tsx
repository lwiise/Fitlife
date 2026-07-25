"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { track } from "@/marketing/lib/analytics";
import { readConsent } from "@/marketing/lib/consent";
import { capture, disableTracking, initPostHog } from "@/marketing/lib/posthog";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Only load PostHog for a visitor who has actually accepted. Undecided
    // visitors stay un-initialized until the banner's accept handler inits;
    // a declined visitor drops the queue so nothing is captured later.
    const consent = readConsent();
    if (consent === "accepted") initPostHog();
    else if (consent === "declined") disableTracking();
  }, []);

  useEffect(() => {
    // Queued until posthog-js lazy-loads, so the first pageview still lands.
    capture("$pageview", { path: pathname });
  }, [pathname]);

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
