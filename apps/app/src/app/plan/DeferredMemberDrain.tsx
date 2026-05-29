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
export function DeferredMemberDrain() {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    drainDeferredMembers()
      .then((r) => {
        if (r.fired) window.location.reload();
      })
      .catch(() => {});
  }, []);
  return null;
}
