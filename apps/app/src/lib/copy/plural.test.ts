import { describe, it, expect } from "vitest";

import { countAr, DAY_FORMS, PERSON_FORMS } from "./plural";
import {
  buildTrialEndsMessage,
  buildPersonLimitMessage,
} from "@/lib/subscription/strings";

describe("countAr", () => {
  it("drops the numeral for one and two, as Arabic requires", () => {
    // «1 يوم» / «2 يوم» is the tell-tale machine-translated look. The noun's
    // own form carries the count here.
    expect(countAr(1, DAY_FORMS)).toBe("يوم واحد");
    expect(countAr(2, DAY_FORMS)).toBe("يومين");
    expect(countAr(1, PERSON_FORMS)).toBe("شخص واحد");
    expect(countAr(2, PERSON_FORMS)).toBe("شخصين");
  });

  it("uses the plural for 3-10 and the singular accusative for 11-99", () => {
    expect(countAr(3, DAY_FORMS)).toBe("3 أيام");
    expect(countAr(7, DAY_FORMS)).toBe("7 أيام");
    expect(countAr(10, DAY_FORMS)).toBe("10 أيام");
    expect(countAr(11, DAY_FORMS)).toBe("11 يوماً");
    expect(countAr(30, DAY_FORMS)).toBe("30 يوماً");
  });

  it("uses the plain singular from 100 up", () => {
    expect(countAr(100, DAY_FORMS)).toBe("100 يوم");
  });
});

describe("subscription copy", () => {
  // The regression that prompted this: the 7-day trial is the default, so the
  // banner shipped «تنتهي بعد 7 يوم» on the highest-traffic upsell surface.
  it("agrees across the whole trial range", () => {
    expect(buildTrialEndsMessage(7)).toBe("تجربتك المجانية تنتهي بعد 7 أيام");
    expect(buildTrialEndsMessage(2)).toBe("تجربتك المجانية تنتهي بعد يومين");
    expect(buildTrialEndsMessage(1)).toBe("تجربتك المجانية تنتهي بعد يوم واحد");
    expect(buildTrialEndsMessage(0)).toBe("انتهت فترتك التجريبية");
    expect(buildTrialEndsMessage(-1)).toBe("انتهت فترتك التجريبية");
  });

  it("agrees on the tier headcount cap", () => {
    // Starter caps at one person — the case that read «تسمح بـ 1 أشخاص».
    expect(buildPersonLimitMessage(3, 1, "ستارتر")).toContain("تسمح بـ شخص واحد فقط");
    expect(buildPersonLimitMessage(3, 2, "برو")).toContain("تسمح بـ شخصين فقط");
    expect(buildPersonLimitMessage(6, 5, "فاميلي")).toContain("تسمح بـ 5 أشخاص فقط");
  });

  it("never emits a bare digit followed by the wrong noun form", () => {
    for (let n = 1; n <= 30; n++) {
      const msg = buildTrialEndsMessage(n);
      expect(msg).not.toMatch(/\d+ يوم$/); // «7 يوم» — the original bug
      expect(msg).not.toMatch(/\d+ يوم واحد|\d+ يومين/);
    }
  });
});
