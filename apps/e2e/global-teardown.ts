/**
 * Erase every account the run created, and record honestly whether it worked.
 *
 * Cleanup never throws: a teardown failure must not mask the test results that
 * preceded it. Instead the outcome — including any account that survived — is
 * written to `.e2e-state/cleanup.json`, which the reporter folds into the report
 * so a leak is visible rather than silent.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getConfig } from "./src/config.js";
import { eraseAccount } from "./src/accounts.js";
import { clearRegistry, readRegistry } from "./src/registry.js";
import { CLEANUP_FILE } from "./src/reporter.js";
import type { CleanupOutcome } from "./src/reportRender.js";

export default async function globalTeardown(): Promise<void> {
  const cfg = getConfig();
  const accounts = readRegistry(cfg.stateDir);

  const outcome: CleanupOutcome = {
    attempted: accounts.length,
    deleted: 0,
    failed: [],
    skippedByRequest: cfg.keepAccounts,
  };

  if (cfg.keepAccounts) {
    // Registry is intentionally NOT cleared: the next run's setup sweeps these,
    // so "keep for debugging" can never turn into a permanent leak.
    writeOutcome(cfg.stateDir, outcome);
    process.stdout.write(
      `\nE2E cleanup skipped (E2E_KEEP_ACCOUNTS=1). ${accounts.length} account(s) kept; ` +
        `the next run will sweep them.\n`,
    );
    return;
  }

  for (const account of accounts) {
    try {
      await eraseAccount(account.userId, account.email);
      outcome.deleted++;
    } catch (err) {
      outcome.failed.push({
        userId: account.userId,
        email: account.email,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Only accounts that are genuinely gone leave the registry; survivors stay so
  // the next run retries them.
  const survivors = new Set(outcome.failed.map((f) => f.userId));
  clearRegistry(cfg.stateDir);
  for (const account of accounts.filter((a) => survivors.has(a.userId))) {
    const { registerAccount } = await import("./src/registry.js");
    registerAccount(cfg.stateDir, account);
  }

  writeOutcome(cfg.stateDir, outcome);
}

function writeOutcome(stateDir: string, outcome: CleanupOutcome): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(path.join(stateDir, CLEANUP_FILE), JSON.stringify(outcome, null, 2));
}
