import { describe, it, expect } from "vitest";
import { generateMealPlan } from "../generate";
import type { MealPlan } from "../schema";
import { EVAL_FIXTURES } from "./fixtures";
import { scorePlan } from "./metrics";

// ── Offline eval harness (WS5b) ───────────────────────────────────────────────
// Establishes a quality + latency BASELINE against the real API so later quality
// work (WS3 corrective guards, WS3b temperature, WS4 anti-repetition) is provably
// an improvement, not a guess. Gated on RUN_EVAL=1 + ANTHROPIC_API_KEY so it never
// runs in CI / `pnpm test` and never spends tokens unintentionally.

const apiKey = process.env.ANTHROPIC_API_KEY;
const enabled = process.env.RUN_EVAL === "1" && !!apiKey;

// Loose regression bands — generous on purpose. The point of the baseline run is
// to RECORD the real numbers (printed below) and tighten these once we've seen a
// few clean runs; a failing assertion here means a real regression, not noise.
const MAX_ACCEPTABLE_MEAN_DRIFT_PCT = 25;
const MAX_ACCEPTABLE_REFINED_VIOLATIONS = 2;

interface RunResult {
  fixture: string;
  totalMs: number;
  timeToFirstDayMs: number | null;
  missingDays: number[];
  report: ReturnType<typeof scorePlan>;
}

const results: RunResult[] = [];

(enabled ? describe : describe.skip)("plan generation eval (real API)", () => {
  for (const fixture of EVAL_FIXTURES) {
    it(`generates a quality plan for: ${fixture.name}`, async () => {
      const start = Date.now();
      let firstDayMs: number | null = null;

      const out = await generateMealPlan({
        anthropicApiKey: apiKey!,
        context: fixture.context,
        onProgress: () => {
          // Skeleton completes before any day; the first day snapshot is our
          // proxy for "time to first visible content".
          if (firstDayMs === null) firstDayMs = Date.now() - start;
        },
      });

      const totalMs = Date.now() - start;
      const report = scorePlan(out.plan as MealPlan);
      results.push({
        fixture: fixture.name,
        totalMs,
        timeToFirstDayMs: firstDayMs,
        missingDays: out.missingDays,
        report,
      });

      // Per-fixture report line (visible with --reporter=verbose or on failure).
      // eslint-disable-next-line no-console
      console.log(
        `[eval] ${fixture.name}: ${(totalMs / 1000).toFixed(1)}s total, ` +
          `first-day ${firstDayMs === null ? "n/a" : (firstDayMs / 1000).toFixed(1) + "s"}, ` +
          `meanDrift ${report.macro.meanDriftPct.toFixed(1)}%, ` +
          `maxDrift ${report.macro.maxDriftPct.toFixed(1)}%, ` +
          `worstRepeat ${report.repeat.worstRepeatPct.toFixed(1)}%, ` +
          `refined ${report.refinedFlourViolations}, ` +
          `missingDays [${out.missingDays.join(",")}]`,
      );

      // Hard correctness gates (a plan that fails these is broken, not just noisy).
      expect(out.missingDays, "no days should be dropped").toEqual([]);
      expect(out.plan.members.length, "every beneficiary has a member plan").toBeGreaterThan(0);

      // Soft regression gates (loose; tighten after baseline runs).
      expect(report.macro.meanDriftPct).toBeLessThanOrEqual(MAX_ACCEPTABLE_MEAN_DRIFT_PCT);
      expect(report.refinedFlourViolations).toBeLessThanOrEqual(
        MAX_ACCEPTABLE_REFINED_VIOLATIONS,
      );
    });
  }

  it("prints a baseline summary table", () => {
    if (results.length === 0) return;
    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        fixture: r.fixture,
        "total(s)": (r.totalMs / 1000).toFixed(1),
        "firstDay(s)": r.timeToFirstDayMs === null ? "n/a" : (r.timeToFirstDayMs / 1000).toFixed(1),
        "meanDrift%": r.report.macro.meanDriftPct.toFixed(1),
        "maxDrift%": r.report.macro.maxDriftPct.toFixed(1),
        "worstRepeat%": r.report.repeat.worstRepeatPct.toFixed(1),
        refined: r.report.refinedFlourViolations,
        missing: r.missingDays.length,
      })),
    );
  });
});

if (!enabled) {
  describe("plan generation eval", () => {
    it.skip("skipped — set RUN_EVAL=1 and ANTHROPIC_API_KEY to run", () => {});
  });
}
