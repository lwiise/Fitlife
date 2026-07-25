import { describe, it, expect } from "vitest";
import { isMissingMemberIdColumn } from "./legacyFallback";

describe("isMissingMemberIdColumn", () => {
  it("recognizes the pre-00019 schema by Postgres undefined_column", () => {
    expect(isMissingMemberIdColumn({ code: "42703" })).toBe(true);
    expect(
      isMissingMemberIdColumn({
        code: "42703",
        message: 'column meal_checkins.member_id does not exist',
      }),
    ).toBe(true);
  });

  it("recognizes it by message when the code is absent", () => {
    expect(
      isMissingMemberIdColumn({
        message: "column \"member_id\" of relation \"meal_checkins\" does not exist",
      }),
    ).toBe(true);
    expect(
      isMissingMemberIdColumn({
        message: "Could not find the 'member_id' column of 'meal_checkins'",
      }),
    ).toBe(true);
  });

  it("does NOT treat unrelated failures as the legacy schema", () => {
    // These previously fell through to the wider legacy write: an unscoped
    // delete of every member's mark, or a whole-house row that answers for
    // members who never marked.
    expect(isMissingMemberIdColumn({ code: "57014", message: "canceling statement due to statement timeout" })).toBe(false);
    expect(isMissingMemberIdColumn({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isMissingMemberIdColumn({ code: "42501", message: "new row violates row-level security policy" })).toBe(false);
    expect(isMissingMemberIdColumn({ message: "fetch failed" })).toBe(false);
    expect(isMissingMemberIdColumn({})).toBe(false);
    expect(isMissingMemberIdColumn({ code: null, message: null })).toBe(false);
  });
});
