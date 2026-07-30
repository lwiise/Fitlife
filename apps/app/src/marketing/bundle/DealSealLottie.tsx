"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AnimationItem } from "lottie-web";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * «ختم الصفقة» — the closing section's animation.
 *
 * Nothing is fetched until the section is within a screen of the viewport:
 * the player (lottie-web's light SVG build) and the ~20 KB JSON both arrive
 * through one lazy `import()` / `fetch()` pair, so the page's initial load is
 * unchanged. The box holds its aspect ratio from the first paint, so a slow or
 * failed load costs no layout shift — and on this section's night field an
 * empty box is simply invisible.
 *
 * Reduced motion gets the finished frame rather than the loop: the seal is
 * already stamped, which is the whole point of the illustration.
 */
export function DealSealLottie() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );

  // Gate the download on proximity, not on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      // No observer support: load anyway, deferred a frame so the effect body
      // itself stays setState-free (same shape as StickyBar's fallback).
      const raf = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !near) return;
    let anim: AnimationItem | null = null;
    let cancelled = false;

    (async () => {
      try {
        const [player, res] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch("/lottie/deal-seal.json"),
        ]);
        if (!res.ok) throw new Error(`deal-seal: ${res.status}`);
        const data = (await res.json()) as unknown;
        if (cancelled) return;
        anim = player.default.loadAnimation({
          container: el,
          renderer: "svg",
          loop: !reduced,
          autoplay: !reduced,
          animationData: data,
        });
        if (reduced) {
          // The stamped frame — the story's end state, held still.
          anim.goToAndStop(Math.round(anim.totalFrames * 0.72), true);
        }
      } catch {
        // Decorative: a failure leaves the reserved box empty and the section
        // otherwise intact. Nothing to report to the visitor.
      }
    })();

    return () => {
      cancelled = true;
      anim?.destroy();
      el.replaceChildren();
    };
  }, [near, reduced]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="رسم متحرك: فاتورة الباقة تكتمل سطراً بسطر ثم يُختم عليها بختم ذهبي"
      className="mx-auto aspect-square w-full max-w-sm lg:max-w-xl"
    />
  );
}
