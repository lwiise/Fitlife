import { describe, it, expect } from "vitest";
import { selectMet } from "./metTable";

describe("selectMet — ceiling gate", () => {
  it("drops a vigorous request to moderate for a capped member (can't bypass via tier)", () => {
    expect(selectMet("cycling", "vigorous", "light_moderate")).toBe(7.0); // never 9.5
  });

  it("allows vigorous when the ceiling permits it", () => {
    expect(selectMet("cycling", "vigorous", "can_progress_to_vigorous")).toBe(9.5);
  });

  it("keeps a moderate request as moderate under a light_moderate ceiling", () => {
    expect(selectMet("walking", "moderate", "light_moderate")).toBe(3.5);
  });

  it("falls back across a sparse row (yoga has light only)", () => {
    expect(selectMet("yoga", "moderate", "can_progress_to_vigorous")).toBe(2.5);
    expect(selectMet("yoga", "vigorous", "can_progress_to_vigorous")).toBe(2.5);
  });
});
