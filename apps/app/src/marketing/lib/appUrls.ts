import type { Tier, Cadence } from "@fitlife/config";

// The landing now lives in the same app, so signup links are same-origin
// relative paths (no cross-site origin needed).
export function getSignupUrl(): string {
  return "/auth/login";
}

export function getTierSignupUrl(tier: Tier, cadence: Cadence): string {
  const params = new URLSearchParams({ tier, cadence });
  return `/auth/login?${params.toString()}`;
}
