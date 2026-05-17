// TODO: Replace NEXT_PUBLIC_POSTHOG_KEY in .env.local with real key from posthog.com dashboard before launch.
import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || key === "phc_YOUR_KEY_HERE") {
    console.warn("PostHog key missing or placeholder. Tracking disabled.");
    return;
  }

  if (posthog.__loaded) return;

  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
  });
}

export { posthog };
