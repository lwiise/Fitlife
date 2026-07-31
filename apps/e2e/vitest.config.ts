import { defineConfig } from "vitest/config";

/**
 * Unit tests for the suite's own logic — the safety guards, the webhook signer
 * and the report renderer. These are pure and need no app, no database and no
 * network, so they run in CI alongside the rest of the monorepo's tests and keep
 * the E2E harness itself honest.
 *
 * The Playwright specs under tests/ are deliberately excluded: they require a
 * running app and a disposable database, and are driven by `pnpm e2e`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: false,
  },
});
