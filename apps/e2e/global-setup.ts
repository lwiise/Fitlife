/**
 * Pre-flight for a run.
 *
 * Order matters: every safety check runs BEFORE the first row is written, and the
 * leftovers of any previous crashed run are swept before this run adds its own —
 * that is what makes the suite repeatable rather than slowly accumulating debris.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getConfig } from "./src/config.js";
import { findLiveModeVariantDrift, hostOf } from "./src/guards.js";
import { eraseAccount } from "./src/accounts.js";
import { clearRegistry, readRegistry } from "./src/registry.js";
import { ENVIRONMENT_FILE, WARNINGS_FILE } from "./src/reporter.js";
import { PLAN_CADENCE, PLAN_PRICE_SAR, PLAN_TIER, PLAN_VARIANT_ID } from "./src/scenario.js";
import type { RunEnvironment } from "./src/reportRender.js";

export default async function globalSetup(): Promise<void> {
  // getConfig() runs assertSafeTarget on both the app URL and the Supabase URL,
  // so an unsafe target aborts here — before any test, account or row exists.
  const cfg = getConfig();
  const warnings: string[] = [];

  // If pricing.ts has been switched to live-mode variant ids, refuse to run at
  // all: from that point on a checkout is a real, billable checkout.
  const drift = findLiveModeVariantDrift();
  if (drift.length > 0) {
    throw new Error(
      `Aborting: pricing.ts contains variant ids that are not in the known TEST-MODE list ` +
        `(${drift.join(", ")}). If the live-mode swap has happened, this suite must not run ` +
        `against production variants. Review apps/e2e/src/guards.ts.`,
    );
  }

  mkdirSync(cfg.stateDir, { recursive: true });

  // Sweep anything a previous run left behind (crash, SIGINT, failed teardown).
  const leftovers = readRegistry(cfg.stateDir);
  if (leftovers.length > 0) {
    let swept = 0;
    for (const account of leftovers) {
      try {
        await eraseAccount(account.userId, account.email);
        swept++;
      } catch (err) {
        warnings.push(
          `Could not remove leftover test account ${account.email} from a previous run: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (swept > 0) {
      warnings.push(`Swept ${swept} test account(s) left behind by a previous run.`);
    }
  }
  clearRegistry(cfg.stateDir);

  // Fail fast with a useful message rather than letting every spec time out.
  await assertAppReachable(cfg.baseUrl, warnings);

  // The report must never read as a full pass when a whole phase was filtered
  // out — an excluded test leaves no trace in the results table on its own.
  if (!cfg.includeBilling) {
    warnings.push(
      "PAYMENT PHASE DEFERRED: every @billing test (checkout, payment webhook, paid " +
        "subscription state) was excluded from this run. Coverage of the purchase flow is " +
        "NOT represented below. Re-enable with E2E_INCLUDE_BILLING=1.",
    );
  } else if (!cfg.lemonsqueezyApiKey) {
    warnings.push(
      "No LEMONSQUEEZY_API_KEY configured — the price assertion against the LemonSqueezy " +
        "API was skipped; the amount is still verified against packages/config pricing.",
    );
  }

  if (cfg.includeBilling && !cfg.webhookSecret) {
    throw new Error(
      "E2E_INCLUDE_BILLING=1 but no webhook secret is set. The payment phase signs webhooks " +
        "with E2E_LEMONSQUEEZY_WEBHOOK_SECRET (or the app's LEMONSQUEEZY_WEBHOOK_SECRET), and " +
        "it must MATCH the secret the app under test is running with.",
    );
  }

  const environment: RunEnvironment = {
    baseUrl: cfg.baseUrl,
    supabaseHost: hostOf(cfg.supabaseUrl),
    tier: PLAN_TIER,
    cadence: PLAN_CADENCE,
    priceSar: PLAN_PRICE_SAR,
    variantId: PLAN_VARIANT_ID,
    paymentMode: cfg.includeBilling
      ? "LemonSqueezy TEST MODE (no card submitted; signed webhook activation)"
      : "DEFERRED — @billing tests excluded from this run",
    liveCheckout: cfg.liveCheckout,
  };

  writeFileSync(
    path.join(cfg.stateDir, ENVIRONMENT_FILE),
    JSON.stringify(environment, null, 2),
  );
  writeFileSync(path.join(cfg.stateDir, WARNINGS_FILE), JSON.stringify(warnings, null, 2));
}

async function assertAppReachable(baseUrl: string, warnings: string[]): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      schema?: string;
    };
    if (body.schema === "missing") {
      warnings.push(
        `${baseUrl}/api/health reports schema "missing" — migrations may not be applied ` +
          `to the target database.`,
      );
    }
    if (!res.ok || body.status !== "ok") {
      throw new Error(`/api/health returned ${res.status} ${JSON.stringify(body)}`);
    }
  } catch (err) {
    throw new Error(
      `The app under test is not reachable at ${baseUrl}. Start it (pnpm --filter @fitlife/app dev) ` +
        `or set E2E_BASE_URL / E2E_MANAGE_WEBSERVER=1.\nCause: ${
          err instanceof Error ? err.message : String(err)
        }`,
    );
  }
}
