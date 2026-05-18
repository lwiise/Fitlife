/**
 * Type-safe environment variable access.
 * Validates required vars at startup so we fail fast instead of getting
 * cryptic "undefined" errors at runtime.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Add it to apps/app/.env.local (local) or Netlify dashboard (production).`
    );
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

export const env = {
  // Public (safe to expose to browser)
  NEXT_PUBLIC_SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  NEXT_PUBLIC_APP_URL: requireEnv("NEXT_PUBLIC_APP_URL"),
  NEXT_PUBLIC_WEB_URL: requireEnv("NEXT_PUBLIC_WEB_URL"),

  // Server-only (must never be sent to browser)
  SUPABASE_SERVICE_ROLE_KEY: optionalEnv("SUPABASE_SERVICE_ROLE_KEY"),
  ANTHROPIC_API_KEY: optionalEnv("ANTHROPIC_API_KEY"),
} as const;
