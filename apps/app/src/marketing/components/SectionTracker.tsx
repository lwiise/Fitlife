"use client";

import { useEffect, useRef } from "react";

import { track } from "@/marketing/lib/analytics";

export function SectionTracker({
  section,
  children,
}: {
  section: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (!ref.current || tracked.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.5 &&
            !tracked.current
          ) {
            tracked.current = true;
            track("section_viewed", { section });
          }
        });
      },
      { threshold: 0.5 },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [section]);

  return <div ref={ref}>{children}</div>;
}
