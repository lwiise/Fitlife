import { describe, it, expect, afterEach } from "vitest";

import {
  planRunBudgetMs,
  dayLoopDeadline,
  remainingMs,
  canFit,
  DEFAULT_PLAN_RUN_BUDGET_MS,
  FINALIZE_RESERVE_MS,
  TRANSLATION_RESERVE_MS,
} from "./budget";

const ORIGINAL = process.env.PLAN_RUN_BUDGET_MS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PLAN_RUN_BUDGET_MS;
  else process.env.PLAN_RUN_BUDGET_MS = ORIGINAL;
});

describe("planRunBudgetMs", () => {
  it("defaults to Netlify's 15-minute background budget", () => {
    delete process.env.PLAN_RUN_BUDGET_MS;
    expect(planRunBudgetMs()).toBe(DEFAULT_PLAN_RUN_BUDGET_MS);
    expect(DEFAULT_PLAN_RUN_BUDGET_MS).toBe(900_000);
  });

  it("honors the env override so prod can be retuned without a deploy", () => {
    process.env.PLAN_RUN_BUDGET_MS = "600000";
    expect(planRunBudgetMs()).toBe(600_000);
  });

  it("ignores junk rather than producing a zero or negative budget", () => {
    for (const bad of ["", "  ", "abc", "0", "-5", "NaN"]) {
      process.env.PLAN_RUN_BUDGET_MS = bad;
      expect(planRunBudgetMs()).toBe(DEFAULT_PLAN_RUN_BUDGET_MS);
    }
  });
});

describe("dayLoopDeadline", () => {
  it("reserves room for the final DB writes", () => {
    delete process.env.PLAN_RUN_BUDGET_MS;
    expect(dayLoopDeadline(1_000, false)).toBe(
      1_000 + DEFAULT_PLAN_RUN_BUDGET_MS - FINALIZE_RESERVE_MS,
    );
  });

  it("reserves the translation pass too when a housekeeper reads another language", () => {
    delete process.env.PLAN_RUN_BUDGET_MS;
    const withOut = dayLoopDeadline(1_000, false);
    const withIn = dayLoopDeadline(1_000, true);
    expect(withOut - withIn).toBe(TRANSLATION_RESERVE_MS);
  });

  it("is relative to the invocation start, so time already spent is not re-granted", () => {
    delete process.env.PLAN_RUN_BUDGET_MS;
    const early = dayLoopDeadline(0, false);
    const late = dayLoopDeadline(120_000, false);
    expect(late - early).toBe(120_000);
  });
});

describe("remainingMs / canFit", () => {
  it("treats an absent deadline as unbounded — the pre-deadline behavior", () => {
    expect(remainingMs(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(canFit(undefined, 10 * 60_000)).toBe(true);
  });

  it("never reports negative time left", () => {
    expect(remainingMs(1_000, 9_999)).toBe(0);
  });

  it("fits work that exactly consumes the remaining budget, and rejects one ms more", () => {
    const deadline = 100_000;
    const now = 40_000; // 60s left
    expect(canFit(deadline, 60_000, now)).toBe(true);
    expect(canFit(deadline, 60_001, now)).toBe(false);
  });

  it("rejects everything once the deadline has passed", () => {
    expect(canFit(1_000, 1, 5_000)).toBe(false);
  });
});
