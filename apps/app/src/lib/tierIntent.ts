import { PRICING_TIERS, type Tier, type Cadence } from "@fitlife/config";

const TIER_IDS = Object.keys(PRICING_TIERS) as Tier[];

// tier/cadence are public, user-controlled intent signals (like UTM params).
// Validate before trusting them for any UX preselection. Never use for authz.
export function isValidTier(value: string | null | undefined): value is Tier {
  return !!value && (TIER_IDS as string[]).includes(value);
}

export function isValidCadence(
  value: string | null | undefined,
): value is Cadence {
  return value === "monthly" || value === "annual";
}
