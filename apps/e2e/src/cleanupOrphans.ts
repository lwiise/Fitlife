/**
 * Manual sweep: `pnpm --filter @fitlife/e2e cleanup`.
 *
 * The suite cleans up after itself, and its own setup sweeps whatever a crashed
 * run left in the registry. This command is the backstop for the case the registry
 * cannot cover — a run killed before it could even record an account, or a state
 * directory that was deleted. It scans the auth user list for the reserved
 * @e2e.fitlife.invalid domain and removes what it finds.
 *
 * Nothing outside that domain is ever touched (guards.assertDeletableTestAccount).
 */

import { getConfig } from "./config.js";
import { admin } from "./supabase.js";
import { eraseAccount } from "./accounts.js";
import { isTestAccountEmail, TEST_EMAIL_DOMAIN } from "./guards.js";
import { clearRegistry } from "./registry.js";

async function main(): Promise<void> {
  // Runs the same default-deny target checks as a test run.
  const cfg = getConfig();
  const dryRun = process.argv.includes("--dry-run");

  const found: { id: string; email: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users) {
      if (isTestAccountEmail(user.email)) found.push({ id: user.id, email: user.email! });
    }
    if (data.users.length < 200) break;
  }

  if (found.length === 0) {
    console.log(`No @${TEST_EMAIL_DOMAIN} accounts found. Nothing to clean up.`);
    return;
  }

  console.log(`Found ${found.length} test account(s) on ${cfg.supabaseUrl}:`);
  for (const user of found) console.log(`  ${user.email} (${user.id})`);

  if (dryRun) {
    console.log("\n--dry-run: nothing deleted.");
    return;
  }

  let deleted = 0;
  for (const user of found) {
    try {
      await eraseAccount(user.id, user.email);
      deleted++;
    } catch (err) {
      console.error(`  failed: ${user.email} — ${err instanceof Error ? err.message : err}`);
    }
  }

  clearRegistry(cfg.stateDir);
  console.log(`\nDeleted ${deleted}/${found.length} test account(s).`);
  if (deleted !== found.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
