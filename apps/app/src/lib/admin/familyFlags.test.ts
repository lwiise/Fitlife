import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isSubscriptionActive,
  type SubscriptionRow as AppSubscriptionRow,
} from "@/lib/subscription/state";
import type { SubscriptionCancelState } from "./console-types";
import {
  FAMILY_FLAG_ORDER,
  attentionReasons,
  deriveFamilyFlags,
  generationKind,
  newestGenerationByKind,
  paidThroughAt,
  renewalDateAt,
  runFailureAt,
  subscriptionCancelState,
  type CancelStateInput,
  type FlagInput,
  type ReasonInput,
} from "./familyFlags";

// ── the cancellation rule ───────────────────────────────────────────────────

const NOW = Date.parse("2026-09-30T09:00:00Z");
const FUTURE = "2026-10-14T00:00:00Z";
const PAST = "2026-09-01T00:00:00Z";

const cancelInput = (p: Partial<CancelStateInput> = {}): CancelStateInput => ({
  status: "active",
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  currentPeriodEnd: FUTURE,
  endsAt: null,
  ...p,
});

/**
 * The date a subscription runs until: the period end, or — with none —
 * LemonSqueezy's ends_at (how a portal cancellation usually arrives). The
 * trial's end moves with it, so each column is the same date for a trial.
 */
type RunsUntil = "future" | "past" | "endsAtFuture" | "endsAtPast" | "none";
const DATES: Record<
  RunsUntil,
  Pick<CancelStateInput, "trialEndsAt" | "currentPeriodEnd" | "endsAt">
> = {
  future: { trialEndsAt: FUTURE, currentPeriodEnd: FUTURE, endsAt: null },
  past: { trialEndsAt: PAST, currentPeriodEnd: PAST, endsAt: null },
  endsAtFuture: { trialEndsAt: FUTURE, currentPeriodEnd: null, endsAt: FUTURE },
  endsAtPast: { trialEndsAt: PAST, currentPeriodEnd: null, endsAt: PAST },
  none: { trialEndsAt: null, currentPeriodEnd: null, endsAt: null },
};
type ByDate = Record<RunsUntil, SubscriptionCancelState>;
const always = (state: SubscriptionCancelState): ByDate => ({
  future: state,
  past: state,
  endsAtFuture: state,
  endsAtPast: state,
  none: state,
});
/** Scheduled while its date is ahead; ended once it has passed, or with no date. */
const WHILE_DATED: ByDate = {
  future: "scheduled",
  past: "ended",
  endsAtFuture: "scheduled",
  endsAtPast: "ended",
  none: "ended",
};

/**
 * An active row set to cancel: dated by its period end alone, as the app
 * dates it — an ends_at on an active row is left over, so without a period
 * end it is undated, a legacy row the app leaves open-ended.
 */
const ACTIVE_SET_TO_CANCEL: ByDate = {
  future: "scheduled",
  past: "ended",
  endsAtFuture: "scheduled",
  endsAtPast: "scheduled",
  none: "scheduled",
};

/**
 * Every status × cancel_at_period_end × date, written out. A subscription
 * that will not renew runs until its date — for 'cancelled' whatever the
 * flag says, for 'active' and 'trialing' only with the flag. An active row
 * is dated by its period end alone (ACTIVE_SET_TO_CANCEL); a past-due one is
 * past its period end by definition, so its flag decides. 'paused', an
 * unknown status and no subscription never cancel.
 */
const TRUTH_TABLE: Array<[string | null, { flag: ByDate; noFlag: ByDate }]> = [
  ["trialing", { flag: WHILE_DATED, noFlag: always("none") }],
  ["active", { flag: ACTIVE_SET_TO_CANCEL, noFlag: always("none") }],
  ["past_due", { flag: always("scheduled"), noFlag: always("none") }],
  ["paused", { flag: always("none"), noFlag: always("none") }],
  ["cancelled", { flag: WHILE_DATED, noFlag: WHILE_DATED }],
  ["expired", { flag: always("ended"), noFlag: always("ended") }],
  ["on_trial", { flag: always("none"), noFlag: always("none") }],
  [null, { flag: always("none"), noFlag: always("none") }],
];

describe("subscriptionCancelState", () => {
  it("covers every status × cancel flag × date", () => {
    let cases = 0;
    for (const [status, expected] of TRUTH_TABLE) {
      for (const flag of [true, false]) {
        for (const date of Object.keys(DATES) as RunsUntil[]) {
          cases += 1;
          const state = subscriptionCancelState(
            { status, cancelAtPeriodEnd: flag, ...DATES[date] },
            NOW,
          );
          expect(state, `${status} · flag ${flag} · runs until ${date}`).toBe(
            expected[flag ? "flag" : "noFlag"][date],
          );
        }
      }
    }
    expect(cases).toBe(8 * 2 * 5);
  });

  it("ends a subscription set to cancel once its period end has passed", () => {
    // Our own cancel route keeps the row 'active' and sets the flag; when the
    // expiry webhook is missed the row still reads 'active' after that date.
    const flagged = cancelInput({ cancelAtPeriodEnd: true });
    expect(subscriptionCancelState({ ...flagged, currentPeriodEnd: FUTURE }, NOW)).toBe("scheduled");
    expect(subscriptionCancelState({ ...flagged, currentPeriodEnd: PAST }, NOW)).toBe("ended");
    expect(subscriptionCancelState({ ...flagged, currentPeriodEnd: null }, NOW)).toBe("scheduled");
    expect(subscriptionCancelState({ ...flagged, currentPeriodEnd: "soon" }, NOW)).toBe("ended");
  });

  it("does not end an active subscription on a left-over ends_at", () => {
    // Cancelled once, then renewed: the renewal never clears ends_at. With no
    // period end the app leaves the row open-ended, and so does the console.
    const renewed = cancelInput({ cancelAtPeriodEnd: true, currentPeriodEnd: null, endsAt: PAST });
    expect(subscriptionCancelState(renewed, NOW)).toBe("scheduled");
    expect(renewalDateAt(renewed)).toBeNull();
    // A period end, when there is one, still decides.
    expect(subscriptionCancelState({ ...renewed, currentPeriodEnd: PAST, endsAt: FUTURE }, NOW)).toBe(
      "ended",
    );
  });

  it("judges a trial set to cancel by the trial's end, not a period end", () => {
    const trial = cancelInput({ status: "trialing", cancelAtPeriodEnd: true });
    expect(
      subscriptionCancelState({ ...trial, trialEndsAt: FUTURE, currentPeriodEnd: PAST }, NOW),
    ).toBe("scheduled");
    expect(
      subscriptionCancelState({ ...trial, trialEndsAt: PAST, currentPeriodEnd: FUTURE }, NOW),
    ).toBe("ended");
    expect(
      subscriptionCancelState({ ...trial, trialEndsAt: null, currentPeriodEnd: FUTURE }, NOW),
    ).toBe("ended");
  });

  it("keeps a past-due subscription set to cancel scheduled, its period end already behind it", () => {
    const pastDue = cancelInput({ status: "past_due", cancelAtPeriodEnd: true, currentPeriodEnd: PAST });
    expect(subscriptionCancelState(pastDue, NOW)).toBe("scheduled");
    expect(subscriptionCancelState({ ...pastDue, cancelAtPeriodEnd: false }, NOW)).toBe("none");
  });

  it("dates a portal cancellation by ends_at when it arrived without a period end", () => {
    const portal = cancelInput({ status: "cancelled", cancelAtPeriodEnd: true, currentPeriodEnd: null });
    expect(subscriptionCancelState({ ...portal, endsAt: FUTURE }, NOW)).toBe("scheduled");
    expect(subscriptionCancelState({ ...portal, endsAt: PAST }, NOW)).toBe("ended");
  });

  it("reads the period end before ends_at, as the app does", () => {
    const both = cancelInput({ status: "cancelled", currentPeriodEnd: PAST, endsAt: FUTURE });
    expect(paidThroughAt(both)).toBe(PAST);
    expect(subscriptionCancelState(both, NOW)).toBe("ended");
  });

  it("ends a cancelled subscription at the paid-through instant, and on a date it cannot read", () => {
    const at = cancelInput({ status: "cancelled", currentPeriodEnd: FUTURE });
    expect(subscriptionCancelState(at, Date.parse(FUTURE) - 1)).toBe("scheduled");
    expect(subscriptionCancelState(at, Date.parse(FUTURE))).toBe("ended");
    expect(
      subscriptionCancelState(cancelInput({ status: "cancelled", currentPeriodEnd: "soon" }), NOW),
    ).toBe("ended");
  });

  describe("agrees with the app's access rule (free-access mode off)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const DAY = 86_400_000;
    const appRow = (p: Partial<AppSubscriptionRow>): AppSubscriptionRow => ({
      id: "s",
      user_id: "u",
      tier: "family",
      status: "cancelled",
      cadence: "monthly",
      trial_started_at: null,
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      ends_at: null,
      cancel_at_period_end: true,
      lemonsqueezy_subscription_id: "1",
      lemonsqueezy_customer_id: "2",
      lemonsqueezy_variant_id: "3",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ...p,
    });

    // isSubscriptionActive reads the wall clock; dates a week away cannot flake.
    const dated = () => {
      const now = Date.now();
      return {
        now,
        soon: new Date(now + 7 * DAY).toISOString(),
        gone: new Date(now - 7 * DAY).toISOString(),
      };
    };

    it("keeps a cancelled subscription exactly as long as the app keeps its access", () => {
      vi.stubEnv("NEXT_PUBLIC_FREE_ACCESS_MODE", "0");
      const { now, soon, gone } = dated();
      const dates: Array<[string | null, string | null]> = [
        [soon, null],
        [gone, null],
        [null, soon],
        [null, gone],
        [gone, soon],
        [soon, gone],
        [null, null],
      ];
      for (const status of ["cancelled", "expired"] as const) {
        for (const [periodEnd, endsAt] of dates) {
          const app = isSubscriptionActive(
            appRow({ status, current_period_end: periodEnd, ends_at: endsAt }),
          );
          const admin = subscriptionCancelState(
            { status, cancelAtPeriodEnd: true, trialEndsAt: null, currentPeriodEnd: periodEnd, endsAt },
            now,
          );
          expect(admin === "scheduled", `${status} ${periodEnd} ${endsAt}`).toBe(app);
        }
      }
    });

    it("keeps a subscription set to cancel scheduled exactly as long as the app keeps its access", () => {
      vi.stubEnv("NEXT_PUBLIC_FREE_ACCESS_MODE", "0");
      const { now, soon, gone } = dated();
      for (const date of [soon, gone, null]) {
        // An active row is judged by its period end (ends_at belongs to
        // cancelled, expired and paused rows); a trial by its own end.
        const rows: Array<[AppSubscriptionRow, CancelStateInput]> = [
          [
            appRow({ status: "active", current_period_end: date }),
            cancelInput({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: date }),
          ],
          // ...so an active row with only a (left-over) ends_at is open-ended
          // in the app, whatever that date says.
          [
            appRow({ status: "active", current_period_end: null, ends_at: date }),
            cancelInput({
              status: "active",
              cancelAtPeriodEnd: true,
              currentPeriodEnd: null,
              endsAt: date,
            }),
          ],
          [
            appRow({ status: "trialing", trial_ends_at: date }),
            cancelInput({
              status: "trialing",
              cancelAtPeriodEnd: true,
              trialEndsAt: date,
              currentPeriodEnd: null,
            }),
          ],
        ];
        for (const [app, admin] of rows) {
          expect(
            subscriptionCancelState(admin, now) === "scheduled",
            `${admin.status} until ${date}`,
          ).toBe(isSubscriptionActive(app));
        }
      }
      // past_due is where the two part on purpose: the app holds access back
      // while the payment fails, but the subscription is still live
      // (hasLiveLemonsqueezySubscription) and set not to renew.
      expect(isSubscriptionActive(appRow({ status: "past_due", current_period_end: gone }))).toBe(
        false,
      );
      expect(
        subscriptionCancelState(
          cancelInput({ status: "past_due", cancelAtPeriodEnd: true, currentPeriodEnd: gone }),
          now,
        ),
      ).toBe("scheduled");
    });
  });
});

describe("renewalDateAt", () => {
  const base = { trialEndsAt: "2026-10-03T00:00:00Z", currentPeriodEnd: FUTURE, endsAt: null };
  it("shows a trial's end, else what the subscription is paid through", () => {
    expect(renewalDateAt({ ...base, status: "trialing" })).toBe("2026-10-03T00:00:00Z");
    expect(renewalDateAt({ ...base, status: "active" })).toBe(FUTURE);
    expect(renewalDateAt({ ...base, status: "cancelled", currentPeriodEnd: null, endsAt: PAST })).toBe(
      PAST,
    );
    expect(renewalDateAt({ ...base, status: null, currentPeriodEnd: null })).toBeNull();
  });
});

describe("paidThroughAt", () => {
  it("reads ends_at only on a subscription that has stopped renewing, as the app does", () => {
    const onlyEndsAt = { currentPeriodEnd: null, endsAt: PAST };
    for (const status of ["cancelled", "expired", "paused"]) {
      expect(paidThroughAt({ ...onlyEndsAt, status }), status).toBe(PAST);
    }
    // On a renewing row ends_at is left over (a renewal never clears it).
    for (const status of ["active", "trialing", "past_due", null]) {
      expect(paidThroughAt({ ...onlyEndsAt, status }), String(status)).toBeNull();
    }
    // A period end is the date whatever the status.
    for (const status of ["active", "past_due", "cancelled", "paused", null]) {
      expect(paidThroughAt({ status, currentPeriodEnd: FUTURE, endsAt: PAST }), String(status)).toBe(
        FUTURE,
      );
    }
  });
});

// ── flags ───────────────────────────────────────────────────────────────────

const clean: FlagInput = {
  status: "active",
  cancelState: "none",
  overLimit: false,
  onboardingComplete: true,
  newestMealRunStatus: "completed",
  newestWorkoutRunStatus: null,
  meal: { state: "ready", masked: false },
  workout: { state: "none", masked: false },
};

describe("deriveFamilyFlags", () => {
  it("is empty for a healthy family", () => {
    expect(deriveFamilyFlags(clean)).toEqual([]);
  });

  it("returns every flag most severe first", () => {
    expect(
      deriveFamilyFlags({
        status: "past_due",
        cancelState: "scheduled",
        overLimit: true,
        onboardingComplete: false,
        newestMealRunStatus: "failed",
        newestWorkoutRunStatus: "failed",
        meal: { state: "ready", masked: false },
        workout: { state: "ready", masked: false },
      }),
    ).toEqual([
      "past_due",
      "over_limit",
      "failed_workout_run",
      "failed_meal_run",
      "cancel_scheduled",
      "onboarding_incomplete",
    ]);
    expect(FAMILY_FLAG_ORDER[0]).toBe("past_due");
  });

  it("flags a cancellation exactly while it is scheduled", () => {
    expect(deriveFamilyFlags({ ...clean, cancelState: "scheduled" })).toEqual(["cancel_scheduled"]);
    // A portal cancellation still paid through: status 'cancelled', still flagged.
    expect(
      deriveFamilyFlags({ ...clean, status: "cancelled", cancelState: "scheduled" }),
    ).toEqual(["cancel_scheduled"]);
    // Once it has run out it is history, not something to act on.
    expect(deriveFamilyFlags({ ...clean, status: "cancelled", cancelState: "ended" })).toEqual([]);
    expect(deriveFamilyFlags({ ...clean, status: "expired", cancelState: "ended" })).toEqual([]);
    expect(deriveFamilyFlags({ ...clean, status: null, cancelState: "none" })).toEqual([]);
  });

  it("flags a run kind when its NEWEST run failed, even with a plan that is fine", () => {
    expect(deriveFamilyFlags({ ...clean, newestMealRunStatus: "started" })).toEqual([]);
    expect(deriveFamilyFlags({ ...clean, newestWorkoutRunStatus: "failed" })).toEqual([
      "failed_workout_run",
    ]);
  });

  it("flags a run kind from its served cell when the audit row misses the failure", () => {
    // A hard-killed workout run: its audit row is still 'started', the
    // program cell already reads failed by staleness.
    expect(
      deriveFamilyFlags({
        ...clean,
        newestWorkoutRunStatus: "started",
        workout: { state: "failed", masked: false },
      }),
    ).toEqual(["failed_workout_run"]);
    // ...or the previous program is shown in its place.
    expect(
      deriveFamilyFlags({
        ...clean,
        newestWorkoutRunStatus: "started",
        workout: { state: "ready", masked: true },
      }),
    ).toEqual(["failed_workout_run"]);
    // A failed meal run followed by a housekeeper translation: the newest
    // meal-kind row is the translation's 'completed' one; the cell is masked.
    expect(
      deriveFamilyFlags({
        ...clean,
        newestMealRunStatus: "completed",
        meal: { state: "ready", masked: true },
      }),
    ).toEqual(["failed_meal_run"]);
    expect(deriveFamilyFlags({ ...clean, meal: { state: "failed", masked: false } })).toEqual([
      "failed_meal_run",
    ]);
    // Live, empty and healthy cells never flag.
    for (const state of ["generating", "none", "ready"] as const) {
      expect(
        deriveFamilyFlags({
          ...clean,
          meal: { state, masked: false },
          workout: { state, masked: false },
        }),
      ).toEqual([]);
    }
  });
});

describe("runFailureAt", () => {
  const run = (status: string) => ({ status, created_at: "2026-09-28T06:00:00Z" });
  const PLAN_AT = "2026-09-28T05:59:00Z";

  it("dates a failed newest run by the run", () => {
    expect(runFailureAt(run("failed"), { state: "ready", masked: false }, PLAN_AT)).toBe(
      "2026-09-28T06:00:00Z",
    );
  });

  it("dates a cell-only failure by the failing plan row", () => {
    expect(runFailureAt(run("started"), { state: "failed", masked: false }, PLAN_AT)).toBe(
      PLAN_AT,
    );
    expect(runFailureAt(run("completed"), { state: "ready", masked: true }, PLAN_AT)).toBe(
      PLAN_AT,
    );
    expect(runFailureAt(null, { state: "failed", masked: false }, null)).toBeNull();
  });

  it("is null when nothing failed", () => {
    expect(runFailureAt(run("completed"), { state: "ready", masked: false }, PLAN_AT)).toBeNull();
    expect(runFailureAt(null, { state: "none", masked: false }, null)).toBeNull();
  });
});

describe("newestGenerationByKind", () => {
  it("picks the newest row of each kind; a missing kind is a meal run", () => {
    const gens = [
      { id: "m1", plan_kind: "meal", status: "failed", created_at: "2026-09-19T06:00:00Z" },
      { id: "m2", plan_kind: null, status: "completed", created_at: "2026-09-27T11:00:00Z" },
      { id: "w1", plan_kind: "workout", status: "completed", created_at: "2026-09-20T08:00:00Z" },
      { id: "w2", plan_kind: "workout", status: "failed", created_at: "2026-09-28T06:00:00Z" },
    ];
    const newest = newestGenerationByKind(gens);
    // The failure on the 19th was followed by a completed meal run: no flag.
    expect(newest.meal?.id).toBe("m2");
    expect(newest.workout?.id).toBe("w2");
    expect(newestGenerationByKind([])).toEqual({ meal: null, workout: null });
  });

  it("maps plan_kind", () => {
    expect(generationKind("workout")).toBe("workout");
    expect(generationKind("meal")).toBe("meal");
    expect(generationKind(null)).toBe("meal");
    expect(generationKind(undefined)).toBe("meal");
  });
});

const baseReasons: ReasonInput = {
  flags: [],
  medicalGateBlocked: false,
  subscription: {
    status: "active",
    currentPeriodEnd: "2026-10-14T00:00:00Z",
    endsAt: null,
    trialEndsAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-09-26T00:00:00Z",
  },
  beneficiaries: 3,
  maxPeople: 2,
  mealFailureAt: "2026-09-19T06:02:00Z",
  workoutFailureAt: "2026-09-28T06:05:00Z",
  meal: { state: "ready", daysReady: 7, daysTotal: 7, masked: false },
  workout: { state: "ready", masked: true },
};

describe("attentionReasons", () => {
  it("explains every flag with its tab and date, most severe first", () => {
    const reasons = attentionReasons({
      ...baseReasons,
      flags: [
        "past_due",
        "over_limit",
        "failed_workout_run",
        "failed_meal_run",
        "cancel_scheduled",
        "onboarding_incomplete",
      ],
      medicalGateBlocked: true,
    });
    expect(reasons).toEqual([
      { flag: "past_due", severity: "high", at: "2026-10-14T00:00:00Z", tab: "billing" },
      { flag: "over_limit", severity: "high", at: null, tab: "household", people: 3, maxPeople: 2 },
      { flag: "medical_gate", severity: "high", at: null, tab: "household" },
      {
        flag: "failed_workout_run",
        severity: "medium",
        at: "2026-09-28T06:05:00Z",
        tab: "exercise",
      },
      { flag: "cancel_scheduled", severity: "medium", at: "2026-10-14T00:00:00Z", tab: "billing" },
      {
        flag: "onboarding_incomplete",
        severity: "medium",
        at: "2026-06-10T00:00:00Z",
        tab: "summary",
      },
      { flag: "failed_meal_run", severity: "low", at: "2026-09-19T06:02:00Z", tab: "meal" },
    ]);
  });

  it("rates a failed run by what the family is left with", () => {
    const sev = (meal: ReasonInput["meal"]) =>
      attentionReasons({ ...baseReasons, flags: ["failed_meal_run"], meal })[0]?.severity;
    expect(sev({ state: "failed", daysReady: 0, daysTotal: 7, masked: false })).toBe("high");
    expect(sev({ state: "none", daysReady: null, daysTotal: 7, masked: false })).toBe("high");
    expect(sev({ state: "ready", daysReady: 7, daysTotal: 7, masked: true })).toBe("medium");
    expect(sev({ state: "ready", daysReady: 7, daysTotal: 7, masked: false })).toBe("low");
  });

  it("works without a subscription and adds the medical gate only when asked", () => {
    expect(
      attentionReasons({ ...baseReasons, subscription: null, flags: ["onboarding_incomplete"] }),
    ).toEqual([{ flag: "onboarding_incomplete", severity: "medium", at: null, tab: "summary" }]);
    expect(attentionReasons({ ...baseReasons })).toEqual([]);
  });

  it("falls back to the last subscription update for a past-due date", () => {
    const [r] = attentionReasons({
      ...baseReasons,
      flags: ["past_due"],
      subscription: {
        status: "past_due",
        currentPeriodEnd: null,
        endsAt: null,
        trialEndsAt: null,
        updatedAt: "2026-09-26T00:00:00Z",
      },
    });
    expect(r?.at).toBe("2026-09-26T00:00:00Z");
  });

  it("dates a scheduled cancellation when it takes effect", () => {
    const at = (subscription: ReasonInput["subscription"]) =>
      attentionReasons({ ...baseReasons, flags: ["cancel_scheduled"], subscription })[0]?.at;
    // Cancelled in the portal with no new period end: the day it is paid through.
    expect(
      at({
        status: "cancelled",
        currentPeriodEnd: null,
        endsAt: "2026-10-20T00:00:00Z",
        trialEndsAt: null,
        updatedAt: "2026-09-26T00:00:00Z",
      }),
    ).toBe("2026-10-20T00:00:00Z");
    // A trial set to cancel ends with the trial.
    expect(
      at({
        status: "trialing",
        currentPeriodEnd: null,
        endsAt: null,
        trialEndsAt: "2026-10-03T00:00:00Z",
        updatedAt: "2026-09-26T00:00:00Z",
      }),
    ).toBe("2026-10-03T00:00:00Z");
    // An active row with no period end is open-ended: undated, never its left-over ends_at.
    expect(
      at({
        status: "active",
        currentPeriodEnd: null,
        endsAt: "2026-09-01T00:00:00Z",
        trialEndsAt: null,
        updatedAt: "2026-09-26T00:00:00Z",
      }),
    ).toBeNull();
    expect(at(null)).toBeNull();
  });

  it("never dates a past-due cancellation: its date is the renewal that failed", () => {
    // Set to cancel, then the renewal on 23 Sep failed; read on 30 Sep.
    const pastDue: CancelStateInput = {
      status: "past_due",
      cancelAtPeriodEnd: true,
      trialEndsAt: null,
      currentPeriodEnd: "2026-09-23T00:00:00Z",
      endsAt: null,
    };
    const cancelState = subscriptionCancelState(pastDue, NOW);
    expect(cancelState).toBe("scheduled");
    const reasons = attentionReasons({
      ...baseReasons,
      flags: deriveFamilyFlags({ ...clean, status: "past_due", cancelState }),
      subscription: { ...pastDue, updatedAt: "2026-09-26T00:00:00Z" },
    });
    expect(reasons.map((r) => [r.flag, r.at])).toEqual([
      // The failed renewal dates the past-due reason...
      ["past_due", "2026-09-23T00:00:00Z"],
      // ...and the cancellation reads «الإلغاء مجدول.», not «... في ٢٣ سبتمبر».
      ["cancel_scheduled", null],
    ]);
  });
});
