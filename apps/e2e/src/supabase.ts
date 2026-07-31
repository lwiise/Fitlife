/**
 * Supabase clients for the suite.
 *
 * Two clients on purpose:
 *   • admin  — service-role, RLS bypassed. ONLY for things a customer cannot do
 *              for themselves: minting a pre-confirmed test user, reading the
 *              subscription row the webhook wrote, and hard-deleting afterwards.
 *   • user   — anon key + the test user's own session. Every family write in the
 *              scenario goes through this one, so the tests exercise the same RLS
 *              policies the real app runs under. If a policy regresses, the
 *              scenario fails instead of silently passing on a god-mode key.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./config.js";

let adminClient: SupabaseClient | undefined;

export function admin(): SupabaseClient {
  if (!adminClient) {
    const cfg = getConfig();
    adminClient = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/** A client bound to one test user's access token — subject to RLS. */
export function asUser(accessToken: string): SupabaseClient {
  const cfg = getConfig();
  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Anonymous client — used to sign in, and to prove unauthenticated reads are denied. */
export function anon(): SupabaseClient {
  const cfg = getConfig();
  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Poll until `check` returns a value, or throw. Used for the two genuinely
 * asynchronous seams in this app: the `handle_new_user` trigger that seeds the
 * profile + trial subscription rows, and the webhook write that activates a
 * subscription. Everything else is awaited directly — no blanket sleeps.
 */
export async function waitFor<T>(
  description: string,
  check: () => Promise<T | null | undefined>,
  { timeoutMs = 10_000, intervalMs = 250 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  for (;;) {
    try {
      const value = await check();
      if (value !== null && value !== undefined) return value;
    } catch (err) {
      lastError = err;
    }
    if (Date.now() >= deadline) {
      const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}.${suffix}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
