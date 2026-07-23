import { describe, it, expect } from "vitest";

import {
  isWorkoutEligibleMember,
  isWorkoutEligibleMom,
  momWorkoutIneligibleReason,
  workoutIneligibleReason,
} from "./workoutEligibility";

const YEAR = 2026;

describe("workoutIneligibleReason", () => {
  it("accepts an adult", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "adult", role: "husband", birth_year: 1985 },
        YEAR,
      ),
    ).toBeNull();
  });

  it("accepts pregnant and lactating members (the methodology adapts, the right stays)", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "pregnant", role: "wife", birth_year: 1995 },
        YEAR,
      ),
    ).toBeNull();
    expect(
      workoutIneligibleReason(
        { member_type: "lactating", role: "wife", birth_year: 1995 },
        YEAR,
      ),
    ).toBeNull();
  });

  it("never accepts a child", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "child", role: "son", birth_year: 2015 },
        YEAR,
      ),
    ).toBe("child");
  });

  it("never accepts the housekeeper — by member_type OR role", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "housekeeper", role: null, birth_year: 1990 },
        YEAR,
      ),
    ).toBe("housekeeper");
    expect(
      workoutIneligibleReason(
        { member_type: "adult", role: "housekeeper", birth_year: 1990 },
        YEAR,
      ),
    ).toBe("housekeeper");
  });

  it("reports a housekeeper-typed child row as a child (child rule wins)", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "child", role: "housekeeper", birth_year: 2015 },
        YEAR,
      ),
    ).toBe("child");
  });

  it("refuses an under-18 birth_year on an adult type — matches the engine's age gate", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "adult", role: "son", birth_year: YEAR - 17 },
        YEAR,
      ),
    ).toBe("child");
    expect(
      workoutIneligibleReason(
        { member_type: "adult", role: "son", birth_year: YEAR - 18 },
        YEAR,
      ),
    ).toBeNull();
  });

  it("keeps the housekeeper dignity reason even when she is under 18 (checked before the age gate)", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "adult", role: "housekeeper", birth_year: YEAR - 16 },
        YEAR,
      ),
    ).toBe("housekeeper");
  });

  it("allows an adult type with unknown birth_year (age cannot be fabricated)", () => {
    expect(
      workoutIneligibleReason(
        { member_type: "adult", role: "husband", birth_year: null },
        YEAR,
      ),
    ).toBeNull();
  });
});

describe("momWorkoutIneligibleReason", () => {
  it("accepts an adult account holder", () => {
    expect(momWorkoutIneligibleReason({ birth_year: 1990 }, YEAR)).toBeNull();
  });

  it("refuses an under-18 account holder — same 18 line as members", () => {
    expect(momWorkoutIneligibleReason({ birth_year: YEAR - 17 }, YEAR)).toBe(
      "child",
    );
    expect(momWorkoutIneligibleReason({ birth_year: YEAR - 18 }, YEAR)).toBeNull();
  });

  it("allows an unknown birth_year (age cannot be fabricated)", () => {
    expect(momWorkoutIneligibleReason({ birth_year: null }, YEAR)).toBeNull();
  });
});

describe("isWorkoutEligibleMom", () => {
  it("mirrors the reason function", () => {
    expect(isWorkoutEligibleMom({ birth_year: 1990 }, YEAR)).toBe(true);
    expect(isWorkoutEligibleMom({ birth_year: YEAR - 16 }, YEAR)).toBe(false);
  });
});

describe("isWorkoutEligibleMember", () => {
  it("mirrors the reason function", () => {
    expect(
      isWorkoutEligibleMember(
        { member_type: "adult", role: null, birth_year: 1985 },
        YEAR,
      ),
    ).toBe(true);
    expect(
      isWorkoutEligibleMember(
        { member_type: "child", role: null, birth_year: 2015 },
        YEAR,
      ),
    ).toBe(false);
    expect(
      isWorkoutEligibleMember(
        { member_type: "adult", role: "housekeeper", birth_year: 1990 },
        YEAR,
      ),
    ).toBe(false);
    expect(
      isWorkoutEligibleMember(
        { member_type: "adult", role: "son", birth_year: YEAR - 15 },
        YEAR,
      ),
    ).toBe(false);
  });
});
