"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Loading state for a workout generation in flight — polls the workout status
 * route (a sibling of the meal one) and reloads when it settles.
 */
export function WorkoutGeneratingState() {
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/plans/workout/status", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { status?: string };
          if (active && (body.status === "ready" || body.status === "failed")) {
            window.location.reload();
            return;
          }
        }
      } catch {
        /* keep polling */
      }
      if (active) setTimeout(tick, 3000);
    };
    const id = setTimeout(tick, 3000);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, []);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4 px-4">
      <Loader2
        className="size-8 animate-spin motion-reduce:animate-none text-brand-purple-900"
        aria-hidden="true"
      />
      <p className="text-brand-ink font-bold text-lg">نحضّر برنامج التمارين…</p>
      <p className="text-brand-ink-muted text-sm">قد يستغرق الأمر دقائق قليلة</p>
    </div>
  );
}
