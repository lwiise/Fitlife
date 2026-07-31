import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..");

/**
 * Read straight from process.env here rather than through src/config.ts.
 * config.ts validates aggressively (and refuses unsafe targets), which is right
 * for a run but wrong for config load: it would make `playwright test --list`
 * impossible without a full environment. Validation happens in global-setup,
 * before the first row is written.
 */
const baseURL = (process.env.E2E_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const manageWebServer = process.env.E2E_MANAGE_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./reports/artifacts",
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",

  /**
   * Serial on purpose. The scenario is a single customer journey — sign up, build
   * the family, pay, verify — and the supporting specs each mint real accounts
   * against a shared database. Parallel workers would interleave those writes and
   * trade the suite's repeatability for a few seconds of wall clock.
   */
  fullyParallel: false,
  workers: 1,

  /**
   * No retries locally: a retry that turns red into green hides exactly the kind
   * of race this suite exists to catch. CI gets one, to absorb genuine network
   * flake against Supabase / LemonSqueezy, and the report labels those FLAKY.
   */
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),

  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [["list"], ["./src/reporter.ts"]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 20_000,
    // The product is Arabic-first and RTL by default; testing it in any other
    // locale would exercise a page real users never see.
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
  },

  projects: [
    {
      name: "family-e2e",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  ...(manageWebServer
    ? {
        webServer: {
          command: "pnpm --filter @fitlife/app dev",
          cwd: REPO_ROOT,
          url: `${baseURL}/api/health`,
          reuseExistingServer: true,
          timeout: 180_000,
          stdout: "pipe" as const,
          stderr: "pipe" as const,
        },
      }
    : {}),
});
