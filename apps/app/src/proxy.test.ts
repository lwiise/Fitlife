import { describe, expect, it } from "vitest";

import { config } from "./proxy";

/**
 * THE bug this file exists for.
 *
 * The app dispatches plan generation to
 * `/.netlify/functions/generate-plan-background` as a server-to-server fetch. It
 * carries no session cookies on purpose — it authenticates with the
 * `x-internal-secret` header — so to auth middleware it looks exactly like a
 * logged-out visitor. The matcher matched that path, `proxy()` redirected it to
 * `/auth/login`, and `fetch` followed the redirect to a 200 HTML page.
 *
 * A 200 is not a 202, but the dispatch check accepted any 2xx, so the app
 * recorded a successful enqueue for a worker that was never invoked. Every
 * generation then sat at 'generating' forever: no worker log, no Sentry event,
 * no failed row — because nothing had run and nothing knew.
 *
 * Two independent guards now prevent it (the matcher below and an early return
 * in proxy()). This pins the matcher, which is the one that keeps the middleware
 * from being invoked at all.
 */
const matcher = config.matcher[0]!;
const matches = (pathname: string) => new RegExp(`^${matcher}$`).test(pathname);

describe("proxy matcher", () => {
  it("does NOT match Netlify's function endpoints", () => {
    // The exact path whose interception stopped plan generation.
    expect(matches("/.netlify/functions/generate-plan-background")).toBe(false);
  });

  it("does not match any other Netlify platform path", () => {
    expect(matches("/.netlify/functions/some-other-function")).toBe(false);
    expect(matches("/.netlify/images")).toBe(false);
  });

  it("still matches the application routes it exists to protect", () => {
    // The exclusion must be surgical: everything the auth redirect guards has to
    // keep flowing through the middleware.
    expect(matches("/dashboard")).toBe(true);
    expect(matches("/plan")).toBe(true);
    expect(matches("/plan/history/2f8a1c3e-0000-4000-8000-000000000000")).toBe(true);
    expect(matches("/admin/subscribers/abc")).toBe(true);
    expect(matches("/auth/login")).toBe(true);
    expect(matches("/api/plans/status")).toBe(true);
    expect(matches("/")).toBe(true);
  });

  it("still skips the static assets it always skipped", () => {
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/logo.svg")).toBe(false);
    expect(matches("/hero.webp")).toBe(false);
  });
});
