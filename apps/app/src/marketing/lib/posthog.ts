// TODO: Replace NEXT_PUBLIC_POSTHOG_KEY in .env.local with real key from posthog.com dashboard before launch.
import type { PostHog } from "posthog-js";

// posthog-js is ~50KB gz — far too heavy for the landing page's critical
// bundle. It is dynamic-imported here after the page goes idle; events fired
// before it loads are queued (bounded) and flushed on load, so early CTA
// clicks are never lost.

let client: PostHog | null = null;
let loadStarted = false;
// null = tracking disabled (no key) or already flushed; array = queue until load.
let pending: Array<{ event: string; props?: Record<string, unknown> }> | [] | null =
  [];
const MAX_QUEUE = 20;

export function initPostHog() {
  if (typeof window === "undefined" || loadStarted) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || key === "phc_YOUR_KEY_HERE") {
    console.warn("PostHog key missing or placeholder. Tracking disabled.");
    pending = null;
    loadStarted = true;
    return;
  }
  loadStarted = true;

  const load = () => {
    import("posthog-js")
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) {
          posthog.init(key, {
            api_host:
              process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
            person_profiles: "identified_only",
            capture_pageview: false,
            capture_pageleave: true,
          });
        }
        client = posthog;
        for (const q of pending ?? []) {
          try {
            client.capture(q.event, q.props);
          } catch {
            // never break the UX
          }
        }
        pending = null;
      })
      .catch(() => {
        // Network/adblock — tracking silently disabled.
        pending = null;
      });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(load, { timeout: 4000 });
  } else {
    window.setTimeout(load, 2000);
  }
}

/** Capture an event now if PostHog is loaded, else queue it until it is. */
export function capture(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    if (client) {
      client.capture(event, props);
    } else if (pending && pending.length < MAX_QUEUE) {
      (pending as Array<{ event: string; props?: Record<string, unknown> }>).push({
        event,
        props,
      });
    }
  } catch {
    // Swallow tracking errors — never break the UX
  }
}
