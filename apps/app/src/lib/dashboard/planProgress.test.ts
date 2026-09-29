import { describe, expect, it } from "vitest";
import type { MealPlan } from "@fitlife/plan-engine";
import { daysReady } from "./planProgress";

const day = (i: number, meals: number) => ({
  day_index: i,
  day_name_ar: "x",
  meals: Array.from({ length: meals }, () => ({})),
  day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
});

describe("daysReady", () => {
  it("counts only days every member has meals for", () => {
    const plan = {
      members: [
        { member_id: "mom", days: [day(0, 4), day(1, 4), day(2, 4)] },
        { member_id: "kid", days: [day(0, 3), day(1, 0), day(2, 3)] },
      ],
    } as unknown as MealPlan;
    expect(daysReady(plan)).toBe(2);
  });
  it("does not wait on a member for the days before they joined the week", () => {
    const plan = {
      members: [
        { member_id: "mom", days: [day(0, 4), day(1, 4), day(2, 4)] },
        { member_id: "gma", days: [day(0, 0), day(1, 2), day(2, 0)] },
      ],
      member_joins: { gma: { day_index: 1 } },
    } as unknown as MealPlan;
    // Day 0 predates her; day 2 is a real gap.
    expect(daysReady(plan)).toBe(2);
  });
  it("is 0 for no plan or no members", () => {
    expect(daysReady(null)).toBe(0);
    expect(daysReady({ members: [] } as unknown as MealPlan)).toBe(0);
  });
});
