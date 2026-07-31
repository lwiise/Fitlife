/**
 * Safety guards. Pure functions, no I/O — every rule that stands between this
 * suite and a real customer / a real charge lives here so it can be unit-tested
 * without a network or a database.
 *
 * The suite creates users, writes rows and activates subscriptions. Run it at
 * the wrong target and it pollutes production. Run it against live-mode
 * LemonSqueezy variants and it can bill a real card. Both are default-DENIED
 * below; unlocking either takes a deliberate, explicit environment variable.
 */

import { PRICING_TIERS, getTierCadenceByVariantId } from "./pricingConfig.js";

/** Hosts that are always safe: a local dev stack. */
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "host.docker.internal",
]);

/**
 * Deployments known to serve real customers. Named explicitly (rather than
 * relying only on the default-deny below) so that an operator who sets a broad
 * allow-list still cannot aim the suite at production by accident.
 *
 * Source: CLAUDE.md — "Single production site: fitlife-app-mvp.netlify.app".
 */
export const KNOWN_PRODUCTION_HOSTS = ["fitlife-app-mvp.netlify.app"];

export function hostOf(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`E2E target is not a valid URL: ${JSON.stringify(rawUrl)}`);
  }
  return url.host.toLowerCase();
}

export function isLocalHost(rawUrl: string): boolean {
  const host = hostOf(rawUrl);
  const hostname = host.split(":")[0] ?? host;
  return LOCAL_HOSTS.has(hostname);
}

export function isKnownProductionHost(rawUrl: string): boolean {
  const host = hostOf(rawUrl);
  const hostname = host.split(":")[0] ?? host;
  return KNOWN_PRODUCTION_HOSTS.includes(hostname);
}

/**
 * Default-deny target check.
 *
 * A target is permitted when it is local, or when the operator has listed its
 * exact host in `allowedHosts` (from `E2E_ALLOW_TARGET`, comma-separated).
 * A host on {@link KNOWN_PRODUCTION_HOSTS} is refused no matter what — there is
 * no environment variable that turns production into a valid test target.
 */
export function assertSafeTarget(
  rawUrl: string,
  allowedHosts: readonly string[],
  label: string,
): void {
  const host = hostOf(rawUrl);
  const hostname = host.split(":")[0] ?? host;

  if (isKnownProductionHost(rawUrl)) {
    throw new Error(
      `Refusing to run the E2E suite against production ${label} (${hostname}). ` +
        `This suite creates accounts, writes family rows and activates subscriptions. ` +
        `Point ${label} at a local or staging stack instead.`,
    );
  }

  if (isLocalHost(rawUrl)) return;

  const allowed = allowedHosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowed.includes(hostname) || allowed.includes(host)) return;

  throw new Error(
    `Refusing to run the E2E suite against a non-local ${label} (${hostname}). ` +
      `The suite writes data. If ${hostname} is a disposable staging stack, opt in with ` +
      `E2E_ALLOW_TARGET=${hostname} (comma-separate multiple hosts).`,
  );
}

/**
 * LemonSqueezy variant IDs this suite is allowed to check out.
 *
 * Snapshot of the TEST-MODE ids documented in packages/config/src/pricing.ts.
 * It is deliberately a COPY, not a re-export: pricing.ts carries a standing TODO
 * to swap in live-mode ids before launch, and on the day that happens this list
 * stops matching and {@link assertSandboxVariant} fails loudly — instead of the
 * suite quietly starting to create real, billable checkouts.
 */
export const SANDBOX_VARIANT_IDS: readonly string[] = [
  "1677645", // starter monthly
  "1677781", // starter annual
  "1677648", // pro monthly
  "1677755", // pro annual
  "1677653", // family monthly
  "1677675", // family annual
  "1677655", // premium monthly
  "1677749", // premium annual
];

/**
 * Refuse to drive checkout for any variant that is not a known sandbox variant.
 * Guards the "never trigger a real charge" constraint at its narrowest point:
 * the id that is actually sent to LemonSqueezy.
 */
export function assertSandboxVariant(variantId: string): void {
  if (!SANDBOX_VARIANT_IDS.includes(variantId)) {
    const resolved = getTierCadenceByVariantId(variantId);
    throw new Error(
      `Variant ${variantId} is not in the known TEST-MODE variant list. ` +
        (resolved
          ? `pricing.ts maps it to ${resolved.tier}/${resolved.cadence} — if the live-mode ` +
            `variant swap has happened, this suite must NOT run against it (real charges). `
          : `It is not in pricing.ts at all. `) +
        `Update SANDBOX_VARIANT_IDS in apps/e2e/src/guards.ts only when you have confirmed ` +
        `the new ids are test-mode.`,
    );
  }
}

/**
 * Cross-check that the repo's pricing config still agrees with the sandbox
 * snapshot above. Catches the live-mode swap even for tiers this run doesn't
 * touch, so the failure surfaces at setup rather than mid-scenario.
 */
export function findLiveModeVariantDrift(): string[] {
  const drift: string[] = [];
  for (const tier of Object.values(PRICING_TIERS)) {
    for (const [cadence, id] of [
      ["monthly", tier.lemonsqueezy_variant_id_monthly],
      ["annual", tier.lemonsqueezy_variant_id_annual],
    ] as const) {
      if (!SANDBOX_VARIANT_IDS.includes(id)) {
        drift.push(`${tier.id}/${cadence} → ${id}`);
      }
    }
  }
  return drift;
}

/**
 * Test accounts are addressed at a reserved subdomain so they are trivially
 * identifiable (and bulk-deletable) in the Supabase dashboard. Nothing outside
 * this pattern is ever eligible for the suite's cleanup pass.
 */
export const TEST_EMAIL_DOMAIN = "e2e.fitlife.invalid";

export function isTestAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${TEST_EMAIL_DOMAIN}`);
}

/**
 * Guard for the destructive half of the suite. Cleanup runs with the service-role
 * key (RLS bypassed), so a bad id here would hard-delete a real account. Deleting
 * anything whose email is not a suite-issued address is refused.
 */
export function assertDeletableTestAccount(
  email: string | null | undefined,
  userId: string,
): void {
  if (!isTestAccountEmail(email)) {
    throw new Error(
      `Refusing to delete user ${userId}: email ${JSON.stringify(email)} is not a ` +
        `suite-issued @${TEST_EMAIL_DOMAIN} address. Cleanup only ever removes accounts ` +
        `this suite created.`,
    );
  }
}
