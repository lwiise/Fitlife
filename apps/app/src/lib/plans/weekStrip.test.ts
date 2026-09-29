import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dayLineDate,
  intlLocaleTag,
  MONTH_AR,
  mealStripDays,
  SHORT_WEEKDAY_AR,
  stripDayLabel,
  workoutStripDays,
} from "./weekStrip";
import { workoutSessionPastDateISO } from "@/lib/engagement/seasonMath";
import type { LocaleCode } from "@fitlife/plan-engine";

// 2026-09-27 is a Sunday; the 29th a Tuesday.

describe("mealStripDays", () => {
  it("dates each cell from week_start_date across a month boundary", () => {
    const days = mealStripDays("2026-09-27", "ar", "2026-09-29");
    expect(days.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days.map((d) => d.iso)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(days.map((d) => d.dayOfMonth)).toEqual(["٢٧", "٢٨", "٢٩", "٣٠", "١", "٢", "٣"]);
    expect(days.map((d) => d.monthLong)).toEqual([
      "سبتمبر",
      "سبتمبر",
      "سبتمبر",
      "سبتمبر",
      "أكتوبر",
      "أكتوبر",
      "أكتوبر",
    ]);
    expect(days.map((d) => d.weekdayShort)).toEqual([...SHORT_WEEKDAY_AR]);
    expect(days[2]!.weekdayFull).toBe("الثلاثاء");
  });

  it("follows the plan's own anchor, not a fixed Saturday", () => {
    // Plans are anchored to their generation day: a Wednesday start puts
    // Wednesday in the first cell.
    const days = mealStripDays("2026-09-30", "ar", "2026-09-30");
    expect(days[0]!.weekdayShort).toBe("أربعاء");
    expect(days[6]!.weekdayShort).toBe("ثلاثاء");
  });

  it("marks exactly today", () => {
    const days = mealStripDays("2026-09-27", "ar", "2026-09-29");
    expect(days.filter((d) => d.isToday).map((d) => d.index)).toEqual([2]);
  });

  it("marks nothing once the week has ended (or before it starts)", () => {
    expect(mealStripDays("2026-09-27", "ar", "2026-10-10").some((d) => d.isToday)).toBe(false);
    expect(mealStripDays("2026-09-27", "ar", "2026-09-20").some((d) => d.isToday)).toBe(false);
  });

  it("keeps seven navigable cells when the week start is unreadable", () => {
    const days = mealStripDays("not-a-date", "ar", "2026-09-29");
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.weekdayShort)).toEqual(["١", "٢", "٣", "٤", "٥", "٦", "٧"]);
    expect(days.every((d) => d.iso === "" && !d.isToday)).toBe(true);
  });

  it("labels other locales through Intl, with their own digits", () => {
    const en = mealStripDays("2026-09-27", "en", "2026-09-29");
    expect(en[2]).toMatchObject({
      weekdayShort: "Tue",
      weekdayFull: "Tuesday",
      dayOfMonth: "29",
      monthLong: "September",
      isToday: true,
    });
    expect(en[4]!.monthLong).toBe("October");
    // Bengali keeps its native digits — that is the cook's own script.
    expect(mealStripDays("2026-09-27", "bn", "2026-09-29")[2]!.dayOfMonth).toBe("২৯");
  });
});

describe("workoutStripDays", () => {
  it("runs Sunday→Saturday of this week from Tuesday on", () => {
    const days = workoutStripDays("ar", "2026-09-29");
    expect(days.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days[0]).toMatchObject({ iso: "2026-09-27", weekdayShort: "أحد" });
    expect(days[6]).toMatchObject({ iso: "2026-10-03", weekdayShort: "سبت" });
    expect(days.filter((d) => d.isToday).map((d) => d.index)).toEqual([2]);
    expect(workoutStripDays("ar", "2026-10-03").map((d) => d.iso)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  // The marking window keeps a 48h floor into the previous week, and a mark
  // there lands on LAST Friday/Saturday — so those cells carry that date, and
  // lead the strip so the dates stay in order.
  it("leads with last week's still-markable days on a Sunday or Monday", () => {
    const sun = workoutStripDays("ar", "2026-09-27");
    expect(sun.map((d) => d.iso)).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    expect(sun.map((d) => d.index)).toEqual([5, 6, 0, 1, 2, 3, 4]);
    expect(sun[0]!.dayOfMonth).toBe("٢٥");
    expect(sun[2]!.isToday).toBe(true);

    const mon = workoutStripDays("ar", "2026-09-28");
    expect(mon.map((d) => d.index)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(mon[0]!.iso).toBe("2026-09-26");
    expect(mon[6]!.iso).toBe("2026-10-02"); // Friday is three days back: past the window
  });

  it("has every weekday exactly once, in date order", () => {
    for (const today of ["2026-09-27", "2026-09-28", "2026-09-29", "2026-10-03"]) {
      const days = workoutStripDays("ar", today);
      expect([...days.map((d) => d.index)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
      const isos = days.map((d) => d.iso);
      expect([...isos].sort()).toEqual(isos);
    }
  });

  it("agrees with the date a mark is recorded against", () => {
    for (const today of ["2026-09-27", "2026-09-28", "2026-09-29", "2026-10-03"]) {
      for (const cell of workoutStripDays("ar", today)) {
        const markDate = workoutSessionPastDateISO(today, cell.index);
        if (markDate) expect(cell.iso).toBe(markDate);
        else expect(cell.iso > today).toBe(true);
      }
    }
  });
});

describe("dayLineDate", () => {
  const week = mealStripDays("2026-09-27", "ar", "2026-09-29");

  it("reads «الثلاثاء ٢٩ سبتمبر»", () => {
    expect(dayLineDate(week[2]!, "2026-09-29")).toEqual({
      date: "الثلاثاء ٢٩ سبتمبر",
      relative: "اليوم",
    });
  });

  it("names yesterday and tomorrow, and nothing further out", () => {
    expect(dayLineDate(week[1]!, "2026-09-29").relative).toBe("أمس");
    expect(dayLineDate(week[3]!, "2026-09-29").relative).toBe("غداً");
    expect(dayLineDate(week[0]!, "2026-09-29").relative).toBeNull();
    expect(dayLineDate(week[6]!, "2026-09-29").relative).toBeNull();
  });

  it("gives translated views the date alone, in the locale's own order", () => {
    const en = mealStripDays("2026-09-27", "en", "2026-09-29");
    const line = dayLineDate(en[2]!, "2026-09-29");
    expect(line.relative).toBeNull();
    expect(line.date).toContain("Tuesday");
    expect(line.date).toContain("September");
    expect(line.date).toContain("29");
  });

  it("falls back to the cell's label when the date is unknown", () => {
    const blank = mealStripDays("", "ar", "2026-09-29")[0]!;
    expect(dayLineDate(blank, "2026-09-29")).toEqual({ date: "١", relative: null });
    expect(stripDayLabel(blank)).toBe("١");
  });
});

// ── The Intl/Hijri pitfall ─────────────────────────────────────────────────
// `Intl.DateTimeFormat("ar-SA")` has no fixed calendar: Node's ICU resolves it
// to gregory, Chromium's to islamic-umalqura. Tests run on Node, so an output
// assertion alone passes whether or not the code guards against it. These
// tests pin the guard itself: the Arabic path uses a Gregorian table, and every
// other locale's tag names the calendar.

const ALL_LOCALES: LocaleCode[] = ["ar", "en", "tl", "id", "bn", "am", "ur"];

describe("Gregorian months, never Hijri", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("maps every Arabic month from the Gregorian table", () => {
    for (let m = 0; m < 12; m++) {
      const iso = `2026-${String(m + 1).padStart(2, "0")}-15`;
      expect(mealStripDays(iso, "ar", iso)[0]!.monthLong).toBe(MONTH_AR[m]);
    }
  });

  it("pins the Gregorian calendar in every non-Arabic tag", () => {
    for (const locale of ALL_LOCALES.filter((l) => l !== "ar")) {
      expect(intlLocaleTag(locale)).toMatch(/-u-ca-gregory$/);
    }
    expect(intlLocaleTag("ur")).toBe("ur-PK-u-ca-gregory");
  });

  it("stays Gregorian on an engine that defaults ar-SA to the Hijri calendar", async () => {
    // Emulate Chromium: any tag that does not name a calendar formats in
    // islamic-umalqura.
    const Real = Intl.DateTimeFormat;
    function ChromiumLike(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ): Intl.DateTimeFormat {
      const tag = Array.isArray(locales) ? locales[0] : locales;
      const pinned = !!tag && tag.includes("-u-ca-");
      return new Real(pinned ? tag : `${tag ?? "ar-SA"}-u-ca-islamic-umalqura`, options);
    }
    // Intl's members are non-enumerable, so inherit them rather than spread.
    vi.stubGlobal("Intl", Object.assign(Object.create(Intl), { DateTimeFormat: ChromiumLike }));

    const sept29 = new Date("2026-09-29T00:00:00Z");
    // The stub really does reproduce the pitfall, so the assertions below
    // are not vacuous.
    expect(
      new Intl.DateTimeFormat("ar-SA", { timeZone: "UTC", month: "long" }).format(sept29),
    ).not.toBe("سبتمبر");

    // A fresh module, so its formatter cache is built under the stub.
    vi.resetModules();
    const fresh = await import("./weekStrip");
    const expected: Record<LocaleCode, string> = {
      ar: "سبتمبر",
      en: "September",
      tl: "Setyembre",
      id: "September",
      bn: "সেপ্টেম্বর",
      am: "ሴፕቴምበር",
      ur: "ستمبر",
    };
    for (const locale of ALL_LOCALES) {
      const day = fresh.mealStripDays("2026-09-27", locale, "2026-09-29")[2]!;
      expect(day.monthLong).toBe(expected[locale]);
      expect(fresh.stripDayLabel(day)).toContain(expected[locale]);
    }
  });
});
