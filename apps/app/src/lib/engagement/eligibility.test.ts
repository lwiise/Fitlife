import { describe, it, expect } from "vitest";

import {
  isChildWeighInMember,
  isGoalCelebrationEligibleMember,
  isWeighInEligibleMember,
  isWeighInEligibleMom,
} from "./eligibility";

const YEAR = 2026;

// ── Private weight record (adults + children; never the housekeeper) ──────────
describe("isWeighInEligibleMember", () => {
  it("accepts an adult", () => {
    expect(
      isWeighInEligibleMember({ member_type: "adult", role: "husband", birth_year: 1985 }),
    ).toBe(true);
  });

  it("accepts pregnant and lactating members (framing changes, the right does not)", () => {
    expect(
      isWeighInEligibleMember({ member_type: "pregnant", role: "wife", birth_year: 1995 }),
    ).toBe(true);
    expect(
      isWeighInEligibleMember({ member_type: "lactating", role: "wife", birth_year: 1995 }),
    ).toBe(true);
  });

  it("NOW accepts a child — owner directive 07/2026 (private record only)", () => {
    expect(
      isWeighInEligibleMember({ member_type: "child", role: "son", birth_year: YEAR - 8 }),
    ).toBe(true);
  });

  it("never accepts the housekeeper — by member_type OR role", () => {
    expect(
      isWeighInEligibleMember({ member_type: "housekeeper", role: null, birth_year: 1990 }),
    ).toBe(false);
    expect(
      isWeighInEligibleMember({ member_type: "adult", role: "housekeeper", birth_year: 1990 }),
    ).toBe(false);
  });
});

// ── Minor detection (no photos; never on the shared celebration) ──────────────
describe("isChildWeighInMember", () => {
  it("true for a child type regardless of birth_year", () => {
    expect(
      isChildWeighInMember({ member_type: "child", role: "son", birth_year: 1990 }, YEAR),
    ).toBe(true);
  });

  it("true for an under-18 birth_year even on an adult type", () => {
    expect(
      isChildWeighInMember({ member_type: "adult", role: "son", birth_year: YEAR - 17 }, YEAR),
    ).toBe(true);
    expect(
      isChildWeighInMember({ member_type: "adult", role: "son", birth_year: YEAR - 18 }, YEAR),
    ).toBe(false);
  });

  it("false for an adult with unknown birth_year", () => {
    expect(
      isChildWeighInMember({ member_type: "adult", role: "husband", birth_year: null }, YEAR),
    ).toBe(false);
  });
});

// ── Shared goal-milestone celebration (adults only) ───────────────────────────
describe("isGoalCelebrationEligibleMember", () => {
  it("accepts an adult", () => {
    expect(
      isGoalCelebrationEligibleMember({ member_type: "adult", role: "wife", birth_year: 1990 }, YEAR),
    ).toBe(true);
  });

  it("NEVER accepts a child — a child's weight goal is never on a shared surface", () => {
    expect(
      isGoalCelebrationEligibleMember({ member_type: "child", role: "son", birth_year: YEAR - 8 }, YEAR),
    ).toBe(false);
    // under-18 adult type is also excluded from the shared celebration
    expect(
      isGoalCelebrationEligibleMember({ member_type: "adult", role: "son", birth_year: YEAR - 17 }, YEAR),
    ).toBe(false);
  });

  it("never accepts the housekeeper", () => {
    expect(
      isGoalCelebrationEligibleMember({ member_type: "housekeeper", role: null, birth_year: 1990 }, YEAR),
    ).toBe(false);
  });
});

describe("isWeighInEligibleMom", () => {
  it("allows unknown age, refuses under-18, allows 18+", () => {
    expect(isWeighInEligibleMom(null, YEAR)).toBe(true);
    expect(isWeighInEligibleMom(undefined, YEAR)).toBe(true);
    expect(isWeighInEligibleMom(YEAR - 17, YEAR)).toBe(false);
    expect(isWeighInEligibleMom(YEAR - 18, YEAR)).toBe(true);
  });
});
