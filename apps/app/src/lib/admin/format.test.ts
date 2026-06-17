import { describe, expect, it } from "vitest";
import { fmtMoney } from "./format";

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
});
