import { describe, it, expect } from "vitest";

import { hasReachedWeightGoal } from "./goalMilestone";

describe("hasReachedWeightGoal", () => {
  it("celebrates a loss goal once the latest weigh-in reaches the target", () => {
    expect(hasReachedWeightGoal([80, 75, 71], 72)).toBe(true);
    expect(hasReachedWeightGoal([80, 72], 72)).toBe(true); // exactly at target
  });

  it("stays quiet while a loss goal is still in progress", () => {
    expect(hasReachedWeightGoal([80, 75], 72)).toBe(false);
  });

  it("celebrates a gain goal once the latest weigh-in reaches the target", () => {
    expect(hasReachedWeightGoal([60, 63, 66], 65)).toBe(true);
  });

  it("stays quiet while a gain goal is still in progress", () => {
    expect(hasReachedWeightGoal([60, 62], 65)).toBe(false);
  });

  it("uses the LATEST weigh-in — a drift back past the target un-reaches it", () => {
    // began at 80 (loss), dipped to 71, back up to 73 → 73 > 72 → not reached now
    expect(hasReachedWeightGoal([80, 71, 73], 72)).toBe(false);
  });

  it("requires a target", () => {
    expect(hasReachedWeightGoal([80, 70], null)).toBe(false);
    expect(hasReachedWeightGoal([80, 70], undefined)).toBe(false);
  });

  it("requires at least one weigh-in", () => {
    expect(hasReachedWeightGoal([], 72)).toBe(false);
  });

  it("does not celebrate without a real journey (single log, or started at target)", () => {
    expect(hasReachedWeightGoal([71], 72)).toBe(false); // one log, below a higher target
    expect(hasReachedWeightGoal([73], 72)).toBe(false); // one log, above a lower target
    expect(hasReachedWeightGoal([72], 72)).toBe(false); // started exactly at target
  });
});
