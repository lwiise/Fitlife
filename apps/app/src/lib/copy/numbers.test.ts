import { describe, expect, it } from "vitest";
import { arDec, arDigits, arNum, arPct } from "./numbers";

describe("Arabic-Indic figures", () => {
  it("arNum rounds to an integer, without grouping", () => {
    expect(arNum(14)).toBe("١٤");
    expect(arNum(1420.6)).toBe("١٤٢١");
  });

  it("arDec keeps the fraction an amount needs", () => {
    expect(arDec(0.5)).toBe("٠٫٥");
    expect(arDec(1.25)).toBe("١٫٢٥");
    expect(arDec(420)).toBe("٤٢٠");
    expect(arDec(1500)).toBe("١٥٠٠");
  });

  it("arPct renders a fraction as a percent", () => {
    expect(arPct(0.64)).toMatch(/^٦٤٪/);
  });

  it("arDigits converts only the digits of a stored string", () => {
    expect(arDigits("8-12")).toBe("٨-١٢");
    expect(arDigits("30 ثانية")).toBe("٣٠ ثانية");
    expect(arDigits("حتى الإجهاد")).toBe("حتى الإجهاد");
  });
});
