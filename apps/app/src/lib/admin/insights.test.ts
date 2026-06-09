import { describe, expect, it, vi } from "vitest";

// insights.ts → queries.ts → db.ts imports the service-role client factory.
// `server-only` is stubbed by vitest.config; stub the client factory too so the
// import chain never touches env. These pure functions don't call it.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import {
  classifyFailure,
  computeFailureBuckets,
  computeSuccessRate,
  type InsightsDataset,
} from "./insights";

const NOW = new Date("2026-06-15T00:00:00.000Z");

describe("classifyFailure", () => {
  it.each([
    ["max_tokens limit reached", "max_tokens"],
    ["Response was truncated", "max_tokens"],
    ["household too large for context length", "max_tokens"],
    ["request timed out after 60s", "timeout"],
    ["429 Too Many Requests", "rate_limit"],
    ["model overloaded, retry", "rate_limit"],
    ["Zod schema validation failed", "validation"],
    ["unexpected token in JSON", "validation"],
    ["Anthropic API returned 500", "api_error"],
    ["network ECONNRESET", "api_error"],
    ["something totally weird", "unknown"],
    [null, "unknown"],
  ])("classifies %j as %s", (input, expected) => {
    expect(classifyFailure(input)).toBe(expected);
  });
});

describe("computeFailureBuckets", () => {
  it("counts failed generations by cause, most common first", () => {
    const buckets = computeFailureBuckets([
      { status: "failed", error_message: "max_tokens", failure_reason: null },
      { status: "failed", error_message: "max_tokens exceeded", failure_reason: null },
      { status: "failed", error_message: null, failure_reason: "timed out" },
      { status: "completed", error_message: null, failure_reason: null },
    ]);
    expect(buckets[0]).toEqual({ cause: "max_tokens", count: 2 });
    expect(buckets.find((b) => b.cause === "timeout")?.count).toBe(1);
    // completed rows are ignored
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3);
  });

  it("falls back to failure_reason when error_message is null", () => {
    const buckets = computeFailureBuckets([
      { status: "failed", error_message: null, failure_reason: "rate limit 429" },
    ]);
    expect(buckets[0]?.cause).toBe("rate_limit");
  });
});

describe("computeSuccessRate", () => {
  it("expresses completed/(completed+failed) as a percent per month", () => {
    const ds: InsightsDataset = {
      profiles: [],
      subscriptions: [],
      members: [],
      plans: [],
      generations: [
        { id: "1", user_id: "u", status: "completed", created_at: "2026-06-02T00:00:00.000Z", cost_usd: 0, error_message: null, failure_reason: null, meal_plan_id: null },
        { id: "2", user_id: "u", status: "completed", created_at: "2026-06-03T00:00:00.000Z", cost_usd: 0, error_message: null, failure_reason: null, meal_plan_id: null },
        { id: "3", user_id: "u", status: "completed", created_at: "2026-06-04T00:00:00.000Z", cost_usd: 0, error_message: null, failure_reason: null, meal_plan_id: null },
        { id: "4", user_id: "u", status: "failed", created_at: "2026-06-05T00:00:00.000Z", cost_usd: 0, error_message: "x", failure_reason: null, meal_plan_id: null },
      ],
      chats: [],
      truncated: [],
    };
    const series = computeSuccessRate(ds, 6, NOW);
    const june = series[series.length - 1];
    expect(june?.total).toBe(4);
    expect(june?.successPct).toBe(75);
    // a month with no attempts is null, not 0 (no fabricated 100%)
    expect(series[0]?.successPct).toBeNull();
  });
});
