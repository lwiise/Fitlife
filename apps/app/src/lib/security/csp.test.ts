import { describe, it, expect } from "vitest";
import { buildCsp, sentryCspReportUri } from "./csp";

const ENV = {
  supabaseUrl: "https://gtatpzxmrstigtnkgxny.supabase.co",
  posthogHost: "https://eu.i.posthog.com",
  sentryDsn: "https://abc123@o4507.ingest.de.sentry.io/4509",
};

describe("buildCsp", () => {
  const csp = buildCsp(ENV);
  const directive = (name: string) =>
    csp.split("; ").find((d) => d.startsWith(`${name} `))?.slice(name.length + 1) ?? "";

  it("names the exact Supabase project for data and realtime, never a wildcard", () => {
    expect(directive("connect-src")).toContain("https://gtatpzxmrstigtnkgxny.supabase.co");
    expect(directive("connect-src")).toContain("wss://gtatpzxmrstigtnkgxny.supabase.co");
    expect(directive("img-src")).toContain("https://gtatpzxmrstigtnkgxny.supabase.co");
    expect(csp).not.toContain("*.supabase.co");
  });

  it("allows PostHog and its assets host for scripts and connections", () => {
    expect(directive("script-src")).toContain("https://eu.i.posthog.com");
    expect(directive("script-src")).toContain("https://eu-assets.i.posthog.com");
    expect(directive("connect-src")).toContain("https://eu-assets.i.posthog.com");
  });

  it("locks down frames, objects and base", () => {
    expect(directive("frame-ancestors")).toBe("'none'");
    expect(directive("frame-src")).toBe("'none'");
    expect(directive("object-src")).toBe("'none'");
    expect(directive("base-uri")).toBe("'self'");
  });

  it("reports to Sentry's CSP endpoint derived from the DSN", () => {
    expect(csp).toContain(
      "report-uri https://o4507.ingest.de.sentry.io/api/4509/security/?sentry_key=abc123",
    );
  });

  it("falls back to wildcards and omits report-uri without env (CI build)", () => {
    const bare = buildCsp({});
    expect(bare).toContain("https://*.supabase.co");
    expect(bare).toContain("https://eu.i.posthog.com");
    expect(bare).not.toContain("report-uri");
  });

  it("is a single header line with no stray separators", () => {
    expect(csp).not.toMatch(/;\s*;/);
    expect(csp).not.toMatch(/\n/);
  });
});

describe("sentryCspReportUri", () => {
  it("returns null for a missing or malformed DSN", () => {
    expect(sentryCspReportUri(undefined)).toBeNull();
    expect(sentryCspReportUri("")).toBeNull();
    expect(sentryCspReportUri("not a dsn")).toBeNull();
    expect(sentryCspReportUri("https://host.only/")).toBeNull();
  });
});
