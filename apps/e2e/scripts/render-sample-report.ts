/**
 * Renders SAMPLE-REPORT.md so the report's shape is reviewable without a
 * database, a running app, or LemonSqueezy credentials.
 *
 * It calls the REAL renderer (src/reportRender.ts) with representative data —
 * including a deliberate failure — so the committed sample cannot drift from what
 * an actual run produces. Regenerate with:
 *
 *   pnpm --filter @fitlife/e2e sample-report
 *
 * The sample models the DEFAULT run, with the payment phase deferred: 12 cases,
 * and the prominent warning that makes a green run impossible to mistake for
 * "the purchase flow is covered".
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown, type CaseResult, type RunReport } from "../src/reportRender.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function c(
  file: string,
  suite: string,
  title: string,
  intent: string,
  durationMs: number,
  extra: Partial<CaseResult> = {},
): CaseResult {
  return { file, suite, title, intent, status: "passed", durationMs, ...extra };
}

const JOURNEY_FILE = "tests/01-family-journey.spec.ts";
const JOURNEY = "Family of three — signup and household";
const GUARDS_FILE = "tests/02-checkout-guards.spec.ts";
const INTEGRITY_FILE = "tests/04-account-integrity.spec.ts";

const report: RunReport = {
  startedAt: "2026-07-31T09:14:02.000Z",
  finishedAt: "2026-07-31T09:15:07.000Z",
  durationMs: 65_000,
  environment: {
    baseUrl: "http://localhost:3001",
    supabaseHost: "127.0.0.1:54321",
    tier: "family",
    cadence: "monthly",
    priceSar: 129,
    variantId: "1677653",
    paymentMode: "DEFERRED — @billing tests excluded from this run",
    liveCheckout: false,
  },
  warnings: [
    "PAYMENT PHASE DEFERRED: every @billing test (checkout, payment webhook, paid subscription state) was excluded from this run. Coverage of the purchase flow is NOT represented below. Re-enable with E2E_INCLUDE_BILLING=1.",
  ],
  cases: [
    c(JOURNEY_FILE, JOURNEY, "a new customer creates an account through the signup form",
      "The public signup form creates a real Supabase auth user (email + password).", 6410,
      { steps: ["submit the signup form", "the auth user exists"] }),
    c(JOURNEY_FILE, JOURNEY, "signup seeds a 7-day starter trial",
      "The handle_new_user trigger (migration 00004) seeds a trialing 'starter' subscription with a 7-day window.", 412),
    c(JOURNEY_FILE, JOURNEY, "the owner completes her own profile",
      "The account owner (mom) is the first beneficiary and is stored on `profiles`, not on `family_members`.", 638),
    c(JOURNEY_FILE, JOURNEY, "the husband and the child are added, plus a housekeeper",
      "Husband (role 'dad'), child (role 'son') and housekeeper are created with the correct member_type, language and meal_mode.", 1187,
      { steps: ["insert the members through RLS", "mark onboarding complete"] }),
    c(JOURNEY_FILE, JOURNEY, "the household counts as exactly three beneficiaries",
      "Beneficiaries = mom + non-housekeeper members. The cook is on the plan but is not billed as a person.", 305),
    c(JOURNEY_FILE, JOURNEY, "a family of three is refused on the starter trial",
      "Before paying, the tier gate blocks: the seeded trial is 'starter' (max 1) and the household is 3 → 403.", 902),
    c(JOURNEY_FILE, JOURNEY, "the household renders on the family page",
      "/family shows the husband, the child and the housekeeper by name, independently of payment state.", 1839),

    c(GUARDS_FILE, "Checkout guards", "an anonymous request cannot start a checkout",
      "POST /api/checkout without a session returns 401.", 233),
    c(GUARDS_FILE, "Checkout guards", "a malformed tier is rejected",
      "The zod body schema rejects an unknown tier with 400, before the route touches LemonSqueezy.", 1902),

    c(INTEGRITY_FILE, "Account integrity", "one family cannot read another family's members",
      "RLS isolation: a second account reads zero rows of the first account's family.", 3912),
    c(INTEGRITY_FILE, "Account integrity", "one family cannot write into another family's household",
      "RLS on INSERT: an account cannot create a member under a different user_id.", 3401),
    {
      ...c(INTEGRITY_FILE, "Account integrity", "the data export contains the household the customer built",
        "PDPL portability: /api/account/export returns the profile and all three members, billing ids stripped.", 4180),
      status: "failed",
      error:
        "Error: expect(received).toHaveLength(expected)\n\nExpected length: 3\nReceived length: 2\nReceived array:  [{ name: 'خالد', role: 'dad' }, { name: 'سعود', role: 'son' }]\n\n    at tests/04-account-integrity.spec.ts:118:41",
      steps: ["build the household", "sign in and request the export"],
    },
  ],
  cleanup: {
    attempted: 4,
    deleted: 4,
    failed: [],
    skippedByRequest: false,
  },
};

const out = path.resolve(here, "..", "SAMPLE-REPORT.md");
const banner = [
  "<!--",
  "  ILLUSTRATIVE SAMPLE — not the output of a real run.",
  "  Generated by scripts/render-sample-report.ts using the real renderer, so the",
  "  format here always matches what `pnpm --filter @fitlife/e2e e2e` produces at",
  "  reports/e2e-report.md. The failure shown is fabricated to demonstrate the",
  "  failure section.",
  "-->",
  "",
].join("\n");

writeFileSync(out, banner + renderMarkdown(report), "utf8");
console.log(`Wrote ${out}`);
