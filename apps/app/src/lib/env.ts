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
  NEXT_PUBLIC_APP_URL: requireValue(
    "NEXT_PUBLIC_APP_URL",
    process.env.NEXT_PUBLIC_APP_URL,
  ),
  NEXT_PUBLIC_WEB_URL: requireValue(
    "NEXT_PUBLIC_WEB_URL",
    process.env.NEXT_PUBLIC_WEB_URL,
  ),

  // Server-only (never sent to browser; resolve to undefined in client bundle)
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
} as const;
