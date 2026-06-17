"use client";

import { useEffect } from "react";
import { setSentryUser, clearSentryUser } from "@/lib/sentry/setUser";
import { createClient } from "@/lib/supabase/client";

// Keeps Sentry's user context in sync with the authenticated session — entirely
// client-side. Reading the session here (instead of in the server root layout)
// keeps the root layout free of cookie access, so public pages like the
// marketing landing can be statically rendered / CDN-cached. onAuthStateChange
// fires an INITIAL_SESSION event immediately with the current session (no extra
// network round-trip), then on every sign-in/out. Id only — never PII.
export function SentryUserSync() {
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSentryUser(session.user.id);
      } else {
        clearSentryUser();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}
