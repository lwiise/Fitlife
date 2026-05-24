// Next.js 16 instrumentation hook — registers the runtime-appropriate Sentry
// config and forwards request errors to Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >
) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
