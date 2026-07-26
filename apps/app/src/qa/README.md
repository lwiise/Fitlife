# QA harness — signup → plan-generation variations

A persona matrix that drives the **real** onboarding → context → prompt path for
every shape a new signup can take, one simulated account per test email
(`claude2@gmail.com` … `claude18@gmail.com`). No database, no API calls: a
chainable fake Supabase client (`personaHarness.ts`) serves one `profiles` row +
its `family_members` rows, exactly like the queries `buildPlanContext` makes.

| file | what it does |
| --- | --- |
| `personaHarness.ts` | fake Supabase client + fully-defaulted `profiles` / `family_members` row builders |
| `personas.test.ts` | the persona matrix; prints a per-account report (gate outcome, beneficiaries, trainees, prompt warnings) plus the wizard→server-schema contract and the goal-mapping matrix |
| `deadEnds.test.ts` | reproduces the three states a real signup can reach and never get out of |

Run just this suite:

```bash
pnpm --filter @fitlife/app exec vitest run src/qa
```

## KNOWN-BUG assertions

Some assertions pin **current, wrong** behaviour so the fix is visible as a test
change. They are marked `KNOWN-BUG` in a comment. When the underlying bug is
fixed, flip the assertion in the same commit:

- `personas.test.ts` — a 4-year-old that the client accepts is rejected by
  `familyMemberInputSchema` (`weight_kg` floor of 20 kg).
- `personas.test.ts` — `momProfileInputSchema` accepts a `birth_year` that makes
  the account owner a minor, while the client `step1Schema` requires 13+.
- `deadEnds.test.ts` — the minor-owner prompts (no child clause in the skeleton,
  adult calorie target in the day prompt).
