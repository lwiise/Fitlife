import { describe, it, expect } from "vitest";
import { formatWeekRange, weekRangeLocale } from "./dayMapping";

describe("weekRangeLocale", () => {
  // Regression guard for the /plan hydration mismatch (React #418). The Arabic
  // branch used a bare "ar-SA", whose default calendar differs BY ENGINE — Node
  // resolves it to gregory, Chromium to islamic-umalqura — so the server sent
  // "٢٦ يوليو — ١ أغسطس" and the browser re-rendered "١٢ صفر — ١٨ صفر". Arabic
  // users also saw Hijri months while the rest of the app showed Gregorian.
  //
  // These assert the TAG, not the formatted output and not resolvedOptions().
  // That is deliberate and load-bearing: this test suite runs on Node, where
  // BOTH the output and the resolved calendar look correct with or without the
  // override, so a test written either of those ways passes while the bug is
  // live. The literal "-u-ca-gregory" is the only engine-independent signal.
  it("pins the Gregorian calendar for Arabic (the default locale)", () => {
    expect(weekRangeLocale()).toBe("ar-SA-u-ca-gregory");
    expect(weekRangeLocale("ar")).toBe("ar-SA-u-ca-gregory");
  });

  it("pins the Gregorian calendar for housekeeper locales", () => {
    for (const locale of ["en", "tl", "id", "bn", "am", "ur"] as const) {
      expect(weekRangeLocale(locale)).toBe(`${locale}-u-ca-gregory`);
    }
  });
});

describe("formatWeekRange", () => {
  it("spans the week start plus six days in Gregorian months", () => {
    const range = formatWeekRange("2026-07-26");
    expect(range).toBe("٢٦ يوليو — ١ أغسطس");
    expect(range).not.toContain("صفر"); // a Hijri month leaking back in
  });

  it("formats non-Arabic locales in their own script", () => {
    expect(formatWeekRange("2026-07-26", "en")).toMatch(/July/);
  });

  it("falls back to the raw value when the date is unparseable", () => {
    expect(formatWeekRange("not-a-date")).toBe("not-a-date");
  });
});
