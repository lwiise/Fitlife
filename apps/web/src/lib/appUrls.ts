import type { Tier, Cadence } from "@fitlife/config";

// The SaaS app is a separate Netlify site. Compose its URLs ONLY here so no
// component hardcodes the origin. Env-driven, with a launch fallback so the
// static build is always correct even if the env var isn't set.
const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://fitlife-app-mvp.netlify.app";

export function getSignupUrl(): string {
  return `${APP_BASE}/auth/login`;
}

export function getTierSignupUrl(tier: Tier, cadence: Cadence): string {
  const params = new URLSearchParams({ tier, cadence });
  return `${APP_BASE}/auth/login?${params.toString()}`;
}
