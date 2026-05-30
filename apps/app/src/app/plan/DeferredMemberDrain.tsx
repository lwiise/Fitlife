"use client";

import { useEffect, useRef } from "react";
import { drainDeferredMembers } from "@/app/onboarding/actions";

/**
 * Mounted on the post-onboarding read (only when the page already sees a ready
 * plan with pending beneficiaries). On mount it asks the server to drain any
 * deferred members; if a generation actually fired, it reloads so the page picks
 * up the new "generating" state (and the generating-state poller then reloads
 * again into the full family). All guards live server-side in drainDeferredMembers;
 * this just fires once per mount and reloads when something happened.
 */
export function DeferredMemberDrain({ generating = false }: { generating?: boolean }) {
  const ran = useRef(false);
  useEffect(() => {
    // Wait for the in-flight generation to finish — firing mid-run just hits the
    // busy guard and wastes our one shot. When `generating` flips false (the RSC
    // re-renders via the page's poll/refresh), this effect re-runs and drains the
    // queued member, then reloads into its "generating" state.
    if (generating || ran.current) return;
    ran.current = true;
    drainDeferredMembers()
      .then((r) => {
        if (r.fired) window.location.reload();
      })
      .catch(() => {});
  }, [generating]);
  return null;
}
