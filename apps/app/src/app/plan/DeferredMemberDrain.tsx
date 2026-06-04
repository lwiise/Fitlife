"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { drainDeferredMembers } from "@/app/onboarding/actions";

/**
 * Mounted on the post-onboarding read when the page sees a ready plan with
 * pending beneficiaries. Once the current generation is done it dispatches the
 * deferred member's generation, then keeps refreshing (every 2s) so the newly
 * dispatched member's "preparing" plan surfaces with no dead gap — handing
 * straight into PlanViewer's own poll once that member's shell lands. The parent
 * unmounts this (clearing the poll) the moment the pending member joins the plan.
 */
export function DeferredMemberDrain({ generating = false }: { generating?: boolean }) {
  const router = useRouter();
  const ran = useRef(false);
  useEffect(() => {
    // Dispatch the drain once the in-flight generation is done — firing mid-run
    // just hits the server busy guard. The ref keeps it to one call per mount;
    // the server guard de-dupes anyway.
    if (!generating && !ran.current) {
      ran.current = true;
      drainDeferredMembers().catch(() => {});
    }
    // Tight refresh so both the current run finishing AND the freshly-dispatched
    // member's row surface fast (no full reload → no white flash).
    const id = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(id);
  }, [generating, router]);
  return null;
}
