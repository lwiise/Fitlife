"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// A dashboard tab left open never refetches on its own: marks made on /plan
// (or on the phone) revalidate the route cache, but that only applies on the
// NEXT navigation — the already-rendered board just sits stale. Refresh the
// server components whenever the user comes back to this tab (visibility /
// focus / bfcache restore), throttled so rapid alt-tabbing doesn't hammer
// the server. Renders nothing.

const REFRESH_THROTTLE_MS = 10_000;

export function RefreshOnFocus() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt.current < REFRESH_THROTTLE_MS) return;
      lastRefreshAt.current = now;
      router.refresh();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, [router]);

  return null;
}
