"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { drainDeferredMembers } from "@/app/onboarding/actions";

/**
 * Mounted on the post-onboarding read when the page sees a ready plan with
 * pending beneficiaries. Drains them STRICTLY ONE AT A TIME, in add order:
 * whenever no generation is in flight it dispatches the next pending member
 * (drainDeferredMembers picks the first by add order), then refreshes so that
 * member's "preparing" plan surfaces. When that member's run completes
 * (generating flips false again) it dispatches the next — never two at once.
 *
 * Once a dispatch lands ({fired}) or the server reports one in flight
 * ({busy}), the latch stops further dispatch attempts for this effect run —
 * only the refresh poll continues. The latch resets when the server's
 * `generating` prop flips (effect re-runs), which is exactly when the NEXT
 * queued member may dispatch. The DB-level unique index (migration 00012) is
 * the authority if two tabs still race. The parent unmounts this (clearing
 * the poll) once no pending members remain.
 */
export function DeferredMemberDrain({ generating = false }: { generating?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    let dispatched = false;
    const dispatch = () => {
      if (!active || generating || dispatched) return;
      dispatched = true;
      void drainDeferredMembers()
        .then((res) => {
          // Nothing pending / gate not met: allow the next tick to re-check.
          if (active && !res.fired && !res.busy) dispatched = false;
        })
        .catch(() => {
          if (active) dispatched = false;
        });
    };
    // Kick immediately if idle, then keep a tight cadence so each member hands
    // straight into the next with no dead gap.
    dispatch();
    const id = setInterval(() => {
      if (!active) return;
      dispatch();
      router.refresh();
    }, 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [generating, router]);
  return null;
}
