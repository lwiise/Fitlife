import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for use in Client Components.
 * Reads session from cookies automatically.
 */
// Returned as supabase-js `SupabaseClient<Database>` so writes type-check — see
// server.ts for why (postgrest-js@2.106 `__InternalSupabase` generic bug).
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) as unknown as SupabaseClient<Database>;
}
