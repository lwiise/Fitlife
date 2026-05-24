"use client";

import { useEffect } from "react";
import { isValidTier } from "@/lib/tierIntent";

// When the user arrives from a landing tier CTA (?tier=…), scroll that card into
// view and briefly highlight it. Uses an inline box-shadow ring rather than
// Tailwind classes — runtime-added classes get purged by the JIT compiler.
const RING = "0 0 0 2px #4E2490, 0 0 0 6px rgba(78, 36, 144, 0.15)";

export function PreselectionScroll({ tier }: { tier?: string }) {
  useEffect(() => {
    if (!isValidTier(tier)) return;
    const el = document.getElementById(`tier-card-${tier}`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prevTransition = el.style.transition;
    el.style.transition = "box-shadow 0.3s ease-out";
    el.style.boxShadow = RING;

    const timer = setTimeout(() => {
      el.style.boxShadow = "";
      el.style.transition = prevTransition;
    }, 2500);

    return () => clearTimeout(timer);
  }, [tier]);

  return null;
}
