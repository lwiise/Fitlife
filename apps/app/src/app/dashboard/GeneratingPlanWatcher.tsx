"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { capture } from "@/lib/analytics";

const POLL_INTERVAL_MS = 3000;
// Dedupe key for plan_ready. Three separate pollers hit /api/plans/status and
// one of them does a full window.location.reload(), so an in-memory guard is
// not enough — the same plan would be counted several times and the
// signup → plan_ready rate would read above 100%.
const PLAN_READY_KEY = "fitlife_plan_ready_seen";

function captureOncePerPlan(event: string, planId: string) {
  try {
    if (window.localStorage.getItem(PLAN_READY_KEY) === planId) return;
    window.localStorage.setItem(PLAN_READY_KEY, planId);
  } catch {
    // Storage unavailable (private mode): fall through and capture. A possible
    // duplicate beats losing the event that defines activation.
  }
  capture(event, { plan_id: planId });
}

/**
 * Polls plan status while the dashboard shows the "generating" state and
 * refreshes the server component once the plan flips to ready/failed. Renders
 * nothing. Interval is cleaned up on unmount (no double-poll on nav away/back).
 */
export function GeneratingPlanWatcher() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    // Refresh the server tree only when the plan row actually changed — a day
    // landing rewrites plan_data and bumps updated_at. Blind per-tick refreshes
    // re-rendered the whole dashboard (and re-ran all its queries) every 3s for
    // minutes at a time.
    let lastSeen: string | null = null;
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/plans/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          id?: string;
          status?: string;
          in_progress?: boolean;
          updated_at?: string;
        };
        // Status flips to "ready" on the first (empty) shell, long before the
        // days finish — so don't stop there. Keep polling until generation has
        // truly ended: failed, or ready AND no longer in progress.
        const done =
          body.status === "failed" ||
          (body.status === "ready" && body.in_progress === false);
        if (active && done) {
          clearInterval(poll);
          // The only place in the app with the correct end-of-generation test
          // (`ready` alone flips on the empty shell, minutes early). This is
          // the activation event — everything upstream is just intent.
          if (body.id) {
            captureOncePerPlan(
              body.status === "failed" ? "plan_generation_failed" : "plan_ready",
              body.id,
            );
          }
          router.refresh();
          return;
        }
        const seen = `${body.status}:${body.in_progress}:${body.updated_at}`;
        if (active && lastSeen !== null && seen !== lastSeen) {
          // Pull the freshly-persisted days in as they land (progressive fill).
          router.refresh();
        }
        lastSeen = seen;
      } catch {
        // transient — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [router]);

  return null;
}
