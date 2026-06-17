import { describe, expect, it } from "vitest";
import { SAR_TO_USD_RATE } from "@fitlife/config";
import { sarToUsd, usdToSar } from "./revenue";

describe("usdToSar", () => {
  it("inverts the platform rate", () => {
    expect(usdToSar(0)).toBe(0);
    // usd == rate ⇒ sar == 1
    expect(usdToSar(SAR_TO_USD_RATE)).toBeCloseTo(1, 9);
  });

  it("round-trips with sarToUsd within rounding tolerance", () => {
    expect(usdToSar(sarToUsd(100))).toBeCloseTo(100, 1);
  });
});
