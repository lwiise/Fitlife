import { posthog } from "@/lib/posthog";

export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!posthog?.capture) return;
  try {
    posthog.capture(event, props);
  } catch {
    // Swallow tracking errors — never break the UX
  }
}
