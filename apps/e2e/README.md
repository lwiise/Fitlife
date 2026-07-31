# @fitlife/e2e — family-of-three end-to-end suite

Simulates a Gulf household signing up, building a family of three, paying for the
«العائلة» plan in **LemonSqueezy test mode**, and then verifies the app's inputs
and outputs. Produces a pass/fail report at `reports/e2e-report.md` (+ `.json`).

> **Payment provider is LemonSqueezy, not Stripe.** The variant ids in
> `packages/config/src/pricing.ts` are test-mode. No card is charged; the default
> run never submits card details at all.

---

## Quick start

```bash
pnpm install
pnpm --filter @fitlife/e2e e2e:install     # one-time: download Chromium

cp apps/e2e/env.e2e.example.txt apps/e2e/.env.e2e   # then fill it in

# terminal 1 — the app under test
pnpm dev:app

# terminal 2
pnpm --filter @fitlife/e2e e2e
```

The report is written to `apps/e2e/reports/e2e-report.md`.

To let Playwright start the dev server itself, set `E2E_MANAGE_WEBSERVER=1` and
skip terminal 1.

---

## What it covers

| Spec | Covers |
| --- | --- |
| `01-family-journey.spec.ts` | The scenario: signup form → trial seeded → mom's profile → husband + child + housekeeper → tier gate refuses on trial → checkout session → signed webhook activates → active family/monthly at the right amount → all three on `/family`. |
| `02-checkout-guards.spec.ts` | `/api/checkout` refusals: 401 anonymous, 400 unknown tier, 409 when a live subscription already exists (prevents a duplicate uncancellable charge). |
| `03-webhook-contract.spec.ts` | The public payment webhook as a security boundary: forged signature, tampered body, and the `past_due` / `cancelled` / `expired` / unknown-event state machine. |
| `04-account-integrity.spec.ts` | RLS isolation between two households (read and write), the PDPL data export, and the family tier's 6-person boundary. |
| `05-hosted-checkout.spec.ts` | **Opt-in.** Completes LemonSqueezy's hosted checkout in a browser with test card `4242 4242 4242 4242`. |

Unit tests for the harness itself (`src/**/*.test.ts`) run under Vitest with
`pnpm --filter @fitlife/e2e test` — no app or database needed. They are part of
the monorepo's normal `pnpm test`.

---

## How payment is tested, and why

Payment here is a hosted redirect. `/api/checkout` mints a LemonSqueezy checkout
URL; the customer pays on LemonSqueezy's page; and the subscription only becomes
`active` when LemonSqueezy POSTs an **HMAC-signed webhook** to
`/api/webhooks/lemonsqueezy`. That webhook is the only thing in the codebase that
grants paid access.

So the default run:

1. Calls the **real** `/api/checkout` and asserts a hosted checkout URL is minted
   for the family/monthly **test-mode** variant.
2. Signs a **real** `subscription_created` payload with the app's actual webhook
   secret and POSTs it to the **real** route — the app's own signature
   verification stands between the test and the database. Nothing is mocked or
   stubbed.
3. Asserts the resulting account state.

Enabling `E2E_LIVE_CHECKOUT=1` adds a browser leg that fills the test card on
LemonSqueezy's own page. It is opt-in because it depends on third-party markup;
making it the default would trade determinism for coverage the steps above
already provide.

---

## Safety

The suite creates users, writes rows and activates subscriptions, so every
destructive capability is fenced:

- **Default-deny targets.** Any non-local app URL or Supabase URL is refused
  unless its exact hostname is in `E2E_ALLOW_TARGET`. The known production host
  (`fitlife-app-mvp.netlify.app`) is refused **even if listed** — there is no flag
  that makes production a valid target.
- **Sandbox variants only.** `src/guards.ts` holds a snapshot of the test-mode
  variant ids. `pricing.ts` carries a standing TODO to swap in live-mode ids
  before launch; on the day that happens, setup fails loudly instead of quietly
  creating billable checkouts.
- **Reserved email domain.** Every account is `…@e2e.fitlife.invalid`, and
  cleanup refuses to delete anything else.
- **Cleanup is reported, not assumed.** Teardown records what it deleted and what
  survived, and the report prints leftovers by name.
- **No AI spend.** The suite never triggers a plan generation. The tier-limit
  assertions deliberately use the single-member path, which is refused *before*
  dispatch. (A full-family run does **not** block on the person limit — it caps to
  `max_people` and generates — so calling it would cost real Anthropic tokens.)

Leftovers can always be swept manually:

```bash
pnpm --filter @fitlife/e2e cleanup -- --dry-run
pnpm --filter @fitlife/e2e cleanup
```

---

## Choosing a target database

The suite needs a **disposable** Supabase project — never the production one. Two
good options:

- **Local Supabase** (`supabase start`, requires Docker) — fastest and fully
  isolated. Point `E2E_SUPABASE_URL` at `http://127.0.0.1:54321`.
- **A separate staging Supabase project** — allow it explicitly via
  `E2E_ALLOW_TARGET=<project-ref>.supabase.co`.

Either way the target must have the migrations applied. Global setup calls
`/api/health` and warns if the schema looks missing. The suite only writes columns
from migrations **00001–00007** (the baseline CLAUDE.md records as verified in
production), so it also runs against a stack that has not yet applied 00013+.

---

## Notes on selectors

The app ships **no `data-testid` anywhere**, so browser steps query by the Arabic
label a user actually reads (`getByLabel("الإيميل")`, `getByRole("button", { name:
"دخول" })`). That is deliberately both a functional and an accessibility
assertion: if a label stops resolving, a screen-reader user has lost the form.

The multi-step onboarding wizards (10–11 adaptive steps for the owner, plus a
branched wizard per member) are **not** driven through the UI. Next.js Server
Actions are addressed by an encrypted per-build id with no stable HTTP contract,
and clicking through every wizard would test the wizard rather than the family
model. Family setup therefore writes through the same tables and the same **RLS
policies** the wizards write to, using the test user's own session — never the
service-role key. Adding test ids to the wizards would make a full UI-driven
variant practical; see the report's recommendations.
