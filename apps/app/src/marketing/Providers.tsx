"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { track } from "@/marketing/lib/analytics";
import { capture, initPostHog } from "@/marketing/lib/posthog";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
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
