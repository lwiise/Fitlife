// One-off admin utility: set a password on an existing Supabase auth user.
//
// Why: accounts created via magic-link have no password. After switching login
// to email + password, run this once to give your existing (already
// email-confirmed) account a password so you can sign in without losing data.
//
// Usage (from repo root):
//   node apps/app/scripts/set-password.mjs "YourChosenPassword123"
//
// Optional: pass a user id as the 2nd arg; defaults to the current test user.
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
// apps/app/.env.local — the service-role key never appears on the command line.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env.local");

const DEFAULT_USER_ID = "f6ad936f-0921-428f-923c-e7c8dc3b7048";

function loadEnv(path) {
  const out = {};
  const text = readFileSync(path, "utf8");
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
    out[key] = value;
  }
  return out;
}

const password = process.argv[2];
const userId = process.argv[3] || DEFAULT_USER_ID;

if (!password || password.length < 8) {
  console.error("Provide a password of at least 8 characters:");
  console.error('  node apps/app/scripts/set-password.mjs "YourPassword123"');
  process.exit(1);
}

const env = loadEnv(ENV_PATH);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password,
});

if (error) {
  console.error("Failed to set password:", error.message);
  process.exit(1);
}

console.log("Password set for:", data.user?.email ?? userId);
console.log("You can now sign in with that email + password.");
