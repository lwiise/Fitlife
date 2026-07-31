/**
 * Renders SAMPLE-REPORT.md so the report's shape is reviewable without a
 * database, a running app, or LemonSqueezy credentials.
 *
 * It calls the REAL renderer (src/reportRender.ts) with representative data —
 * including a deliberate failure — so the committed sample cannot drift from what
 * an actual run produces. Regenerate with:
 *
 *   pnpm --filter @fitlife/e2e sample-report
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown, type CaseResult, type RunReport } from "../src/reportRender.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function c(
  suite: string,
  title: string,
  intent: string,
  durationMs: number,
  extra: Partial<CaseResult> = {},
): CaseResult {
  return {
    file: "tests/01-family-journey.spec.ts",
    suite,
    title,
    intent,
    status: "passed",
    durationMs,
    ...extra,
  };
}

const JOURNEY = "Family of three — signup, payment, verification";

const report: RunReport = {
  startedAt: "2026-07-31T09:14:02.000Z",
  finishedAt: "2026-07-31T09:15:47.000Z",
  durationMs: 105_000,
  environment: {
    baseUrl: "http://localhost:3001",
    supabaseHost: "127.0.0.1:54321",
    tier: "family",
    cadence: "monthly",
    priceSar: 129,
    variantId: "1677653",
    paymentMode: "LemonSqueezy TEST MODE (no card submitted; signed webhook activation)",
    liveCheckout: false,
  },
  warnings: [
    "No LEMONSQUEEZY_API_KEY configured — the price assertion against the LemonSqueezy API was skipped; the amount is still verified against packages/config pricing.",
  ],
  cases: [
    c(JOURNEY, "a new customer creates an account through the signup form",
      "The public signup form creates a real Supabase auth user (email + password).", 6410,
      { steps: ["submit the signup form", "the auth user exists"] }),
    c(JOURNEY, "signup seeds a 7-day starter trial",
      "The handle_new_user trigger (migration 00004) seeds a trialing 'starter' subscription with a 7-day window.", 412),
    c(JOURNEY, "the owner completes her own profile",
      "The account owner (mom) is the first beneficiary and is stored on `profiles`, not on `family_members`.", 638),
    c(JOURNEY, "the husband and the child are added, plus a housekeeper",
      "Husband (role 'dad'), child (role 'son') and housekeeper are created with the correct member_type, language and meal_mode.", 1187,
      { steps: ["insert the members through RLS", "mark onboarding complete"] }),
    c(JOURNEY, "the household counts as exactly three beneficiaries",
      "Beneficiaries = mom + non-housekeeper members. The cook is on the plan but is not billed as a person.", 305),
    c(JOURNEY, "a family of three is refused on the starter trial",
      "Before paying, the tier gate blocks: the seeded trial is 'starter' (max 1) and the household is 3 → 403.", 902),
    c(JOURNEY, "checkout mints a LemonSqueezy TEST-MODE session for the family plan",
      "POST /api/checkout returns a hosted checkout URL for the family/monthly test-mode variant.", 2244),
    c(JOURNEY, "a signed LemonSqueezy webhook activates the subscription",
      "An HMAC-signed subscription_created webhook flips the row to active on the family tier.", 1503),
    c(JOURNEY, "a payment_success invoice event keeps the subscription active",
      "The renewal path: the real subscription id sits at attributes.subscription_id on invoice events.", 690),
    c(JOURNEY, "the account shows an active «العائلة» monthly subscription",
      "Payment state: status active, tier family, cadence monthly, family variant id, not cancelling.", 351),
    c(JOURNEY, "the subscription status API agrees",
      "/api/subscription/status reports the same active family/monthly state to the customer.", 588),
    c(JOURNEY, "the amount billed is the family plan's price",
      "Correct amount: the activated variant resolves to family/monthly at 129 SAR.", 274),
    c(JOURNEY, "all three members appear on the family page",
      "/family renders the husband, the child and the housekeeper, each by name.", 1839),

    { ...c("Checkout guards", "an anonymous request cannot start a checkout",
      "POST /api/checkout without a session returns 401.", 233), file: "tests/02-checkout-guards.spec.ts" },
    { ...c("Checkout guards", "a malformed tier is rejected",
      "The zod body schema rejects an unknown tier with 400.", 1902), file: "tests/02-checkout-guards.spec.ts" },
    { ...c("Checkout guards", "an already-subscribed customer cannot start a second checkout",
      "With a live subscription, /api/checkout returns 409 — preventing a duplicate, uncancellable charge.", 3277),
      file: "tests/02-checkout-guards.spec.ts" },

    { ...c("LemonSqueezy webhook contract", "an unsigned request cannot grant paid access",
      "A forged webhook is rejected with 401 and does NOT activate the subscription.", 2101),
      file: "tests/03-webhook-contract.spec.ts" },
    { ...c("LemonSqueezy webhook contract", "a tampered body invalidates the signature",
      "The HMAC covers the RAW body: a tier escalated after signing is rejected with 401.", 2044),
      file: "tests/03-webhook-contract.spec.ts" },
    { ...c("LemonSqueezy webhook contract", "a failed renewal moves the family to past_due",
      "subscription_payment_failed sets past_due — recoverable by updating the card.", 2610),
      file: "tests/03-webhook-contract.spec.ts" },
    { ...c("LemonSqueezy webhook contract", "cancelling keeps access until the paid-through date",
      "subscription_cancelled only flags cancel_at_period_end; the row stays active.", 2588),
      file: "tests/03-webhook-contract.spec.ts" },
    { ...c("LemonSqueezy webhook contract", "expiry ends paid access",
      "subscription_expired sets 'expired', which isSubscriptionActive() treats as no access.", 2470),
      file: "tests/03-webhook-contract.spec.ts" },
    { ...c("LemonSqueezy webhook contract", "an unknown event is acknowledged without changing state",
      "An unhandled but validly-signed event returns 200 and leaves the subscription untouched.", 1755),
      file: "tests/03-webhook-contract.spec.ts" },

    { ...c("Account integrity", "one family cannot read another family's members",
      "RLS isolation: a second account reads zero rows of the first account's family.", 3912),
      file: "tests/04-account-integrity.spec.ts" },
    { ...c("Account integrity", "one family cannot write into another family's household",
      "RLS on INSERT: an account cannot create a member under a different user_id.", 3401),
      file: "tests/04-account-integrity.spec.ts" },
    { ...c("Account integrity", "the data export contains the household the customer built",
      "PDPL portability: /api/account/export returns the profile and all three members, billing ids stripped.", 4180),
      file: "tests/04-account-integrity.spec.ts" },
    {
      ...c("Account integrity", "the family plan covers three people and refuses a seventh",
        "The «العائلة» tier's max_people is 6: three is covered, a seventh is refused.", 6021),
      file: "tests/04-account-integrity.spec.ts",
      status: "failed",
      error:
        "Error: expect(received).toContain(expected)\n\nExpected substring: \"7\"\nReceived string:    \"خطتك (العائلة) تسمح بـ 6 أشخاص فقط. عائلتك 6 أشخاص. ترقي للفاميلي\"\n\n    at tests/04-account-integrity.spec.ts:191:21",
      steps: ["activate the family plan", "add four extra members"],
    },

    {
      ...c("Hosted checkout (opt-in)", "a family pays with a test card and the subscription activates",
        "Full sandbox payment on LemonSqueezy's hosted page with test card 4242 4242 4242 4242.", 0),
      file: "tests/05-hosted-checkout.spec.ts",
      status: "skipped",
    },
  ],
  cleanup: {
    attempted: 9,
    deleted: 9,
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
