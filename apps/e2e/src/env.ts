/**
 * Minimal dotenv reader.
 *
 * The repo has no dotenv dependency and `apps/app/scripts/set-password.mjs`
 * already hand-rolls this same parse, so we stay consistent rather than adding a
 * package for eight lines. Values already present in `process.env` always win,
 * which is what lets CI inject secrets without a file on disk.
 */

import { existsSync, readFileSync } from "node:fs";

export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Load each file in order; earlier files win, and process.env wins over all. */
export function loadEnvFiles(paths: readonly string[]): void {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const parsed = parseDotenv(readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }
}
