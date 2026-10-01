import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fmtBucketLabel,
  fmtDate,
  fmtMetricValue,
  fmtMoney,
  fmtMoneyFromSar,
  fmtMonth,
} from "./format";

describe("fmtMoney", () => {
  it("caps USD at 2 decimals (no raw floats like $1.6395)", () => {
    expect(fmtMoney(1.6395, "usd", "en")).toBe("$1.64");
    expect(fmtMoney(0.7969, "usd", "en")).toBe("$0.80");
  });

  it("renders converted SAR without a USD symbol", () => {
    const out = fmtMoney(10, "sar", "en");
    expect(out).not.toContain("$");
    expect(out).toMatch(/SAR|ر\.س/);
  });

  it("keeps cents for small SAR values when precision is requested", () => {
    // prec=2 ⇒ a sub-riyal figure keeps two fraction digits
    expect(fmtMoney(0.5, "sar", "en", 2)).toMatch(/\.\d{2}\b/);
  });

  it("honors usdPrec so 4-decimal detail costs survive (no $0.00 collapse)", () => {
    // The subscriber-detail costs render at 4 decimals — bare usdPrec would
    // round $0.0023 down to $0.00.
    expect(fmtMoney(0.0023, "usd", "en", 4, 4)).toBe("$0.0023");
  });
});

describe("fmtMoneyFromSar", () => {
  it("formats SAR-native amounts as SAR when sar is selected", () => {
    const out = fmtMoneyFromSar(100, "sar", "en");
    expect(out).not.toContain("$");
    expect(out).toMatch(/SAR|ر\.س/);
  });

  it("converts SAR→USD at the platform rate when usd is selected", () => {
    // 100 SAR * 0.27 = $27.00
    expect(fmtMoneyFromSar(100, "usd", "en")).toBe("$27.00");
  });
});

describe("fmtMetricValue currency", () => {
  it("defaults sar-unit values to SAR", () => {
    const out = fmtMetricValue(100, "sar", "en");
    expect(out).not.toContain("$");
    expect(out).toMatch(/SAR|ر\.س/);
  });

  it("converts sar-unit values to USD when usd is selected", () => {
    // 100 SAR → $27
    expect(fmtMetricValue(100, "sar", "en", "usd")).toBe("$27.00");
  });

  it("renders compact USD for sar-unit values when compact", () => {
    // 10,000 SAR → $2,700 → compact "$2.7K"
    const out = fmtMetricValue(10_000, "sar", "en", "usd", true);
    expect(out).toContain("$");
    expect(out).toMatch(/2\.7\s?K/i);
  });

  it("leaves count units currency-independent", () => {
    expect(fmtMetricValue(1234, "count", "en", "usd")).toBe("1,234");
  });
});

// All admin bucketing is UTC (timeseries startOfUtc*, cohorts monthKey), so
// the formatters pin timeZone: "UTC". These use 21:00–24:00 UTC edge
// timestamps: on any UTC+N runtime an unpinned formatter would roll the
// calendar day/month forward and desync labels from bucket boundaries.
describe("date formatters are pinned to UTC", () => {
  it("fmtDate keeps the UTC calendar day near midnight", () => {
    expect(fmtDate("2026-01-01T23:30:00Z", "en")).toBe("Jan 1, 2026");
  });

  it("fmtBucketLabel keeps a day bucket's own date", () => {
    expect(fmtBucketLabel("2026-01-31T23:00:00Z", "day", "en")).toMatch(/31/);
    expect(fmtBucketLabel("2026-01-31T23:00:00Z", "day", "en")).toMatch(/Jan/);
  });

  it("fmtMonth does not roll a late-month timestamp into the next month", () => {
    expect(fmtMonth("2026-01-31T23:30:00Z", "en")).toMatch(/Jan/);
  });
});

describe("formatters are built once and reused", () => {
  const real = {
    NumberFormat: Intl.NumberFormat,
    DateTimeFormat: Intl.DateTimeFormat,
    RelativeTimeFormat: Intl.RelativeTimeFormat,
  };
  afterEach(() => {
    Object.assign(Intl, real);
    vi.resetModules();
  });

  it("builds one Intl formatter per kind and locale, however many values it formats", async () => {
    const built = { number: 0, date: 0, relative: 0 };
    Object.assign(Intl, {
      NumberFormat: class extends real.NumberFormat {
        constructor(...args: ConstructorParameters<typeof Intl.NumberFormat>) {
          super(...args);
          built.number += 1;
        }
      },
      DateTimeFormat: class extends real.DateTimeFormat {
        constructor(...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
          super(...args);
          built.date += 1;
        }
      },
      RelativeTimeFormat: class extends real.RelativeTimeFormat {
        constructor(...args: ConstructorParameters<typeof Intl.RelativeTimeFormat>) {
          super(...args);
          built.relative += 1;
        }
      },
    });
    // A fresh module: its formatter map starts empty.
    vi.resetModules();
    const format = await import("./format");
    for (let i = 0; i < 50; i += 1) {
      format.fmtNumber(i, "ar");
      format.fmtNumber(i, "en");
      format.fmtMoney(i, "sar", "ar", 2);
      format.fmtUsd(i, "en", 4);
      format.fmtPct(i, "ar");
      format.fmtDate("2026-09-30T00:00:00Z", "ar");
      format.fmtBucketLabel("2026-09-30T00:00:00Z", "week", "en");
      format.fmtBucketLabel("2026-09-30T00:00:00Z", "day", "en");
      format.fmtRelative("2026-09-30T00:00:00Z", "ar", new Date("2026-10-01T00:00:00Z"));
    }
    // fmtNumber ×2 locales, SAR at 2 digits, USD at 4, the percent.
    expect(built.number).toBe(5);
    // fmtDate, and one shared day/week bucket label.
    expect(built.date).toBe(2);
    expect(built.relative).toBe(1);
  });

  it("formats exactly as a fresh formatter would", () => {
    for (const n of [0, 7, 1234.5, -42]) {
      for (const locale of ["ar", "en"] as const) {
        const tag = locale === "ar" ? "ar-SA" : "en-US";
        expect(fmtMoney(n, "usd", locale, 2, 4)).toBe(
          new Intl.NumberFormat(tag, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 4,
            minimumFractionDigits: 2,
          }).format(n),
        );
      }
    }
  });
});
