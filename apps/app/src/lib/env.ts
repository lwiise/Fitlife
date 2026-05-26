/**
 * Type-safe environment variable access.
 * Validates required vars at startup so we fail fast instead of getting
 * cryptic "undefined" errors at runtime.
 *
 * IMPORTANT: NEXT_PUBLIC_* vars must be accessed via direct property reads
 * (process.env.NEXT_PUBLIC_FOO), NOT via dynamic keys (process.env[key]),
 * so Next.js can inline them into the client bundle at build time.
 * Dynamic keys stay as runtime lookups and resolve to `undefined` in the
 * browser, which would crash module evaluation on the client.
 */

function requireValue(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Add it to apps/app/.env.local (local) or Netlify dashboard (production).`
    );
  }
  return value;
}

export const env = {
  // Public (safe to expose to browser) — direct refs so Next.js inlines them
  NEXT_PUBLIC_SUPABASE_URL: requireValue(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  // Strip trailing slashes so concatenations like `${APP_URL}/dashboard`
  // never produce a double slash (which breaks URL resolution / replaceState).
  NEXT_PUBLIC_APP_URL: requireValue(
    "NEXT_PUBLIC_APP_URL",
    process.env.NEXT_PUBLIC_APP_URL,
  ).replace(/\/+$/, ""),
  NEXT_PUBLIC_WEB_URL: requireValue(
    "NEXT_PUBLIC_WEB_URL",
    process.env.NEXT_PUBLIC_WEB_URL,
  ).replace(/\/+$/, ""),

  // Public optional support contacts — empty by default; Anas populates them in
  // .env.local + Netlify. Direct refs so Next.js inlines them; never throws.
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  NEXT_PUBLIC_SUPPORT_WHATSAPP: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "",

  // Server-only optional (never sent to browser; resolve to undefined in client bundle)
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
} as const;

/**
 * Lazy, throwing access for server-only required secrets.
 *
 * Use these from inside request handlers / generation functions — never at
 * module top-level. Module-load access would crash the build/process when the
 * env var is unset; lazy access gives a clean runtime error pointing the
 * developer at the .env.local / Netlify dashboard to populate.
 *
 * Dynamic key access via `process.env[key]` is fine for SERVER-ONLY vars
 * (no Next.js client-bundle inlining concern), but we still pass the resolved
 * value to a helper to keep the error message consistent.
 */
function requireServerEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Add it to apps/app/.env.local (local) or Netlify dashboard (production).`
    );
  }
  return value;
}

export function getAnthropicKey(): string {
  return requireServerEnv("ANTHROPIC_API_KEY");
}

export function getLemonsqueezyApiKey(): string {
  return requireServerEnv("LEMONSQUEEZY_API_KEY");
}

export function getLemonsqueezyStoreId(): string {
  return requireServerEnv("LEMONSQUEEZY_STORE_ID");
}

export function getLemonsqueezyWebhookSecret(): string {
  return requireServerEnv("LEMONSQUEEZY_WEBHOOK_SECRET");
}

export function getSupabaseServiceRoleKey(): string {
  return requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
}
