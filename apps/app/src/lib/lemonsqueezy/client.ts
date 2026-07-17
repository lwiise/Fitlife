import "server-only";

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { getLemonsqueezyApiKey } from "@/lib/env";

/**
 * The Lemonsqueezy SDK uses a module-level setup call; subsequent operations
 * pick up the configured API key from internal state. We wrap that in a
 * lazy idempotent factory so the key is only read at request time (never at
 * module load), and the SDK is configured exactly once per process.
 */
let _initialized = false;

export function setupLemonsqueezy(): void {
  if (_initialized) return;
  lemonSqueezySetup({ apiKey: getLemonsqueezyApiKey() });
  _initialized = true;
}

/**
 * LS rejects an ENTIRE checkout (422) when checkout_data.email is present but
 * not a valid address — dev accounts like "test@test" and empty-string emails
 * both trip it. The prefill is convenience only (custom.user_id maps the
 * webhook back), so callers pass the result and a bad email is simply
 * omitted; the hosted LS checkout page collects one itself.
 */
export function checkoutPrefillEmail(
  email: string | undefined,
): string | undefined {
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}
