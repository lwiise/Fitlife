import { capture } from "@/marketing/lib/posthog";

export function track(event: string, props?: Record<string, unknown>) {
  // Queued until posthog-js lazy-loads; dropped silently when tracking is off.
  capture(event, props);
}
