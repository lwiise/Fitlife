"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { track } from "@/marketing/lib/analytics";
import { initPostHog, posthog } from "@/marketing/lib/posthog";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!posthog?.capture) return;
    try {
      posthog.capture("$pageview", { path: pathname });
    } catch {
      // never break the UX
    }
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
