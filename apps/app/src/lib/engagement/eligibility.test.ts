import { describe, it, expect } from "vitest";

import {
  isWeighInEligibleMember,
  isWeighInEligibleMom,
} from "./eligibility";

const YEAR = 2026;

describe("isWeighInEligibleMember", () => {
  it("accepts an adult", () => {
    expect(
      isWeighInEligibleMember(
        { member_type: "adult", role: "husband", birth_year: 1985 },
        YEAR,
      ),
    ).toBe(true);
  });

  it("accepts pregnant and lactating members (framing changes, the right does not)", () => {
    expect(
      isWeighInEligibleMember(
        { member_type: "pregnant", role: "wife", birth_year: 1995 },
        YEAR,
      ),
    ).toBe(true);
    expect(
      isWeighInEligibleMember(
        { member_type: "lactating", role: "wife", birth_year: 1995 },
        YEAR,
      ),
    ).toBe(true);
  });

  it("never accepts a child — even with an adult birth_year", () => {
    expect(
      isWeighInEligibleMember(
        { member_type: "child", role: "son", birth_year: 1990 },
        YEAR,
      ),
    ).toBe(false);
  });

  it("never accepts the housekeeper — by member_type OR role", () => {
    expect(
      isWeighInEligibleMember(
        { member_type: "housekeeper", role: null, birth_year: 1990 },
        YEAR,
      ),
    ).toBe(false);
    expect(
      isWeighInEligibleMember(
        { member_type: "adult", role: "housekeeper", birth_year: 1990 },
        YEAR,
      ),
    ).toBe(false);
  });

  it("refuses an under-18 birth_year even on an adult type", () => {
    expect(
      isWeighInEligibleMember(
        { member_type: "adult", role: "son", birth_year: YEAR - 17 },
        YEAR,
      ),
    ).toBe(false);
    expect(
      isWeighInEligibleMember(
        { member_type: "adult", role: "son", birth_year: YEAR - 18 },
        YEAR,
      ),
    ).toBe(true);
  });

  it("allows an adult type with unknown birth_year", () => {
    expect(
      isWeighInEligibleMember(
        { member_type: "adult", role: "husband", birth_year: null },
        YEAR,
      ),
    ).toBe(true);
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
