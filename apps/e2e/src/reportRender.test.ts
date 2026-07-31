import { describe, expect, it } from "vitest";
import {
  condenseError,
  formatDuration,
  renderJson,
  renderMarkdown,
  stripAnsi,
  summarize,
  type CaseResult,
  type RunReport,
} from "./reportRender.js";

const CASE: CaseResult = {
  file: "tests/01-family-journey.spec.ts",
  suite: "Family of three",
  title: "activates the subscription",
  intent: "Payment activates the family plan.",
  status: "passed",
  durationMs: 1234,
};

function report(cases: CaseResult[], overrides: Partial<RunReport> = {}): RunReport {
  return {
    startedAt: "2026-07-31T09:00:00.000Z",
    finishedAt: "2026-07-31T09:02:00.000Z",
    durationMs: 120_000,
    environment: {
      baseUrl: "http://localhost:3001",
      supabaseHost: "127.0.0.1:54321",
      tier: "family",
      cadence: "monthly",
      priceSar: 129,
      variantId: "1677653",
      paymentMode: "LemonSqueezy TEST MODE",
      liveCheckout: false,
    },
    cases,
    warnings: [],
    ...overrides,
  };
}

describe("summarize", () => {
  it("counts each outcome and reports green only when nothing failed", () => {
    const s = summarize([
      { ...CASE, status: "passed" },
      { ...CASE, status: "failed" },
      { ...CASE, status: "skipped" },
      { ...CASE, status: "flaky" },
    ]);
    expect(s).toMatchObject({ total: 4, passed: 1, failed: 1, skipped: 1, flaky: 1, green: false });
  });

  it("counts timeouts and interruptions as failures", () => {
    expect(summarize([{ ...CASE, status: "timedOut" }]).failed).toBe(1);
    expect(summarize([{ ...CASE, status: "interrupted" }]).failed).toBe(1);
    expect(summarize([{ ...CASE, status: "interrupted" }]).green).toBe(false);
  });

  it("treats a run of only skips as green", () => {
    expect(summarize([{ ...CASE, status: "skipped" }]).green).toBe(true);
  });
});

describe("markdown report", () => {
  it("leads with the verdict and lists every case with its intent", () => {
    const md = renderMarkdown(report([CASE, { ...CASE, title: "second", status: "skipped" }]));
    expect(md).toContain("**PASSED**");
    expect(md).toContain("1/2 passed");
    expect(md).toContain("| PASS | Family of three › activates the subscription |");
    expect(md).toContain("Payment activates the family plan.");
    expect(md).toContain("| SKIP |");
    expect(md).toContain("family / monthly — 129 SAR");
  });

  it("renders a failure section with the error and the steps reached", () => {
    const md = renderMarkdown(
      report([
        {
          ...CASE,
          status: "failed",
          error: "expect(received).toBe(expected)\n\nExpected: active\nReceived: trialing",
          steps: ["submit the signup form", "activate via webhook"],
        },
      ]),
    );
    expect(md).toContain("**FAILED**");
    expect(md).toContain("## Failures");
    expect(md).toContain("Expected: active");
    expect(md).toContain("submit the signup form → activate via webhook");
  });

  it("escapes pipes so a message cannot break the table", () => {
    const md = renderMarkdown(report([{ ...CASE, title: "a | b", intent: "c | d" }]));
    const row = md.split("\n").find((l) => l.includes("a \\| b"));
    expect(row).toBeDefined();
    expect(row).toContain("c \\| d");
  });

  it("reports cleanup outcomes honestly, including leftovers", () => {
    const md = renderMarkdown(
      report([CASE], {
        cleanup: {
          attempted: 3,
          deleted: 2,
          failed: [{ userId: "u-1", email: "e2e-x@e2e.fitlife.invalid", reason: "network" }],
          skippedByRequest: false,
        },
      }),
    );
    expect(md).toContain("2/3 test account(s) hard-deleted");
    expect(md).toContain("Leftover accounts — delete manually");
    expect(md).toContain("e2e-x@e2e.fitlife.invalid");
  });

  it("says so when cleanup was deliberately skipped", () => {
    const md = renderMarkdown(
      report([CASE], {
        cleanup: { attempted: 2, deleted: 0, failed: [], skippedByRequest: true },
      }),
    );
    expect(md).toContain("Skipped by request");
    expect(md).toContain("E2E_KEEP_ACCOUNTS=1");
  });

  it("surfaces setup warnings", () => {
    const md = renderMarkdown(report([CASE], { warnings: ["No LemonSqueezy API key"] }));
    expect(md).toContain("## Warnings");
    expect(md).toContain("No LemonSqueezy API key");
  });
});

describe("json report", () => {
  it("puts the machine-readable summary first", () => {
    const parsed = JSON.parse(renderJson(report([CASE])));
    expect(parsed.summary).toMatchObject({ total: 1, passed: 1, green: true });
    expect(parsed.cases).toHaveLength(1);
    expect(parsed.environment.variantId).toBe("1677653");
  });
});

describe("formatting helpers", () => {
  it("formats durations readably", () => {
    expect(formatDuration(450)).toBe("450ms");
    expect(formatDuration(1500)).toBe("1.5s");
  });

  it("strips ANSI colour from Playwright diffs", () => {
    const ESC = String.fromCharCode(27);
    expect(stripAnsi(`${ESC}[2mExpected${ESC}[22m: active`)).toBe("Expected: active");
    expect(stripAnsi(`${ESC}[31mfailed${ESC}[39m`)).toBe("failed");
  });

  it("leaves ordinary bracketed text alone", () => {
    expect(stripAnsi("array[0] and [note] survive")).toBe("array[0] and [note] survive");
  });

  it("condenses a multi-line error to one line and truncates", () => {
    expect(condenseError("line one\n\n  line two")).toBe("line one line two");
    expect(condenseError("x".repeat(500))).toHaveLength(240);
  });
});
