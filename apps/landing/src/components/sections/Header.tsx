"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";

import { CHECKOUT_ANCHOR_ID } from "@/lib/config";
import { cn } from "@/lib/utils";

// Adaptive chrome: transparent light-on-dark over the night hero, then a
// solid surface bar with purple type once the page scrolls.
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 80);
  });

  return (
    <header
      className={cn(
        "fixed start-0 end-0 top-0 z-50 transition-all duration-300 ease-out motion-reduce:transition-none",
        scrolled
          ? "bg-brand-surface/90 py-2 shadow-md backdrop-blur-md"
          : "bg-transparent py-4",
      )}
    >
      <div className="container-page flex items-center justify-between gap-4">
        {/* Checklist: replace the text mark with the real logo asset. */}
        <a
          href="#"
          className={cn(
            "inline-flex min-h-11 items-center rounded-md px-1 text-xl font-extrabold transition-colors duration-300",
            scrolled
              ? "text-brand-purple-900"
              : "text-white focus-visible:outline-white",
          )}
          aria-label="فت لايف — العودة إلى الأعلى"
        >
          Fit Life
        </a>
        <a
          href={`#${CHECKOUT_ANCHOR_ID}`}
          className={cn(
            "inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold transition-colors duration-300",
            scrolled
              ? "bg-brand-purple-900 text-white hover:bg-brand-purple-700"
              : "border border-gold-500/50 text-gold-500 hover:bg-gold-500/10 focus-visible:outline-white",
          )}
        >
          احجزي الباقة
        </a>
      </div>
    </header>
  );
}
