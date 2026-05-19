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
