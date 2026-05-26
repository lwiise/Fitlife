"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 3000;

/**
 * Polls plan status while the dashboard shows the "generating" state and
 * refreshes the server component once the plan flips to ready/failed. Renders
 * nothing. Interval is cleaned up on unmount (no double-poll on nav away/back).
 */
export function GeneratingPlanWatcher() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/plans/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string };
        if (active && (body.status === "ready" || body.status === "failed")) {
          clearInterval(poll);
          router.refresh();
        }
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
