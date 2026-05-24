import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for use in:
 * - Server Components
 * - Route Handlers (app/api/.../route.ts)
 * - Server Actions
 */
export async function createClient() {
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
  );
}
