# Production QA — full test report

**Run window:** 26–27 July 2026
**Target:** production (`fitlife-app-mvp.netlify.app`) + production Supabase
**Accounts created:** 38 real accounts (`fitlife.qa+<persona>-<id>@gmail.com`)
**Recorded API spend:** $7.09 (plus two runs the app recorded as $0 — see §4)

Everything below ran against the live product with a real browser (Playwright driving
Chromium), completing the real signup wizard, writing real rows, and calling the real
Anthropic API. Nothing was mocked.

---

## 1. Coverage

### Solo personas — 14 run, 14 correct

| Persona | What it proves | Result | Cost |
|---|---|---|---|
| `solo-loss` | baseline fat-loss plan | **PASS** 7/7 days, every day 1600 kcal at **0.0% deviation** | $0.373 |
| `pregnant` | pregnancy branch + stage calories | **PASS** | $0.256 |
| `pregnant-highrisk` | high-risk pregnancy doctor gate | **PASS** | $0.261 |
| `lactating` | lactation calorie addition | **PASS** | $0.275 |
| `postpartum-nonlactating` | the 07/2026 postpartum-without-lactation fix | **PASS** | $0.775 |
| `stable-pcos` | a stable condition must NOT erase the stated goal | **PASS** | $0.207 |
| `gate-heart` | a high-risk condition MUST lead the plan | **PASS** | $0.871 |
| `solo-muscle` | build-muscle goal mapping | **PASS** | $0.282 |
| `solo-recomp` | recomposition goal mapping | **PASS** | $0.264 |
| `solo-maintain` | maintenance goal mapping | **PASS** | $0.495 |
| `solo-health` | «تحسين الحالة الصحية» stays condition-led | **PASS** | $0.291 |
| `solo-athletic` | athletic goal + workout plan | **PASS** meal + workout both completed | $0.474 |
| `male-gym` | male owner + gym workout plan | **PASS** meal $0.520 + workout $0.091 | $0.611 |
| `under-18` | **minors must be refused** | **PASS — refused, no plan generated** | $0 |

`stable-pcos` vs `gate-heart` passing together is the goal-mapping split working: PCOS
(very common in this audience) keeps her stated fat-loss goal, while a high-risk cardiac
condition takes over the plan. `under-18` confirms the P0 minor block in production.

The `solo-loss` plan came back with Gulf staples — كبسة، مرقوق، جريش، مضغوط — confirming the
prompt-precedence fix (methodology over cookbook) reached production.

### Households — 4 rounds, all 6 personas

`fam-2` … `fam-6` and `family-maid` were run **four times**. Rounds 1–3 failed entirely on
harness defects (§2). Round 4 was the first honest read:

| Persona | Members expected | Result |
|---|---|---|
| `fam-6` mom + husband + 3 children + second adult | 5 | **PASS** — 5 stored, plan completed |
| `fam-5` mom + husband + 2 children + maid | 3 + housekeeper | **PASS** — 4 stored, housekeeper correctly excluded from the cap |
| `fam-4` mom + husband + 2 children (ages 7, 12) | 3 | **FAIL** — 3 stored correctly, but generation stuck at 6/7 days |
| `fam-3`, `fam-2`, `family-maid` | 2, 1, 2 | **FAIL** — wizard died mid-flow (§3) |

### Paid multi-member generation — the important one

Households on a free trial are capped at `starter` (`max_people: 1`), so only the mom's plan
generates. Members are *stored* but multi-member generation had **never been exercised**.
After you paid for a `family` subscription manually, these ran on that one account:

| Beneficiaries | Outcome | Days landed | Cost recorded |
|---|---|---|---|
| 1 (before payment) | completed, 283s | 7/7 | $0.339 |
| **6** | **killed at the 15-min budget** | 6/7 | **$0** |
| **4** | **killed at the 15-min budget** | 4/7 | **$0** |
| 3 | never started — Anthropic credit exhausted | — | — |

Size-4 per-day landings: **147s, 167s, 455s, 516s**, then nothing for ~380s.

---

## 2. Harness defects found and fixed (not product bugs)

Rounds 1–3 of the household matrix produced 18 failures that were entirely mine. Recording
them because they explain why the first three rounds must be discarded:

| Defect | Effect |
|---|---|
| `journey.mjs` didn't know the member form's abbreviated ids (`m-name`, `m-by`, `m-h`, `m-w`) | left the name blank and put `2` in the birth year; the app correctly refused → 0 members stored |
| `CheckRow`'s root element *is* the button, so the ancestor walk always resolved to the wrapper | every household toggle clicked زوج; the second toggle turned the husband back OFF |
| Guard read `aria-pressed`, but `CheckRow` publishes `aria-checked` | the composition verifier reported success on a wrong household |
| Generic field-filler ran on the household picker | invented answers on a screen that has none |
| The cookie-consent bar covered the wizard's primary CTA | measured **182px of the CTA obscured** on production |
| Ledger overwrote on re-run | **orphaned 12 live production accounts** — fixed by making it append-only |
| `run-matrix.mjs` settled on the meal row only | a failed workout plan would have passed silently (it masked `solo-athletic`) |

The fix rule that matters: an unmapped numeric field is now **skipped, never invented**, so a
harness gap fails loudly instead of silently producing wrong test data.

---

## 3. Product bugs found

### FIXED (committed, tested, pushed)

**B1 — Generation ran past Netlify's 15-minute budget and was hard-killed.**
Every per-call budget was sized to the work alone, with nothing enforcing the ceiling across a
run: `bigCallTimeoutMs` allows 400s for one 6-member day call, `CONTENT_MAX_RETRIES` adds two
more full calls per day, `MAX_RETRIES` adds five API retries with sleeps, and a second-chance
wave re-ran failed days. A kill runs neither the success path nor the catch.
*Fix:* `packages/plan-engine/src/budget.ts` — the run now stops while it still has room and
hands back a partial week, which the existing `DeferredMemberDrain` completes across
invocations. Any household size works, in bounded chunks.

**B2 — A killed run's finished days were discarded.**
`getLatestPlan` correctly detected the dead run but then nulled `plan_data`. A household killed
at 4 of 7 days lost all four — days the customer waited for and the business had already paid
for — and the retry re-spent the whole budget. Because staleness is measured off `updated_at`
and the dying worker kept bumping it, the wait before that was **~28 minutes**.
*Fix:* `apps/app/src/lib/plans/staleness.ts` keeps a partial week and surfaces it as
ready-but-incomplete, plus a calm Arabic notice on /plan.

**B3 — Every failed generation was costed at $0.**
Both catch blocks wrote status, duration and error but never `cost_usd`, and the running totals
died with the exception. This was broader than the kills — *any* failure read $0 in the admin
cost view, and the bias ran the wrong way: the largest households are both the most expensive
and the most likely to fail.
*Fix:* an `onUsage` callback publishes cumulative usage; both catch paths record it.

### DEFERRED BY OWNER DECISION

**B4 — `/onboarding` has no route-level `error.tsx`.**
A Server Action transport error escapes to `global-error.tsx` and kills the whole wizard. The
only route-level boundary in the app is `/admin`. This caused 3 of the 6 round-4 household
failures and produced a real Sentry issue during the run. *Status: you parked this twice.*

**B5 — The raw vendor error reaches the customer.**
`PlanFailedState.tsx:73` renders `error_message` inside a collapsed «تفاصيل تقنية». Today that
string is the Anthropic 400 saying your credit balance ran out. *Status: you deselected this.*

---

## 4. Live production incident

**Anthropic credit balance is exhausted.** The size-3 run failed in 1 second with a 400. That is
the production key, so **every real customer's plan generation is failing right now**. Today's QA
consumed the remaining balance — and because of B3 the two most expensive runs were recorded as
$0, so there was no running total to watch. Top up at console.anthropic.com; no code change is
needed.

---

## 5. Open items

- **38 test accounts are still live** in production, holding realistic PII. `cleanup-all.mjs`
  deletes all of them and proves each by a failing sign-in. Recommend keeping
  `fitlife.qa+fam-6-hdyzia0@gmail.com` (the paid `family` subscription) so testing can resume.
- **One verification run is owed** after the top-up: a 6-member generation confirming a terminal
  row with a non-NULL `cost_usd`, the partial-week notice rendering, and the drain filling the
  rest without user action.
- Households of 2, 3 and 5 on a paid tier were never measured.

---

## 6. Harness left behind

Under `apps/app/scripts/qa-e2e/`, reusable against any environment:

| Script | Purpose |
|---|---|
| `run-matrix.mjs` | drives N personas end-to-end, settles on every plan kind, verifies |
| `journey.mjs` | one persona through the whole signup wizard |
| `paid-household.mjs` | resizes a paid account's household from an app-authored snapshot and regenerates |
| `gen-history.mjs` | an account's real generation history — the aggregates hide killed runs |
| `watch-gen.mjs` | watches a live generation, emitting only on change |
| `cleanup-all.mjs` | hard-deletes every ledger account, proving each by a failing sign-in |
| `checkout.mjs` | buys a tier with the Lemonsqueezy test card; refuses if the store is not in test mode |

Ledgers, snapshots, screenshots and logs are gitignored — they carry emails, passwords, names,
ages and body measurements.
