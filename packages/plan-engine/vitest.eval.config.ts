import { defineConfig } from "vitest/config";

// OFFLINE EVAL HARNESS — NOT part of CI.
// These specs call the REAL Anthropic API (real generateMealPlan), spend tokens,
// and are non-deterministic. They live in *.eval.ts so the default vitest config
// (include: src/**/*.test.ts) never picks them up. Run explicitly:
//   RUN_EVAL=1 ANTHROPIC_API_KEY=... pnpm --filter @fitlife/plan-engine eval
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.eval.ts"],
    passWithNoTests: true,
    // A real 7-day plan can take minutes per fixture; give each spec generous room.
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
