// Sentry reporting over plain `fetch` — no SDK.
//
// Lives here rather than inline in the Netlify background function for two
// reasons: that function CANNOT import @sentry/* (zip-it-and-ship-it/esbuild
// chokes on its deps, the same reason Supabase is talked to over PostgREST
// there), and inline code in a .mts outside src/ is not reachable by the test
// runner. Error reporting that silently no-ops is worse than none, so it needs
// tests.
//
// Scope is deliberately small: report an exception with enough tags to find it.
// No breadcrumbs, no stack-frame parsing, no transport queue — Sentry groups on
// exception type + value, and the raw stack rides along in `extra`.

export interface SentryContext {
  /** Where in the run it failed, e.g. "meal-generation". Becomes a tag. */
  step: string;
  /** Supabase user id only — never a name, email, or anything health-related. */
  userId?: string;
  mealPlanId?: string;
  level?: "error" | "warning";
  /** Extra tags merged over the defaults. */
  tags?: Record<string, string>;
}

export interface SentryEndpoint {
  url: string;
  publicKey: string;
}

/**
 * Turn a DSN into the envelope endpoint.
 *
 * DSN is `https://<publicKey>@<host>/<projectId>`; the envelope endpoint is
 * `https://<host>/api/<projectId>/envelope/?sentry_key=…&sentry_version=7`.
 *
 * Returns null for anything malformed rather than throwing — a bad DSN must
 * disable reporting, never break the caller.
 */
export function sentryEndpointFromDsn(dsn?: string | null): SentryEndpoint | null {
  if (!dsn) return null;
  try {
    const { protocol, username, host, pathname } = new URL(dsn);
    const projectId = pathname.replace(/^\//, "").replace(/\/$/, "");
    if (!username || !projectId) return null;
    if (protocol !== "http:" && protocol !== "https:") return null;
    return {
      url: `${protocol}//${host}/api/${projectId}/envelope/?sentry_key=${username}&sentry_version=7`,
      publicKey: username,
    };
  } catch {
    return null;
  }
}

/** The event body, split out so tests can assert its shape without a network. */
export function buildSentryEvent(
  err: unknown,
  context: SentryContext,
  eventId: string,
  timestampSeconds: number,
  environment: string,
): Record<string, unknown> {
  const isError = err instanceof Error;
  return {
    event_id: eventId,
    timestamp: timestampSeconds,
    platform: "node",
    level: context.level ?? "error",
    logger: "generate-plan-background",
    environment,
    tags: {
      area: "plan-generation",
      runtime: "netlify-background",
      step: context.step,
      ...context.tags,
    },
    ...(context.userId ? { user: { id: context.userId } } : {}),
    extra: {
      meal_plan_id: context.mealPlanId ?? null,
      stack: isError ? err.stack : undefined,
    },
    exception: {
      values: [
        {
          type: isError ? err.name : "Error",
          value: isError ? err.message : String(err),
        },
      ],
    },
  };
}

/** Newline-delimited envelope: header, item header, item payload. */
export function buildSentryEnvelope(
  event: Record<string, unknown>,
  eventId: string,
  sentAtIso: string,
): string {
  return (
    JSON.stringify({ event_id: eventId, sent_at: sentAtIso }) +
    "\n" +
    JSON.stringify({ type: "event" }) +
    "\n" +
    JSON.stringify(event) +
    "\n"
  );
}

export interface CaptureOptions {
  dsn?: string | null;
  environment?: string;
  fetchImpl?: typeof fetch;
  /** Bounded so a hung Sentry cannot eat the 15-minute generation budget. */
  timeoutMs?: number;
  now?: () => number;
  eventId?: () => string;
}

/**
 * Best-effort exception report. NEVER throws and never retries: a generation
 * must not fail because error reporting did. A missing DSN (CI, local, preview)
 * makes it a silent no-op.
 *
 * Resolves `true` only when an event was actually POSTed, so callers and tests
 * can distinguish "sent" from "disabled".
 */
export async function captureToSentry(
  err: unknown,
  context: SentryContext,
  opts: CaptureOptions = {},
): Promise<boolean> {
  try {
    const dsn =
      opts.dsn ??
      (typeof process !== "undefined"
        ? process.env?.SENTRY_DSN || process.env?.NEXT_PUBLIC_SENTRY_DSN
        : undefined);
    const endpoint = sentryEndpointFromDsn(dsn);
    if (!endpoint) return false;

    const doFetch = opts.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
    if (!doFetch) return false;

    const nowMs = (opts.now ?? Date.now)();
    const eventId = (opts.eventId ?? defaultEventId)();
    const environment =
      opts.environment ??
      (typeof process !== "undefined" ? process.env?.NODE_ENV : undefined) ??
      "production";

    const event = buildSentryEvent(err, context, eventId, nowMs / 1000, environment);
    const body = buildSentryEnvelope(event, eventId, new Date(nowMs).toISOString());

    await doFetch(endpoint.url, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 3000),
    });
    return true;
  } catch {
    // Reporting the error must never become the error.
    return false;
  }
}

function defaultEventId(): string {
  // Sentry wants 32 hex chars, no dashes.
  return crypto.randomUUID().replace(/-/g, "");
}
