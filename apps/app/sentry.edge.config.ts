import * as Sentry from "@sentry/nextjs";

// Runs in the Edge runtime (the auth proxy/middleware). Minimal init; guarded
// by the DSN so an empty DSN no-ops.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

const release =
  process.env.NEXT_PUBLIC_COMMIT_REF || process.env.COMMIT_REF || "unknown";

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
  });
}
