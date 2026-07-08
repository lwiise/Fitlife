"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play, Dumbbell } from "lucide-react";
import type { AnimationItem } from "lottie-web";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Brand-colored exercise form animation. Loads the Lottie player (light SVG
 * build) and the per-exercise JSON lazily — both only mount when a row is
 * expanded, so the plan page pays nothing until a user asks to see a form.
 * Respects prefers-reduced-motion: shows a mid-movement still with a play
 * button instead of auto-looping.
 */
export function ExerciseLottie({
  exerciseId,
  label,
}: {
  exerciseId: string;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
  const [userPlay, setUserPlay] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let anim: AnimationItem | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [player, res] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(`/lottie/exercises/${exerciseId}.json`),
        ]);
        if (!res.ok) throw new Error(`animation ${exerciseId}: ${res.status}`);
        const data = (await res.json()) as unknown;
        if (cancelled) return;
        const autoplay = !reduced || userPlay;
        anim = player.default.loadAnimation({
          container: el,
          renderer: "svg",
          loop: true,
          autoplay,
          animationData: data,
        });
        if (!autoplay) {
          // Freeze on a mid-movement frame — more informative than frame 0.
          anim.goToAndStop(Math.round(anim.totalFrames * 0.42), true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      anim?.destroy();
      el.replaceChildren();
    };
  }, [exerciseId, reduced, userPlay]);

  if (failed) {
    return (
      <div className="flex items-center justify-center aspect-square w-full rounded-2xl bg-brand-surface/60">
        <Dumbbell className="size-8 text-brand-ink-muted/40" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full rounded-2xl bg-white overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" role="img" aria-label={label} />
      {reduced && !userPlay && (
        <button
          type="button"
          onClick={() => setUserPlay(true)}
          aria-label={`تشغيل حركة ${label}`}
          className="absolute inset-0 m-auto size-12 rounded-full bg-brand-purple-900/90 text-white flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
        >
          <Play className="size-5 ms-0.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
