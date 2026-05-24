import * as Sentry from "@sentry/nextjs";

// Runs in Node.js serverless functions (route handlers, server components,
// server actions). Init is guarded by the DSN so an empty/unset DSN no-ops
// gracefully — never throws, never breaks a request.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

const release =
  process.env.NEXT_PUBLIC_COMMIT_REF || process.env.COMMIT_REF || "unknown";

// Matches Supabase/JWT-shaped tokens so a service-role/anon key can never leak
// into an error message sent to Sentry.
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release,
    tracesSampleRate: 0.1,
    ignoreErrors: [
      "AbortError",
      "NetworkError",
      "Network request failed",
      "Non-Error promise rejection captured",
    ],
    beforeSend(event) {
      // PII: keep only user.id
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      // Scrub auth-bearing request data
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      // Backstop: redact any JWT-shaped token that slipped into an exception
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = ex.value.replace(JWT_RE, "[REDACTED_JWT]");
        }
      }
      return event;
    },
  });
}
