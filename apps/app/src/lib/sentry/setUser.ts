import * as Sentry from "@sentry/nextjs";

// Attach ONLY the user id to Sentry events — never email, name, or any other PII.
export function setSentryUser(userId: string) {
  Sentry.setUser({ id: userId });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}
