import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The shared service-role client (lib/supabase/admin.ts) is intentionally
 * untyped so the webhook can stay decoupled from the generated schema. The
 * admin panel, by contrast, runs many schema-bound reads, so we expose the same
 * underlying client typed against `Database` here — one cast, typed everywhere
 * downstream. RLS-bypassing: server-only, admin code only.
 */
export function adminDb(): SupabaseClient<Database> {
  return createAdminClient() as unknown as SupabaseClient<Database>;
}
