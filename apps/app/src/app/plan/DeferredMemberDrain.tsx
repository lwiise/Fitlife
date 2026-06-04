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
 * The server busy-guard de-dupes overlapping attempts; the parent unmounts this
 * (clearing the poll) once no pending members remain.
 */
export function DeferredMemberDrain({ generating = false }: { generating?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const attempt = () => {
      if (!active) return;
      // Only dispatch while idle — mid-run the server busy-guard rejects anyway.
      if (!generating) void drainDeferredMembers().catch(() => {});
      router.refresh();
    };
    // Kick immediately if idle, then keep a tight cadence so each member hands
    // straight into the next with no dead gap.
    if (!generating) void drainDeferredMembers().catch(() => {});
    const id = setInterval(attempt, 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [generating, router]);
  return null;
}
