import * as Sentry from "@sentry/nextjs";

// Client (browser) Sentry init. In @sentry/nextjs v10 the client config lives in
// instrumentation-client.ts (auto-loaded by the build plugin). Guarded by the
// DSN so an empty DSN no-ops.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

const release =
  process.env.NEXT_PUBLIC_COMMIT_REF || process.env.COMMIT_REF || "unknown";

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release,
    tracesSampleRate: 0.1,
    // Replays: nothing on normal sessions, full capture when an error occurs.
    // The Replay integration itself is attached lazily below — it is the
    // heaviest piece of the Sentry client and must stay out of the critical
    // bundle.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [],
    ignoreErrors: [
      "AbortError",
      "NetworkError",
      "Network request failed",
      "TypeError: Load failed",
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^safari-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  // Attach Replay after the page goes idle. Referencing Sentry.replayIntegration
  // statically would pull ~50KB+ (gz) of replay code into every page's initial
  // bundle; lazyLoadIntegration fetches it off the critical path instead.
  // Trade-off: an error thrown before the idle attach reports without a replay
  // — acceptable for the bundle/hydration win on every single page load.
  const attachReplay = () => {
    Sentry.lazyLoadIntegration("replayIntegration")
      .then((replayIntegration) => {
        Sentry.addIntegration(
          replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        );
      })
      .catch(() => {
        // CDN blocked/offline — errors still report, just without replays.
      });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(attachReplay, { timeout: 5000 });
  } else {
    window.setTimeout(attachReplay, 3000);
  }
}

// Required by @sentry/nextjs to instrument client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
