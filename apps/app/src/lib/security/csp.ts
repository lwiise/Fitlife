/**
 * Content-Security-Policy for the app, built at BUILD time in next.config.ts
 * from the public env (the same values Next inlines into the bundle).
 *
 * Shipped REPORT-ONLY first: nothing is blocked, every violation is reported
 * to Sentry's CSP endpoint (derived from the DSN) and visible in the browser
 * console. Promote to `Content-Security-Policy` once the manual test pass has
 * run clean — an enforced policy that misses one origin blanks a page.
 *
 * What the app actually loads (grep-verified 09/2026):
 *   scripts   – its own bundles, Next's inline bootstrap, the /landing page's
 *               inline RevealBootstrap (hence 'unsafe-inline'; a nonce would
 *               need the whole page dynamic), and PostHog's lazily fetched
 *               extension bundles from its assets host.
 *   styles    – its own CSS plus the inline styles Next and Tailwind emit.
 *   fonts     – Tajawal via next/font, self-hosted. No Google Fonts request.
 *   images    – own assets, next/image, blob previews before a photo upload,
 *               and the private body-photos bucket via SIGNED Supabase URLs.
 *   connect   – Supabase (REST, auth, storage, realtime over wss), PostHog,
 *               Sentry ingest.
 *   frames    – none: Salla's widget is gone, LemonSqueezy is a redirect.
 */
export interface CspEnv {
  supabaseUrl?: string;
  posthogHost?: string;
  sentryDsn?: string;
}

/** Origin of a URL, or null when it does not parse. */
function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Sentry's CSP report endpoint for a DSN of the form
 * https://<key>@<host>/<project>. Null when the DSN is unset or malformed.
 */
export function sentryCspReportUri(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\/+/, "");
    if (!url.username || !project) return null;
    return `https://${url.host}/api/${project}/security/?sentry_key=${url.username}`;
  } catch {
    return null;
  }
}

export function buildCsp(env: CspEnv): string {
  const supabase = origin(env.supabaseUrl) ?? "https://*.supabase.co";
  const supabaseWs = supabase.replace(/^https:/, "wss:");
  const posthog = origin(env.posthogHost) ?? "https://eu.i.posthog.com";
  // PostHog serves its lazily loaded feature bundles from a sibling host
  // (eu.i.posthog.com → eu-assets.i.posthog.com).
  const posthogAssets = posthog.replace(/\/\/([a-z]+)\.i\./, "//$1-assets.i.");
  const reportUri = sentryCspReportUri(env.sentryDsn);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", posthog, posthogAssets],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      supabase,
      supabaseWs,
      posthog,
      posthogAssets,
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://*.ingest.de.sentry.io",
    ],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  parts.push("upgrade-insecure-requests");
  if (reportUri) parts.push(`report-uri ${reportUri}`);
  return parts.join("; ");
}
