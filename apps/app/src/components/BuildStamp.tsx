"use client";

import { useEffect } from "react";

// Temporary diagnostic: the SHA this bundle was built from (inlined via
// next.config `env`). Surfaces which build a browser actually loaded so a single
// screenshot resolves "stale bundle vs. real bug". Remove once that's settled.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

export function BuildStamp() {
  useEffect(() => {
    console.info("[build]", BUILD_ID);
  }, []);

  if (BUILD_ID === "dev") return null;

  return (
    <span
      aria-hidden="true"
      className="fixed bottom-2 start-2 z-40 pointer-events-none select-none text-[10px] leading-none text-brand-ink-muted/35 tabular-nums"
    >
      {BUILD_ID.slice(0, 7)}
    </span>
  );
}
