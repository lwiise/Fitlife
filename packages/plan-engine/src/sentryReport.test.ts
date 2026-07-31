import { describe, it, expect, vi } from "vitest";

import {
  buildSentryEnvelope,
  buildSentryEvent,
  captureToSentry,
  sentryEndpointFromDsn,
} from "./sentryReport";

const DSN = "https://pub1ickey@o4507.ingest.de.sentry.io/4509876";

describe("sentryEndpointFromDsn", () => {
  it("builds the envelope endpoint from a real DSN shape", () => {
    expect(sentryEndpointFromDsn(DSN)).toEqual({
      url: "https://o4507.ingest.de.sentry.io/api/4509876/envelope/?sentry_key=pub1ickey&sentry_version=7",
      publicKey: "pub1ickey",
    });
  });

  it("returns null for anything malformed rather than throwing", () => {
    // A bad DSN must DISABLE reporting, never break the generation that is
    // trying to report.
    expect(sentryEndpointFromDsn(undefined)).toBeNull();
    expect(sentryEndpointFromDsn("")).toBeNull();
    expect(sentryEndpointFromDsn("not-a-url")).toBeNull();
    expect(sentryEndpointFromDsn("https://o4507.ingest.sentry.io/4509876")).toBeNull(); // no key
    expect(sentryEndpointFromDsn("https://key@o4507.ingest.sentry.io/")).toBeNull(); // no project
    expect(sentryEndpointFromDsn("ftp://key@host/1")).toBeNull(); // wrong scheme
  });
});

describe("buildSentryEvent", () => {
  it("carries the step tag and the exception type and message", () => {
    const err = new TypeError("model returned no JSON");
    const event = buildSentryEvent(
      err,
      { step: "meal-generation", userId: "u-1", mealPlanId: "p-1" },
      "abc",
      1700000000,
      "production",
    );
    expect(event.tags).toMatchObject({
      area: "plan-generation",
      runtime: "netlify-background",
      step: "meal-generation",
    });
    expect(event.exception).toEqual({
      values: [{ type: "TypeError", value: "model returned no JSON" }],
    });
    expect(event.level).toBe("error");
  });

  it("sends the user id and nothing else identifying", () => {
    // The whole point of the id-only rule: no name, no email, and above all no
    // health data can reach a third party.
    const event = buildSentryEvent(
      new Error("x"),
      { step: "s", userId: "u-1" },
      "abc",
      1,
      "production",
    );
    // Exactly one key — an added `email` or `username` here would ship PII to a
    // third party without anyone noticing.
    expect(Object.keys(event.user as object)).toEqual(["id"]);

    // Nothing health-related anywhere in what we construct. The stack is
    // excluded on purpose: it is developer data (node_modules paths), it is not
    // built from the user's row, and matching against it produces false hits.
    const extra = event.extra as Record<string, unknown>;
    const withoutStack = { ...event, extra: { ...extra, stack: undefined } };
    expect(JSON.stringify(withoutStack)).not.toMatch(
      /weight|allerg|pregnan|birth_year|display_name|medical|email/i,
    );
  });

  it("omits the user object entirely when there is no id", () => {
    const event = buildSentryEvent(new Error("x"), { step: "s" }, "abc", 1, "production");
    expect(event).not.toHaveProperty("user");
  });

  it("handles a thrown non-Error without losing the value", () => {
    const event = buildSentryEvent("just a string", { step: "s" }, "abc", 1, "test");
    expect(event.exception).toEqual({
      values: [{ type: "Error", value: "just a string" }],
    });
  });

  it("honours an explicit warning level", () => {
    const event = buildSentryEvent(
      new Error("probe"),
      { step: "s", level: "warning" },
      "abc",
      1,
      "test",
    );
    expect(event.level).toBe("warning");
  });
});

describe("buildSentryEnvelope", () => {
  it("emits three newline-delimited JSON lines with a matching event_id", () => {
    // Sentry rejects an envelope whose header id does not match the item's.
    const event = buildSentryEvent(new Error("x"), { step: "s" }, "id123", 1, "test");
    const lines = buildSentryEnvelope(event, "id123", "2026-01-01T00:00:00.000Z")
      .trimEnd()
      .split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!)).toEqual({
      event_id: "id123",
      sent_at: "2026-01-01T00:00:00.000Z",
    });
    expect(JSON.parse(lines[1]!)).toEqual({ type: "event" });
    expect(JSON.parse(lines[2]!).event_id).toBe("id123");
  });
});

describe("captureToSentry", () => {
  const fixed = { now: () => 1700000000000, eventId: () => "fixedid" };

  it("POSTs a well-formed envelope to the endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    const sent = await captureToSentry(
      new Error("boom"),
      { step: "meal-generation", userId: "u-1" },
      { dsn: DSN, fetchImpl: fetchImpl as unknown as typeof fetch, ...fixed },
    );

    expect(sent).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("/api/4509876/envelope/");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/x-sentry-envelope");
    const payload = JSON.parse((init.body as string).trimEnd().split("\n")[2]!);
    expect(payload.exception.values[0].value).toBe("boom");
  });

  it("is a silent no-op with no DSN — the CI and local default", async () => {
    const fetchImpl = vi.fn();
    const sent = await captureToSentry(
      new Error("boom"),
      { step: "s" },
      { dsn: null, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(sent).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  // The contract that matters most: this runs inside a 15-minute generation.
  // Reporting the error must never become the error.
  it("never throws when the transport fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(
      captureToSentry(
        new Error("boom"),
        { step: "s" },
        { dsn: DSN, fetchImpl: fetchImpl as unknown as typeof fetch, ...fixed },
      ),
    ).resolves.toBe(false);
  });

  it("never throws when Sentry returns an error status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 429 }));
    await expect(
      captureToSentry(
        new Error("boom"),
        { step: "s" },
        { dsn: DSN, fetchImpl: fetchImpl as unknown as typeof fetch, ...fixed },
      ),
    ).resolves.toBe(true); // delivered; rate-limiting is Sentry's business
  });

  it("bounds the request so a hung Sentry cannot eat the generation budget", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    await captureToSentry(
      new Error("boom"),
      { step: "s" },
      { dsn: DSN, fetchImpl: fetchImpl as unknown as typeof fetch, ...fixed },
    );
    expect(fetchImpl.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  });
});
