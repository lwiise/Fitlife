"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Mounted only when the plan page is about to block a user behind the
 * "subscribe to unlock these members" banner. Once per load, it asks the
 * server to reconcile the subscription directly with Lemonsqueezy (a missed
 * webhook leaves a paid user looking un-subscribed). If that activates the
 * subscription, refresh so the banner gives way to the normal generation flow.
 *
 * Safe against loops: it only refreshes when reconciliation flips the row to
 * active, and an active row no longer renders this component on the next pass.
 */
export function SubscriptionSelfHeal() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const res = await fetch("/api/subscription/reconcile", {
          method: "POST",
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as { active?: boolean };
        if (body.active) router.refresh();
      } catch {
        // best-effort — leave the banner as the fallback
      }
    })();
  }, [router]);

  return null;
}
