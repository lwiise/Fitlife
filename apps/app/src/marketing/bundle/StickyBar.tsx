"use client";

import { useEffect, useState } from "react";

import { CHECKOUT_ANCHOR_ID, CONFIG, HERO_CTA_ID } from "@/marketing/bundle/config";
import { cn } from "@/marketing/lib/utils";

// Mobile-only bottom purchase bar. Hidden while the hero CTA is in view (the
// user already has a CTA on screen), sliding in once it scrolls past. Kept
// mounted and moved with a transform so the transition runs both ways; while
// hidden it is inert + aria-hidden so nothing invisible can take focus.
export function StickyBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(HERO_CTA_ID);
    if (!target || !("IntersectionObserver" in window)) {
      // No sentinel/observer support: always show the bar. Deferred a frame
      // so the effect body itself stays setState-free.
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      ([entry]) => setShow(!(entry?.isIntersecting ?? false)),
      { threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={cn(
        "fixed start-0 end-0 bottom-0 z-50 border-t border-border bg-brand-surface-elevated/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(26,16,35,0.08)] backdrop-blur transition-transform duration-300 ease-out will-change-transform md:hidden motion-reduce:transition-none",
        show ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="flex flex-col">
          <s className="text-xs text-brand-ink-muted">
            <span className="sr-only">السعر الأصلي </span>
            <span className="tabular-nums">
              {CONFIG.originalValue.toLocaleString("en-US")}
            </span>{" "}
            ر.س
          </s>
          <span className="text-gold-700 text-xl leading-tight font-extrabold">
            <span className="sr-only">سعر الباقة </span>
            <span className="tabular-nums">{CONFIG.bundlePrice}</span>{" "}
            <span className="text-sm font-bold">ر.س</span>
          </span>
        </p>
        <a
          href={`#${CHECKOUT_ANCHOR_ID}`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-purple-900 px-6 text-base font-bold text-white transition-colors duration-200 hover:bg-brand-purple-700"
        >
          احجزي الآن
        </a>
      </div>
    </div>
  );
}
