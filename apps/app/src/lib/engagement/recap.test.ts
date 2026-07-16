import { describe, expect, it } from "vitest";

import type { MealPlan } from "@fitlife/plan-engine";

import { buildShareText, computeWeeklyRecap } from "./recap";

function makePlan(overrides: Partial<MealPlan> = {}): MealPlan {
  const meal = {
    slot: "lunch" as const,
    slot_name_ar: "الغداء",
    recipe_name_ar: "كبسة دجاج",
    ingredients: [],
    prep_steps_ar: [],
    calories: 600,
    macros: { protein_g: 40, carbs_g: 60, fat_g: 20 },
  };
  return {
    week_start_date: "2026-07-11",
    members: [
      {
        member_id: "mom",
        member_name_ar: "نورة",
        daily_calories_target: 1800,
        macros_target: { protein_g: 120, carbs_g: 180, fat_g: 60 },
        days: Array.from({ length: 7 }, (_, i) => ({
          day_index: i,
          day_name_ar: "السبت",
          meals: [meal, { ...meal, slot: "dinner" as const }],
          day_total: { calories: 1200, protein_g: 80, carbs_g: 120, fat_g: 40 },
        })),
      },
    ],
    ...overrides,
  } as MealPlan;
}

describe("computeWeeklyRecap", () => {
  it("marks a zero-event week as baseline with 7 unknown cells", () => {
    const recap = computeWeeklyRecap({
      plan: makePlan(),
      checkins: [],
      verdicts: [],
      weights: [],
    });
    expect(recap.baseline).toBe(true);
    expect(recap.day_cells).toHaveLength(7);
    expect(recap.day_cells.every((c) => c.state === "unknown")).toBe(true);
    expect(recap.logged_days).toBe(0);
    expect(recap.meals_planned).toBe(14);
    expect(recap.members_count).toBe(1);
  });

  it("gold guest days outrank cooked, and skipped-only days count as logged", () => {
    const recap = computeWeeklyRecap({
      plan: makePlan(),
      checkins: [
        { local_date: "2026-07-11", slot: "lunch", status: "cooked", reason: null },
        {
          local_date: "2026-07-12",
          slot: "dinner",
          status: "skipped",
          reason: "guests",
        },
        {
          local_date: "2026-07-12",
          slot: "lunch",
          status: "cooked",
          reason: null,
        },
        {
          local_date: "2026-07-13",
          slot: "lunch",
          status: "skipped",
          reason: "no_time",
        },
      ],
      verdicts: [],
      weights: [],
    });
    expect(recap.day_cells[0]!.state).toBe("cooked");
    expect(recap.day_cells[1]!.state).toBe("guest");
    expect(recap.day_cells[2]!.state).toBe("logged");
    expect(recap.day_cells[3]!.state).toBe("unknown");
    expect(recap.cooked_days).toBe(2); // guest day counts as a table honored
    expect(recap.guest_days).toBe(1);
    expect(recap.logged_days).toBe(3);
    expect(recap.baseline).toBe(false);
  });

  it("computes the top loved dish and the private weight delta", () => {
    const recap = computeWeeklyRecap({
      plan: makePlan(),
      checkins: [],
      verdicts: [
        { recipe_name_ar: "كبسة دجاج", canonical_key: "دجاج كبسه", verdict: "loved" },
        { recipe_name_ar: "كبسة الدجاج", canonical_key: "دجاج كبسه", verdict: "loved" },
        { recipe_name_ar: "شوربة عدس", canonical_key: "شوربه عدس", verdict: "loved" },
        { recipe_name_ar: "سلطة", canonical_key: "سلطه", verdict: "not_again" },
      ],
      weights: [
        { recorded_on: "2026-07-15", weight_kg: 71.2 },
        { recorded_on: "2026-07-08", weight_kg: 71.9 },
      ],
    });
    expect(recap.top_dish).toEqual({ recipe_name_ar: "كبسة دجاج", loved_count: 2 });
    expect(recap.weight_delta_kg).toBe(-0.7);
  });

  it("needs two weigh-ins for a delta", () => {
    const recap = computeWeeklyRecap({
      plan: makePlan(),
      checkins: [],
      verdicts: [],
      weights: [{ recorded_on: "2026-07-15", weight_kg: 71.2 }],
    });
    expect(recap.weight_delta_kg).toBeNull();
  });
});

describe("buildShareText", () => {
  it("shares positives only and cannot receive private fields", () => {
    const text = buildShareText({ cooked_days: 5, guest_days: 1 });
    expect(text).toContain("٥ أيام من مطبخنا");
    expect(text).toContain("وليلة كرم");
    expect(text).not.toContain("كجم");
  });

  it("stays warm on an empty week", () => {
    const text = buildShareText({ cooked_days: 0, guest_days: 0 });
    expect(text).toContain("أسبوع جديد");
  });
});
