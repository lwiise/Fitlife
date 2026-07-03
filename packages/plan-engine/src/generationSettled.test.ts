import { describe, it, expect } from "vitest";
import { generationAlreadySettled } from "./generate";

/**
 * Idempotency predicate for the background function: a duplicate/replayed
 * invocation must no-op unless the row is in fresh dispatch state.
 */
describe("generationAlreadySettled", () => {
  it("fresh dispatch state (generating + started) is NOT settled", () => {
    expect(
      generationAlreadySettled({
        mealPlanStatus: "generating",
        dispatchGenStatus: "started",
      }),
    ).toBe(false);
  });

  it("missing meal_plans row is settled (nothing to generate into)", () => {
    expect(
      generationAlreadySettled({ mealPlanStatus: null, dispatchGenStatus: "started" }),
    ).toBe(true);
    expect(
      generationAlreadySettled({ mealPlanStatus: undefined, dispatchGenStatus: null }),
    ).toBe(true);
  });

  it("terminal meal_plans row is settled", () => {
    expect(
      generationAlreadySettled({ mealPlanStatus: "failed", dispatchGenStatus: "started" }),
    ).toBe(true);
    expect(
      generationAlreadySettled({ mealPlanStatus: "archived", dispatchGenStatus: "started" }),
    ).toBe(true);
  });

  it("'ready' shell means another invocation is/was streaming — settled", () => {
    expect(
      generationAlreadySettled({ mealPlanStatus: "ready", dispatchGenStatus: "started" }),
    ).toBe(true);
  });

  it("terminal dispatch generation row is settled even while row says generating", () => {
    expect(
      generationAlreadySettled({
        mealPlanStatus: "generating",
        dispatchGenStatus: "completed",
      }),
    ).toBe(true);
    expect(
      generationAlreadySettled({
        mealPlanStatus: "generating",
        dispatchGenStatus: "failed",
      }),
    ).toBe(true);
  });

  it("missing generation row alone does not block a fresh run", () => {
    expect(
      generationAlreadySettled({ mealPlanStatus: "generating", dispatchGenStatus: null }),
    ).toBe(false);
  });
});
