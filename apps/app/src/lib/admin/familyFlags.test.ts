import { describe, expect, it } from "vitest";

import {
  FAMILY_FLAG_ORDER,
  attentionReasons,
  deriveFamilyFlags,
  generationKind,
  newestGenerationByKind,
  runFailureAt,
  type FlagInput,
  type ReasonInput,
} from "./familyFlags";

const clean: FlagInput = {
  status: "active",
  cancelAtPeriodEnd: false,
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
        cancelAtPeriodEnd: true,
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
      "onboarding_incomplete",
    ]);
    expect(FAMILY_FLAG_ORDER[0]).toBe("past_due");
  });

  it("flags a scheduled cancellation only on a live subscription", () => {
    expect(deriveFamilyFlags({ ...clean, cancelAtPeriodEnd: true })).toEqual(["cancel_scheduled"]);
    expect(deriveFamilyFlags({ ...clean, status: "trialing", cancelAtPeriodEnd: true })).toEqual([
      "cancel_scheduled",
    ]);
    expect(deriveFamilyFlags({ ...clean, status: "cancelled", cancelAtPeriodEnd: true })).toEqual(
      [],
    );
    expect(deriveFamilyFlags({ ...clean, status: null, cancelAtPeriodEnd: true })).toEqual([]);
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
    currentPeriodEnd: "2026-10-14T00:00:00Z",
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
        currentPeriodEnd: null,
        trialEndsAt: null,
        updatedAt: "2026-09-26T00:00:00Z",
      },
    });
    expect(r?.at).toBe("2026-09-26T00:00:00Z");
  });
});
