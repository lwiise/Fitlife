import type { Tier, Cadence } from "@fitlife/config";

// The landing now lives in the same app, so signup links are same-origin
// relative paths (no cross-site origin needed). mode=signup opens the auth
// form on "create account" — landing CTAs are for new users.
export function getSignupUrl(): string {
  return "/auth/login?mode=signup";
}

export function getTierSignupUrl(tier: Tier, cadence: Cadence): string {
  const params = new URLSearchParams({ tier, cadence, mode: "signup" });
  return `/auth/login?${params.toString()}`;
}
