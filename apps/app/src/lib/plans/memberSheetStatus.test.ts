import { describe, expect, it } from "vitest";
import { memberSheetStatus } from "./memberSheetStatus";

const base = {
  memberId: "abc",
  translation: "done" as const,
  generating: false,
  generatingMemberId: null,
  weekComplete: true,
  dayHasMeals: true,
  isChild: false,
};

describe("memberSheetStatus", () => {
  it("shows the plan's figure when nothing is pending", () => {
    expect(memberSheetStatus(base)).toBe("calories");
    expect(memberSheetStatus({ ...base, isChild: true })).toBe("portions");
  });

  it("puts the cook's translation state first", () => {
    const busy = { ...base, generating: true, weekComplete: false, dayHasMeals: false };
    expect(memberSheetStatus({ ...busy, translation: "translating" })).toBe("translating");
    expect(memberSheetStatus({ ...busy, translation: "queued" })).toBe("queued");
  });

  it("says «being prepared» only for the member the run is filling", () => {
    const run = { ...base, generating: true, weekComplete: false, dayHasMeals: false };
    expect(memberSheetStatus({ ...run, generatingMemberId: "abc" })).toBe("generating");
    expect(memberSheetStatus({ ...run, generatingMemberId: "mom" })).toBe("day_empty");
    // No stamped member: the run fills every incomplete member.
    expect(memberSheetStatus({ ...run, generatingMemberId: null })).toBe("generating");
  });

  it("never calls a complete week «being prepared»", () => {
    expect(
      memberSheetStatus({ ...base, generating: true, generatingMemberId: null }),
    ).toBe("calories");
  });

  it("flags the open day when it has no meals and nothing is running", () => {
    expect(memberSheetStatus({ ...base, weekComplete: false, dayHasMeals: false })).toBe(
      "day_empty",
    );
    expect(
      memberSheetStatus({ ...base, isChild: true, weekComplete: false, dayHasMeals: false }),
    ).toBe("day_empty");
  });
});
