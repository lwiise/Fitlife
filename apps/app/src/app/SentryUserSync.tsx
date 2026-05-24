"use client";

import { useEffect } from "react";
import { setSentryUser, clearSentryUser } from "@/lib/sentry/setUser";

// Keeps Sentry's user context in sync with the authenticated session. Fed the
// user id by the (server) root layout, so it's set on every authenticated page
// and cleared after logout. Id only — never PII.
export function SentryUserSync({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (userId) {
      setSentryUser(userId);
    } else {
      clearSentryUser();
    }
  }, [userId]);

  return null;
}
