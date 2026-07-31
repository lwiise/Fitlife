/**
 * Pure rendering for the pass/fail report.
 *
 * Deliberately free of Playwright imports and of any I/O so the output format is
 * unit-testable (see reportRender.test.ts) — the reporter glue in reporter.ts is
 * the only part that needs a live run.
 */

export type CaseStatus = "passed" | "failed" | "flaky" | "skipped" | "timedOut" | "interrupted";

export interface CaseResult {
  /** Spec file, relative to apps/e2e. */
  file: string;
  /** Describe-block path, e.g. "Family journey › Payment". */
  suite: string;
  title: string;
  /** Plain-language statement of what this case verifies (from a test annotation). */
  intent?: string;
  status: CaseStatus;
  durationMs: number;
  /** First failure message, already stripped of ANSI colour. */
  error?: string;
  /** Named steps recorded during the case, in order. */
  steps?: string[];
  retries?: number;
}

export interface RunEnvironment {
  baseUrl: string;
  supabaseHost: string;
  tier: string;
  cadence: string;
  priceSar: number;
  variantId: string;
  paymentMode: string;
  liveCheckout: boolean;
}

export interface CleanupOutcome {
  attempted: number;
  deleted: number;
  failed: { userId: string; email: string; reason: string }[];
  skippedByRequest: boolean;
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  environment: RunEnvironment;
  cases: CaseResult[];
  cleanup?: CleanupOutcome;
  /** Setup-level problems that are not attributable to one case. */
  warnings: string[];
}

export interface Summary {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  /** True when nothing failed and nothing was interrupted. */
  green: boolean;
}

export function summarize(cases: readonly CaseResult[]): Summary {
  const count = (s: CaseStatus) => cases.filter((c) => c.status === s).length;
  const failed = count("failed") + count("timedOut") + count("interrupted");
  const summary: Summary = {
    total: cases.length,
    passed: count("passed"),
    failed,
    flaky: count("flaky"),
    skipped: count("skipped"),
    green: failed === 0,
  };
  return summary;
}

const STATUS_LABEL: Record<CaseStatus, string> = {
  passed: "PASS",
  failed: "FAIL",
  timedOut: "FAIL (timeout)",
  interrupted: "FAIL (interrupted)",
  flaky: "FLAKY",
  skipped: "SKIP",
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Strip ANSI escapes so the Markdown report is readable in a browser or a PR.
 * Playwright colourises assertion diffs, and those codes would otherwise land
 * in the .md file as visual noise (e.g. "[2mExpected[22m").
 */
const ANSI_ESCAPE = /[[0-9;]*[A-Za-z]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, "");
}

/** Collapse a multi-line assertion error to a single readable line for the table. */
export function condenseError(error: string, maxLength = 240): string {
  const flat = stripAnsi(error).replace(/\s+/g, " ").trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1)}…` : flat;
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

export function renderMarkdown(report: RunReport): string {
  const summary = summarize(report.cases);
  const env = report.environment;
  const lines: string[] = [];

  lines.push("# Fit Life — Family-of-Three E2E Report");
  lines.push("");
  lines.push(
    `**${summary.green ? "PASSED" : "FAILED"}** — ` +
      `${summary.passed}/${summary.total} passed, ${summary.failed} failed, ` +
      `${summary.flaky} flaky, ${summary.skipped} skipped ` +
      `(${formatDuration(report.durationMs)}).`,
  );
  lines.push("");

  lines.push("## Run context");
  lines.push("");
  lines.push("| Setting | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Started | ${report.startedAt} |`);
  lines.push(`| App under test | \`${env.baseUrl}\` |`);
  lines.push(`| Supabase host | \`${env.supabaseHost}\` |`);
  lines.push(`| Plan under test | ${env.tier} / ${env.cadence} — ${env.priceSar} SAR |`);
  lines.push(`| LemonSqueezy variant | \`${env.variantId}\` |`);
  lines.push(`| Payment mode | ${env.paymentMode} |`);
  lines.push(
    `| Hosted-checkout browser leg | ${env.liveCheckout ? "enabled" : "disabled (default)"} |`,
  );
  lines.push("");

  if (report.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  lines.push("## Results");
  lines.push("");
  lines.push("| # | Result | Test | What it verifies | Time |");
  lines.push("| --- | --- | --- | --- | --- |");
  report.cases.forEach((c, i) => {
    const name = c.suite ? `${c.suite} › ${c.title}` : c.title;
    lines.push(
      `| ${i + 1} | ${STATUS_LABEL[c.status]} | ${escapeCell(name)} | ` +
        `${escapeCell(c.intent ?? "—")} | ${formatDuration(c.durationMs)} |`,
    );
  });
  lines.push("");

  const failures = report.cases.filter(
    (c) => c.status === "failed" || c.status === "timedOut" || c.status === "interrupted",
  );
  if (failures.length > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const f of failures) {
      lines.push(`### ${f.suite ? `${f.suite} › ` : ""}${f.title}`);
      lines.push("");
      lines.push(`- **File:** \`${f.file}\``);
      if (f.intent) lines.push(`- **Verifies:** ${f.intent}`);
      if (f.steps && f.steps.length > 0) {
        lines.push(`- **Steps reached:** ${f.steps.join(" → ")}`);
      }
      lines.push("");
      lines.push("```");
      lines.push(stripAnsi(f.error ?? "No error message captured."));
      lines.push("```");
      lines.push("");
    }
  }

  const flaky = report.cases.filter((c) => c.status === "flaky");
  if (flaky.length > 0) {
    lines.push("## Flaky");
    lines.push("");
    for (const f of flaky) {
      lines.push(`- ${f.title} — passed on retry ${f.retries ?? 1}.`);
    }
    lines.push("");
  }

  lines.push("## Test data cleanup");
  lines.push("");
  if (!report.cleanup) {
    lines.push("Cleanup did not report — check global teardown output.");
  } else if (report.cleanup.skippedByRequest) {
    lines.push(
      `Skipped by request (\`E2E_KEEP_ACCOUNTS=1\`). ` +
        `${report.cleanup.attempted} test account(s) were left in place for debugging.`,
    );
  } else {
    lines.push(
      `${report.cleanup.deleted}/${report.cleanup.attempted} test account(s) hard-deleted.`,
    );
    if (report.cleanup.failed.length > 0) {
      lines.push("");
      lines.push("**Leftover accounts — delete manually:**");
      lines.push("");
      for (const f of report.cleanup.failed) {
        lines.push(`- \`${f.email}\` (${f.userId}) — ${f.reason}`);
      }
    }
  }
  lines.push("");

  return lines.join("\n");
}

export function renderJson(report: RunReport): string {
  return JSON.stringify({ summary: summarize(report.cases), ...report }, null, 2);
}

/** Short console summary printed at the end of a run. */
export function renderConsoleSummary(report: RunReport): string {
  const s = summarize(report.cases);
  const head = s.green ? "E2E PASSED" : "E2E FAILED";
  const failures = report.cases
    .filter((c) => c.status === "failed" || c.status === "timedOut")
    .map((c) => `  ✗ ${c.suite ? `${c.suite} › ` : ""}${c.title}\n    ${condenseError(c.error ?? "")}`);
  return [
    "",
    `${head} — ${s.passed} passed, ${s.failed} failed, ${s.skipped} skipped, ${s.flaky} flaky`,
    ...failures,
    "",
  ].join("\n");
}
