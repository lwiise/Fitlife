import { describe, expect, it } from "vitest";
import { pickPlanNotice } from "./planNotice";

const none = { maskedFailure: false, tierBlocked: false, membersPending: false };

describe("pickPlanNotice", () => {
  it("shows nothing when nothing is true, so the onboarding banner may show", () => {
    expect(pickPlanNotice(none)).toBeNull();
  });

  it("returns each kind on its own", () => {
    expect(pickPlanNotice({ ...none, maskedFailure: true })).toBe("masked_failure");
    expect(pickPlanNotice({ ...none, tierBlocked: true })).toBe("tier_blocked");
    expect(pickPlanNotice({ ...none, membersPending: true })).toBe("members_pending");
  });

  it("orders masked_failure › tier_blocked › members_pending over every combination", () => {
    for (const maskedFailure of [false, true]) {
      for (const tierBlocked of [false, true]) {
        for (const membersPending of [false, true]) {
          const expected = maskedFailure
            ? "masked_failure"
            : tierBlocked
              ? "tier_blocked"
              : membersPending
                ? "members_pending"
                : null;
          expect(pickPlanNotice({ maskedFailure, tierBlocked, membersPending })).toBe(expected);
        }
      }
    }
  });
});
