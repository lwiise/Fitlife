import { describe, it, expect } from "vitest";
import {
  ACTIVITY_AR,
  GOAL_AR,
  RESTRICTION_AR,
  ageFromBirthYear,
  label,
  labelList,
  measurements,
  todayLine,
  ageOrderLine,
} from "./contextFormat";

/**
 * These cover the two omissions that made the advisor unable to answer basic
 * questions about a household it already had complete data for:
 *
 *  1. no age/height/weight/activity in the context → «كم سعرة أحتاج؟» was
 *     answered by asking the user to re-type all four;
 *  2. no date in the context → «اليوم» and «بكرة» returned the SAME day, and
 *     the wrong one.
 */
describe("measurements", () => {
  const NOW = new Date("2026-08-01T12:00:00Z");

  it("renders every physical field a calorie answer needs", () => {
    const out = measurements(
      {
        sex: "female",
        birth_year: 1990,
        height_cm: 163,
        weight_kg: 77.4,
        activity_level: "light",
      },
      NOW,
    ).join("\n");

    expect(out).toContain("الجنس: أنثى");
    expect(out).toContain("العمر: 36 سنة");
    expect(out).toContain("الطول: 163 سم");
    expect(out).toContain("الوزن الحالي: 77.4 كجم");
    expect(out).toContain("نشاط خفيف");
  });

  it("coerces Postgres numeric-as-string so no field renders as [object]", () => {
    const out = measurements(
      { height_cm: "178", weight_kg: "92.0", sex: "male" },
      NOW,
    ).join("\n");
    expect(out).toContain("الطول: 178 سم");
    expect(out).toContain("الوزن الحالي: 92 كجم");
    expect(out).toContain("الجنس: ذكر");
  });

  it("omits fields that are genuinely unknown rather than inventing them", () => {
    expect(measurements({}, NOW)).toEqual([]);
    const partial = measurements({ weight_kg: 60 }, NOW);
    expect(partial).toHaveLength(1);
    expect(partial[0]).toContain("الوزن الحالي: 60");
  });

  it("never emits a raw English enum for a known activity level", () => {
    for (const key of Object.keys(ACTIVITY_AR)) {
      const out = measurements({ activity_level: key }, NOW).join(" ");
      expect(out).not.toContain(key);
    }
  });
});

describe("ageFromBirthYear", () => {
  const NOW = new Date("2026-08-01T12:00:00Z");

  it("computes whole years from the stored birth year", () => {
    expect(ageFromBirthYear(1990, NOW)).toBe(36);
    expect(ageFromBirthYear(1985, NOW)).toBe(41);
  });

  it("rejects impossible values instead of printing nonsense", () => {
    expect(ageFromBirthYear(null, NOW)).toBeNull();
    expect(ageFromBirthYear(undefined, NOW)).toBeNull();
    expect(ageFromBirthYear(2030, NOW)).toBeNull(); // future
    expect(ageFromBirthYear(1800, NOW)).toBeNull(); // absurd
  });
});

describe("todayLine", () => {
  it("names the actual weekday, so «اليوم» is not guessed", () => {
    // 2026-08-01 is a Saturday. The advisor answered «الأحد» for both «اليوم»
    // and «بكرة» before the date reached it.
    const line = todayLine(new Date("2026-08-01T12:00:00Z"));
    expect(line).toContain("السبت");
    expect(line).toContain("2026-08-01");
  });

  it("uses Riyadh time, not UTC, for the day boundary", () => {
    // 21:30 UTC is already the next day in Riyadh (UTC+3).
    const line = todayLine(new Date("2026-08-01T21:30:00Z"));
    expect(line).toContain("2026-08-02");
    expect(line).toContain("الأحد");
  });

  it("tells the model to derive relative days from it", () => {
    const line = todayLine(new Date("2026-08-01T12:00:00Z"));
    expect(line).toContain("بكرة");
    expect(line).toContain("لا تخمّني");
  });
});

describe("label / labelList", () => {
  it("translates stored enums so no English token reaches the reply", () => {
    // Real leak: «بما إنك مسجّلة lactose_free» came back to an Arabic-only user.
    expect(labelList(RESTRICTION_AR, ["lactose_free"])).toBe("عدم تحمل اللاكتوز");
    expect(label(GOAL_AR, "fat_loss")).toBe("نزول الوزن");
  });

  it("passes unknown values through instead of dropping a constraint", () => {
    expect(labelList(RESTRICTION_AR, ["something_new"])).toBe("something_new");
  });

  it("says «لا شيء» for empty, never an empty string", () => {
    expect(labelList(RESTRICTION_AR, [])).toBe("لا شيء");
    expect(labelList(RESTRICTION_AR, null)).toBe("لا شيء");
    expect(label(GOAL_AR, null)).toBe("غير محدد");
  });
});

describe("ageOrderLine", () => {
  const NOW = new Date("2026-08-02T12:00:00Z");
  const HOUSE = [
    { name: "هند", birth_year: 1990 },   // 36
    { name: "فيصل", birth_year: 1985 },  // 41
    { name: "لمى", birth_year: 2016 },   // 10
    { name: "سعود", birth_year: 2010 },  // 16
    { name: "نورة", birth_year: 1964 },  // 62
  ];

  it("names the youngest and the oldest outright", () => {
    // Asked «الأصغر» the advisor answered سعود (16) and «الأكبر» لمى (10) — the
    // youngest given as the oldest — while being able to recite both ages.
    const line = ageOrderLine(HOUSE, NOW);
    expect(line).toContain("الأصغر هو لمى");
    expect(line).toContain("والأكبر هو نورة");
  });

  it("orders the whole household youngest first", () => {
    const line = ageOrderLine(HOUSE, NOW);
    const order = ["لمى", "سعود", "هند", "فيصل", "نورة"].map((n) => line.indexOf(n));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(Math.min(...order)).toBeGreaterThan(-1);
  });

  it("shows each age so an ordinal question can be answered too", () => {
    const line = ageOrderLine(HOUSE, NOW);
    for (const age of ["(10)", "(16)", "(36)", "(41)", "(62)"]) {
      expect(line).toContain(age);
    }
  });

  it("lists members with no birth year separately rather than sorting them to an end", () => {
    const line = ageOrderLine([...HOUSE, { name: "ضيف", birth_year: null }], NOW);
    expect(line).toContain("بلا سنة ميلاد مسجّلة: ضيف");
    expect(line).toContain("الأصغر هو لمى");
  });

  it("returns nothing for an empty household", () => {
    expect(ageOrderLine([], NOW)).toBe("");
  });

  it("handles a single person without claiming a comparison", () => {
    const line = ageOrderLine([{ name: "هند", birth_year: 1990 }], NOW);
    expect(line).toContain("هند");
    expect(line).toContain("الأصغر هو هند");
  });
});
