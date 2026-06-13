import { describe, it, expect } from "vitest";
import { orderDayMeals } from "./mealOrder";
import type { Meal } from "@fitlife/plan-engine";

function meal(
  slot: Meal["slot"],
  recipe_name_ar: string,
  opts: Partial<Meal> = {},
): Meal {
  return {
    slot,
    slot_name_ar: slot,
    recipe_name_ar,
    ingredients: [],
    prep_steps_ar: [],
    calories: 0,
    macros: { protein_g: 0, carbs_g: 0, fat_g: 0 },
    ...opts,
  };
}

const idx = (meals: Meal[], name: string) =>
  meals.findIndex((m) => m.recipe_name_ar === name);

describe("orderDayMeals", () => {
  it("places a shared snack in the SAME position (after lunch) for every member", () => {
    // Member A eats the shared snack X as an evening snack (after lunch); member B,
    // who only has one snack, had it emitted BEFORE lunch.
    const a = [
      meal("breakfast", "بيض"),
      meal("snack", "لبنة"), // A's own morning snack
      meal("lunch", "كبسة"),
      meal("snack", "بيض مسلوق", { shared_recipe: true }), // shared X (evening for A)
      meal("dinner", "سلطة"),
    ];
    const b = [
      meal("breakfast", "أومليت"),
      meal("snack", "بيض مسلوق", { shared_recipe: true }), // shared X (before lunch for B)
      meal("lunch", "كبسة"),
      meal("dinner", "شوربة"),
    ];
    const family = [a, b];

    const oa = orderDayMeals(a, family);
    const ob = orderDayMeals(b, family);

    // Shared X is after lunch for BOTH (tie morning/evening → evening).
    expect(idx(oa, "بيض مسلوق")).toBeGreaterThan(idx(oa, "كبسة"));
    expect(idx(ob, "بيض مسلوق")).toBeGreaterThan(idx(ob, "كبسة"));
    // A's own morning snack stays before lunch.
    expect(idx(oa, "لبنة")).toBeLessThan(idx(oa, "كبسة"));
    // Canonical sequence for A: breakfast → morning snack → lunch → evening snack → dinner.
    expect(oa.map((m) => m.recipe_name_ar)).toEqual([
      "بيض",
      "لبنة",
      "كبسة",
      "بيض مسلوق",
      "سلطة",
    ]);
    expect(ob.map((m) => m.recipe_name_ar)).toEqual([
      "أومليت",
      "كبسة",
      "بيض مسلوق",
      "شوربة",
    ]);
  });

  it("keeps a member's own morning vs evening snacks in place", () => {
    const meals = [
      meal("breakfast", "فطور"),
      meal("snack", "سناك صباحي"), // before lunch → morning
      meal("lunch", "غداء"),
      meal("snack", "سناك مسائي"), // after lunch → evening
      meal("dinner", "عشاء"),
    ];
    expect(orderDayMeals(meals).map((x) => x.recipe_name_ar)).toEqual([
      "فطور",
      "سناك صباحي",
      "غداء",
      "سناك مسائي",
      "عشاء",
    ]);
  });

  it("sorts an out-of-order single member's day into the canonical sequence", () => {
    const meals = [
      meal("dinner", "عشاء"),
      meal("lunch", "غداء"),
      meal("breakfast", "فطور"),
    ];
    expect(orderDayMeals(meals).map((x) => x.recipe_name_ar)).toEqual([
      "فطور",
      "غداء",
      "عشاء",
    ]);
  });
});
