import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for use in:
 * - Server Components
 * - Route Handlers (app/api/.../route.ts)
 * - Server Actions
 */
// Returned as the supabase-js `SupabaseClient<Database>` so .insert()/.update()
// validate row columns. The @supabase/ssr return type trips a postgrest-js@2.106
// generic bug — the `__InternalSupabase` wrapper in the generated types resolves
// write params to `never` — so one cast at the source types every call site
// (same one-cast pattern as lib/admin/db.ts). Type-only; runtime client unchanged.
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Lax so the session cookie survives the cross-site return from
              // the Lemonsqueezy payment redirect (Strict would be dropped).
              cookieStore.set(name, value, { ...options, sameSite: "lax" });
            });
          } catch {
            // Called from Server Component — ignore (middleware refreshes sessions)
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>;
}
