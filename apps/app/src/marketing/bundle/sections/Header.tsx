"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";

import { CONFIG } from "@/marketing/bundle/config";
import { cn } from "@/marketing/lib/utils";

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
          className="inline-flex min-h-11 items-center rounded-md px-1 text-xl font-extrabold text-brand-purple-900"
          aria-label="فت لايف — العودة إلى الأعلى"
        >
          Fit Life
        </a>
        <a
          href={CONFIG.sallaCheckoutUrl}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand-purple-900 px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-purple-700"
        >
          احجزي الباقة
        </a>
      </div>
    </header>
  );
}
