/**
 * Durable record of every account this suite creates.
 *
 * Playwright runs global teardown in a different process from the workers that
 * create the accounts, so an in-memory list would not survive to cleanup time —
 * and would leak every account if a worker crashed mid-scenario. The registry is
 * therefore a small append-only JSON file on disk: whatever is in it at the end
 * of the run gets erased, including rows left behind by a previous crashed run.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface RegisteredAccount {
  userId: string;
  email: string;
  createdAt: string;
  /** Which spec created it — surfaces in the report when cleanup fails. */
  origin: string;
}

function registryPath(stateDir: string): string {
  return path.join(stateDir, "accounts.json");
}

export function readRegistry(stateDir: string): RegisteredAccount[] {
  const file = registryPath(stateDir);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? (parsed as RegisteredAccount[]) : [];
  } catch {
    // A truncated file (killed mid-write) must not block cleanup of the rest.
    return [];
  }
}

export function registerAccount(
  stateDir: string,
  account: RegisteredAccount,
): void {
  mkdirSync(stateDir, { recursive: true });
  const existing = readRegistry(stateDir);
  if (existing.some((a) => a.userId === account.userId)) return;
  existing.push(account);
  writeFileSync(registryPath(stateDir), JSON.stringify(existing, null, 2));
}

export function clearRegistry(stateDir: string): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(registryPath(stateDir), "[]");
}
