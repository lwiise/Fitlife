import { describe, it, expect } from "vitest";
import { initialStepIndex } from "./restoreAnswers";
import type { SavedMomAnswers } from "./restoreAnswers";

/**
 * `saveProfileStep` persists the first steps and `restoreAnswers` reads them
 * back, but the wizard always mounted at index 0 — so a refresh at step 8 of 11
 * dropped the user to «1 / 10» with her answers pre-filled and ten screens of
 * clicking to return. Onboarding is the biggest drop-off surface in the funnel.
 *
 * The contract: never skip a step whose data is not provably saved.
 */
const saved = (over: Partial<SavedMomAnswers> = {}): SavedMomAnswers => ({
  sex: "female",
  display_name: "هند",
  birth_year: 1990,
  phone: null,
  height_cm: 163,
  weight_kg: 78,
  waist_cm: null,
  hip_cm: null,
  target_weight_kg: null,
  activity_level: null,
  ...over,
});

describe("initialStepIndex", () => {
  it("starts at the beginning for a brand-new user", () => {
    expect(initialStepIndex(undefined)).toBe(0);
  });

  it("resumes past identity and physical once both are on the row", () => {
    expect(initialStepIndex(saved())).toBe(2);
  });

  it("stops at physical when only identity is complete", () => {
    expect(initialStepIndex(saved({ height_cm: null, weight_kg: null }))).toBe(1);
    expect(initialStepIndex(saved({ weight_kg: null }))).toBe(1);
  });

  it("never skips identity when any of its fields is missing", () => {
    expect(initialStepIndex(saved({ sex: null }))).toBe(0);
    expect(initialStepIndex(saved({ display_name: null }))).toBe(0);
    expect(initialStepIndex(saved({ birth_year: null }))).toBe(0);
  });

  it("treats a blank name as unanswered, not as progress", () => {
    expect(initialStepIndex(saved({ display_name: "   " }))).toBe(0);
  });

  it("handles Postgres numeric-as-string measurements", () => {
    expect(initialStepIndex(saved({ height_cm: "163", weight_kg: "78.5" }))).toBe(2);
  });

  it("treats an empty-string measurement as missing", () => {
    // Number("") is 0, so a naive check would call this answered.
    expect(initialStepIndex(saved({ height_cm: "" }))).toBe(1);
  });

  it("never resumes past goalActivity — the goal is stored mapped at submit", () => {
    const anyState = initialStepIndex(saved({ activity_level: "light" }));
    expect(anyState).toBeLessThanOrEqual(2);
  });
});
