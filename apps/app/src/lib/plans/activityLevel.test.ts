import { describe, it, expect } from "vitest";
import { activityLevelFrom } from "./activityLevel";

// The full 12-combination table from the module doc — asserted row by row so
// any drift from the MOH-aligned mapping fails loudly.
describe("activityLevelFrom", () => {
  it("desk (مكتبية) row", () => {
    expect(activityLevelFrom("desk", "none")).toBe("sedentary");
    expect(activityLevelFrom("desk", "d1_2")).toBe("light");
    expect(activityLevelFrom("desk", "d3_5")).toBe("moderate");
    expect(activityLevelFrom("desk", "d6_plus")).toBe("active");
  });

  it("moderate_movement (حركة متوسطة) row", () => {
    expect(activityLevelFrom("moderate_movement", "none")).toBe("light");
    expect(activityLevelFrom("moderate_movement", "d1_2")).toBe("moderate");
    expect(activityLevelFrom("moderate_movement", "d3_5")).toBe("active");
    expect(activityLevelFrom("moderate_movement", "d6_plus")).toBe("very_active");
  });

  it("physical_work (عمل بدني) row", () => {
    expect(activityLevelFrom("physical_work", "none")).toBe("moderate");
    expect(activityLevelFrom("physical_work", "d1_2")).toBe("active");
    expect(activityLevelFrom("physical_work", "d3_5")).toBe("very_active");
    expect(activityLevelFrom("physical_work", "d6_plus")).toBe("very_active");
  });

  it("exercise type never shifts the level", () => {
    expect(activityLevelFrom("desk", "d3_5", "resistance")).toBe("moderate");
    expect(activityLevelFrom("desk", "d3_5", "cardio")).toBe("moderate");
    expect(activityLevelFrom("desk", "d3_5", null)).toBe("moderate");
  });
});
