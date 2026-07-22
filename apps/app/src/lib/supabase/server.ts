import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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
//
// React.cache: one client per request. Many helpers call createClient()
// independently within a single render; sharing the instance is required for
// getAuthUser() below to dedupe, and is safe — cookies() is request-scoped.
export const createClient = cache(async (): Promise<SupabaseClient<Database>> => {
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
});

/**
 * The authenticated user for this request, validated against the Supabase Auth
 * server — memoized with React.cache so the network round-trip happens ONCE per
 * request no matter how many helpers/components ask. Before this, every query
 * helper made its own auth.getUser() HTTP call (4-6 per dashboard render),
 * which dominated server render time. Concurrent callers share the in-flight
 * promise. Falls back gracefully outside a React request scope (no memoization,
 * same behavior as before).
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
