import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, getSupabaseServiceRoleKey } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY for unauthenticated
 * server-side writes (e.g. Lemonsqueezy webhook handler).
 *
 * Importing this file from any non-webhook route would expand the blast
 * radius of a misuse. Keep usage scoped.
 *
 * The `service_role` key is read lazily so the build never needs it.
 */
let _admin: SupabaseClient | undefined;

export function createAdminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      getSupabaseServiceRoleKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return _admin;
}
