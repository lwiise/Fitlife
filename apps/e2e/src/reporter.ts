/**
 * Playwright reporter that emits the human-readable pass/fail report.
 *
 * Thin on purpose: it collects results and delegates every formatting decision to
 * the pure functions in reportRender.ts. Writes both a Markdown report (for a
 * human / a PR) and a JSON one (for CI to parse).
 *
 * The final write happens in `onExit`, not `onEnd`, because global teardown — which
 * hard-deletes the test accounts and records whether that succeeded — runs between
 * the two. Reporting cleanup honestly matters: a silent leak of test accounts is
 * exactly the kind of pollution this suite promises not to cause.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import {
  renderConsoleSummary,
  renderJson,
  renderMarkdown,
  summarize,
  type CaseResult,
  type CaseStatus,
  type CleanupOutcome,
  type RunEnvironment,
  type RunReport,
} from "./reportRender.js";

export const CLEANUP_FILE = "cleanup.json";
export const ENVIRONMENT_FILE = "environment.json";
export const WARNINGS_FILE = "warnings.json";

/**
 * The package root — anchored on this module's own location, NOT on
 * `config.rootDir`. Playwright derives `rootDir` from the common ancestor of the
 * discovered test files, so it is `apps/e2e/tests`, not `apps/e2e`, and using it
 * scattered the report and the state files into the tests directory.
 */
const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function toStatus(test: TestCase, result: TestResult): CaseStatus {
  const outcome = test.outcome();
  if (outcome === "flaky") return "flaky";
  if (outcome === "skipped") return "skipped";
  if (result.status === "timedOut") return "timedOut";
  if (result.status === "interrupted") return "interrupted";
  return result.status === "passed" ? "passed" : "failed";
}

/** Describe-block path, dropping the project and file segments Playwright prepends. */
function suitePath(test: TestCase): string {
  return test.titlePath().slice(3, -1).filter(Boolean).join(" › ");
}

export default class FamilyE2EReporter implements Reporter {
  private cases: CaseResult[] = [];
  private startedAt = new Date();
  private readonly rootDir = E2E_ROOT;
  private readonly outputDir = path.join(E2E_ROOT, "reports");
  private readonly stateDir = path.join(E2E_ROOT, ".e2e-state");

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startedAt = new Date();
    mkdirSync(this.outputDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const intent = test.annotations.find((a) => a.type === "verifies")?.description;
    const steps = result.steps
      .filter((s) => s.category === "test.step")
      .map((s) => s.title);

    this.cases.push({
      file: path.relative(this.rootDir, test.location.file).replace(/\\/g, "/"),
      suite: suitePath(test),
      title: test.title,
      intent,
      status: toStatus(test, result),
      durationMs: result.duration,
      error: result.error?.message ?? result.errors[0]?.message,
      steps: steps.length > 0 ? steps : undefined,
      retries: result.retry > 0 ? result.retry : undefined,
    });
  }

  onEnd(_result: FullResult): void {
    // Intentionally empty: cleanup has not run yet. See onExit.
  }

  async onExit(): Promise<void> {
    const finishedAt = new Date();
    const report: RunReport = {
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      environment: this.readEnvironment(),
      cases: this.cases,
      cleanup: this.readJson<CleanupOutcome>(CLEANUP_FILE),
      warnings: this.readJson<string[]>(WARNINGS_FILE) ?? [],
    };

    const markdownPath = path.join(this.outputDir, "e2e-report.md");
    const jsonPath = path.join(this.outputDir, "e2e-report.json");
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(markdownPath, renderMarkdown(report), "utf8");
    writeFileSync(jsonPath, renderJson(report), "utf8");

    // Consumed — a stale file must not be attributed to the next run.
    for (const file of [CLEANUP_FILE, WARNINGS_FILE, ENVIRONMENT_FILE]) {
      const p = path.join(this.stateDir, file);
      if (existsSync(p)) rmSync(p, { force: true });
    }

    process.stdout.write(renderConsoleSummary(report));
    process.stdout.write(
      `Report: ${path.relative(this.rootDir, markdownPath).replace(/\\/g, "/")}\n` +
        `        ${path.relative(this.rootDir, jsonPath).replace(/\\/g, "/")}\n\n`,
    );

    const summary = summarize(report.cases);
    if (!summary.green && process.exitCode === undefined) process.exitCode = 1;
  }

  private readJson<T>(file: string): T | undefined {
    const p = path.join(this.stateDir, file);
    if (!existsSync(p)) return undefined;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as T;
    } catch {
      return undefined;
    }
  }

  private readEnvironment(): RunEnvironment {
    return (
      this.readJson<RunEnvironment>(ENVIRONMENT_FILE) ?? {
        baseUrl: "unknown",
        supabaseHost: "unknown",
        tier: "unknown",
        cadence: "unknown",
        priceSar: 0,
        variantId: "unknown",
        paymentMode: "unknown",
        liveCheckout: false,
      }
    );
  }
}
