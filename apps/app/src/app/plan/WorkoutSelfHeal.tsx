"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensurePlanWorkouts } from "./actions";

/**
 * Mounted on a ready plan when an opted-in member is missing their exercise
 * WorkoutPlan (e.g. the plan was generated before the workout-attach shipped, or
 * Mom opted in via the post-generation banner). Runs the deterministic, model-free
 * attach ONCE on mount and refreshes if it patched the plan. Idempotent server-side.
 */
export function WorkoutSelfHeal() {
  const router = useRouter();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void ensurePlanWorkouts()
      .then((r) => {
        if (r.changed) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
}
