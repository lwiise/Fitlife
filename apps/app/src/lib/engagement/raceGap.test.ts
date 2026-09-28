import { describe, expect, it } from "vitest";
import { mealsToPass } from "./raceGap";

describe("mealsToPass", () => {
  it("counts the meals a meals-only member needs to strictly pass the one above", () => {
    // 12/28 = 42.9% needs to beat 50%: 15/28 = 53.6% → 3 meals (14/28 ties, not enough).
    expect(
      mealsToPass({ pct: 12 / 28, mealsMarked: 12, mealsPlanned: 28 }, { pct: 0.5, mealsMarked: 0, mealsPlanned: 0 }),
    ).toBe(3);
  });

  it("uses the half-meals, half-sessions formula for a member with a workout plan", () => {
    // meals 10/28, sessions 2/4 → (x/28 + 0.5)/2 > 0.55 → x/28 > 0.6 → x = 17 → 7 more.
    expect(
      mealsToPass(
        { pct: 0, mealsMarked: 10, mealsPlanned: 28, sessionsMarked: 2, sessionsPlanned: 4 },
        { pct: 0.55, mealsMarked: 0, mealsPlanned: 0 },
      ),
    ).toBe(7);
  });

  it("returns null when the remaining meals cannot close the gap", () => {
    expect(
      mealsToPass({ pct: 0.1, mealsMarked: 1, mealsPlanned: 10 }, { pct: 1, mealsMarked: 0, mealsPlanned: 0 }),
    ).toBeNull();
    expect(
      mealsToPass({ pct: 0, mealsMarked: 0, mealsPlanned: 0 }, { pct: 0.2, mealsMarked: 0, mealsPlanned: 0 }),
    ).toBeNull();
  });
});
