/**
 * Resolved, validated configuration for one E2E run.
 *
 * Reads `apps/e2e/.env.e2e` first, then falls back to `apps/app/.env.local` so a
 * developer who already has the app running locally usually needs to set nothing
 * but the target allow-list. Every value is namespaced `E2E_*` with a fallback to
 * the app's own variable name, so pointing the suite somewhere OTHER than the
 * app's configured stack is always an explicit act.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "./env.js";
import { assertSafeTarget } from "./guards.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const E2E_ROOT = path.resolve(here, "..");
const APP_ROOT = path.resolve(E2E_ROOT, "..", "app");

loadEnvFiles([
  path.join(E2E_ROOT, ".env.e2e"),
  path.join(APP_ROOT, ".env.local"),
]);

function read(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function require_(names: string[], hint: string): string {
  const value = read(...names);
  if (!value) {
    throw new Error(
      `Missing required E2E env var ${names[0]}. ${hint}\n` +
        `Set it in apps/e2e/.env.e2e (see env.e2e.example.txt) or in the environment.`,
    );
  }
  return value;
}

export interface E2EConfig {
  /** Base URL of the running Next.js app under test. */
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  /**
   * Shared secret the app verifies webhook signatures with.
   *
   * Undefined is legitimate: the billing phase is deferred by default, and the
   * rest of the suite needs no LemonSqueezy credentials at all. Reach for it via
   * {@link requireWebhookSecret} so the failure is a clear message rather than a
   * signature mismatch mid-scenario.
   */
  webhookSecret: string | undefined;
  /**
   * Whether the @billing phase runs. Deferred by default — see BILLING_TAG.
   */
  includeBilling: boolean;
  /** Optional: enables the real LemonSqueezy price assertion. */
  lemonsqueezyApiKey: string | undefined;
  /** Opt-in: also drive the hosted LemonSqueezy checkout page in a browser. */
  liveCheckout: boolean;
  /** Opt-in: leave created accounts behind for debugging. */
  keepAccounts: boolean;
  /** Start a dev server for the run instead of reusing one already running. */
  manageWebServer: boolean;
  reportDir: string;
  stateDir: string;
}

let cached: E2EConfig | undefined;

export function getConfig(): E2EConfig {
  if (cached) return cached;

  const allowedHosts = (read("E2E_ALLOW_TARGET") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const baseUrl = (read("E2E_BASE_URL") ?? "http://localhost:3001").replace(
    /\/+$/,
    "",
  );
  const supabaseUrl = require_(
    ["E2E_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    "The Supabase project the app under test is wired to.",
  );

  // Default-deny: both the app and the database must be a local or explicitly
  // allow-listed stack before a single row is written.
  assertSafeTarget(baseUrl, allowedHosts, "app URL (E2E_BASE_URL)");
  assertSafeTarget(supabaseUrl, allowedHosts, "Supabase URL (E2E_SUPABASE_URL)");

  cached = {
    baseUrl,
    supabaseUrl,
    supabaseAnonKey: require_(
      ["E2E_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      "Used to sign in as the test user, so every family write goes through RLS.",
    ),
    supabaseServiceRoleKey: require_(
      ["E2E_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      "Used to create confirmed test users and to hard-delete them afterwards.",
    ),
    // Not required up front: without the billing phase the suite touches no
    // LemonSqueezy surface, so a Supabase target is the only prerequisite.
    webhookSecret: read("E2E_LEMONSQUEEZY_WEBHOOK_SECRET", "LEMONSQUEEZY_WEBHOOK_SECRET"),
    includeBilling: read("E2E_INCLUDE_BILLING") === "1",
    lemonsqueezyApiKey: read("E2E_LEMONSQUEEZY_API_KEY", "LEMONSQUEEZY_API_KEY"),
    liveCheckout: read("E2E_LIVE_CHECKOUT") === "1",
    keepAccounts: read("E2E_KEEP_ACCOUNTS") === "1",
    manageWebServer: read("E2E_MANAGE_WEBSERVER") === "1",
    reportDir: path.join(E2E_ROOT, "reports"),
    stateDir: path.join(E2E_ROOT, ".e2e-state"),
  };

  return cached;
}

/**
 * Playwright tag marking every test that touches LemonSqueezy — creating a
 * checkout session, delivering a payment webhook, or asserting a paid
 * subscription's state.
 *
 * The phase is currently DEFERRED: the default run excludes this tag, so the
 * suite proves signup, the family-of-three model, access gating on the trial and
 * account integrity without needing any payment credentials. Re-enable the whole
 * phase with `E2E_INCLUDE_BILLING=1` — nothing is deleted, only filtered out.
 */
export const BILLING_TAG = "@billing";

/**
 * The webhook secret, or a clear explanation of what is missing.
 *
 * Only the @billing phase calls this. It must match the secret the app under test
 * runs with — a mismatch would otherwise surface as an unexplained 401 from a
 * route whose job is to reject exactly that.
 */
export function requireWebhookSecret(cfg: E2EConfig): string {
  if (!cfg.webhookSecret) {
    throw new Error(
      "The billing phase needs E2E_LEMONSQUEEZY_WEBHOOK_SECRET (or the app's " +
        "LEMONSQUEEZY_WEBHOOK_SECRET) and it is not set. It must MATCH the secret the app " +
        "under test is running with. Unset E2E_INCLUDE_BILLING to defer this phase again.",
    );
  }
  return cfg.webhookSecret;
}
