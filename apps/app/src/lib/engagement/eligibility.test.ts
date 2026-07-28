import { describe, it, expect } from "vitest";

import {
  isChildWeighInMember,
  isGoalCelebrationEligibleMember,
  isWeighInEligibleMember,
  isWeighInEligibleMom,
  isGoalCelebrationEligibleOwner,
  isInNoLossFramingState,
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

// ── Minor detection (never on the shared celebration) ─────────────────────────
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

/**
 * Pregnancy and lactation are not weight-change goals. The rule has to hold on
 * BOTH sides of «تحقّق الهدف» — the account owner and every family member —
 * and it had drifted: the member branch excluded both states while the owner
 * branch tested only `is_pregnant`, so a nursing mother who had set a
 * pre-pregnancy target was congratulated on the card her children read.
 */
describe("no-loss-framing states are never celebrated on the shared card", () => {
  const ADULT_YEAR = YEAR - 34;

  it("excludes a LACTATING owner — the case that was live", () => {
    expect(
      isGoalCelebrationEligibleOwner(
        { member_type: "lactating", is_pregnant: false, birth_year: ADULT_YEAR },
        YEAR,
      ),
    ).toBe(false);
  });

  it("excludes a pregnant owner by either signal", () => {
    expect(
      isGoalCelebrationEligibleOwner(
        { member_type: "pregnant", is_pregnant: false, birth_year: ADULT_YEAR },
        YEAR,
      ),
    ).toBe(false);
    expect(
      isGoalCelebrationEligibleOwner(
        { member_type: "adult", is_pregnant: true, birth_year: ADULT_YEAR },
        YEAR,
      ),
    ).toBe(false);
  });

  it("still celebrates an ordinary adult owner", () => {
    expect(
      isGoalCelebrationEligibleOwner(
        { member_type: "adult", is_pregnant: false, birth_year: ADULT_YEAR },
        YEAR,
      ),
    ).toBe(true);
  });

  it("refuses a minor owner, as the weigh-in gate already did", () => {
    expect(
      isGoalCelebrationEligibleOwner(
        { member_type: "adult", is_pregnant: false, birth_year: YEAR - 15 },
        YEAR,
      ),
    ).toBe(false);
  });

  it("treats the owner and an identical family member the same way", () => {
    for (const t of ["pregnant", "lactating"]) {
      expect(
        isGoalCelebrationEligibleOwner(
          { member_type: t, is_pregnant: false, birth_year: ADULT_YEAR },
          YEAR,
        ),
      ).toBe(
        isGoalCelebrationEligibleMember(
          { member_type: t, role: "mom", birth_year: ADULT_YEAR },
          YEAR,
        ),
      );
    }
  });

  it("flags the states directly", () => {
    expect(isInNoLossFramingState({ member_type: "lactating" })).toBe(true);
    expect(isInNoLossFramingState({ member_type: "pregnant" })).toBe(true);
    expect(isInNoLossFramingState({ member_type: "adult", is_pregnant: true })).toBe(true);
    expect(isInNoLossFramingState({ member_type: "adult", is_pregnant: false })).toBe(false);
    expect(isInNoLossFramingState({ member_type: null })).toBe(false);
  });
});
