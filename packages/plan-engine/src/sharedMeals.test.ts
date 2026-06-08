import { describe, it, expect } from "vitest";
import { assembleSharedMeals } from "./generate";
import type { DaySlice, PlanSkeleton, Meal, Ingredient } from "./schema";

function ing(name_ar: string, amount: number, unit: Ingredient["unit"] = "g"): Ingredient {
  return { name_ar, amount, unit };
}

function meal(
  slot: Meal["slot"],
  recipe_name_ar: string,
  ingredients: Ingredient[],
  calories: number,
): Meal {
  return {
    slot,
    slot_name_ar: slot,
    recipe_name_ar,
    ingredients,
    prep_steps_ar: [`جهّزي ${recipe_name_ar}`],
    calories,
    macros: { protein_g: 30, carbs_g: 40, fat_g: 10 },
  };
}

// 3 members share lunch "كبسة دجاج" (per-person portions); mom + dad share breakfast;
// the child has a different breakfast (own dish) → not shared.
function fixture(): { slice: DaySlice; skeleton: PlanSkeleton } {
  const skeletonMeals = (lunch: string, breakfast: string) => [
    { slot: "breakfast" as const, slot_name_ar: "فطور", recipe_name_ar: breakfast },
    { slot: "lunch" as const, slot_name_ar: "غداء", recipe_name_ar: lunch },
  ];
  const skelMember = (id: string, lunch: string, breakfast: string) => ({
    member_id: id,
    daily_calories_target: 1800,
    macros_target: { protein_g: 100, carbs_g: 180, fat_g: 60 },
    days: [{ day_index: 0, day_name_ar: "السبت", meals: skeletonMeals(lunch, breakfast) }],
  });

  const skeleton: PlanSkeleton = {
    members: [
      skelMember("mom", "كبسة دجاج", "بيض باللبنة"),
      skelMember("dad", "كبسة دجاج", "بيض باللبنة"),
      skelMember("child-1", "كبسة دجاج", "زبادي بالعسل"),
    ],
  };

  const slice: DaySlice = {
    day_index: 0,
    members: [
      {
        member_id: "mom",
        meals: [
          meal("breakfast", "بيض باللبنة", [ing("بيض", 2, "piece"), ing("لبنة", 50)], 300),
          meal("lunch", "كبسة دجاج", [ing("دجاج", 80), ing("أرز", 120)], 500),
        ],
      },
      {
        member_id: "dad",
        meals: [
          meal("breakfast", "بيض باللبنة", [ing("بيض", 3, "piece"), ing("لبنة", 70)], 380),
          meal("lunch", "كبسة دجاج", [ing("دجاج", 120), ing("أرز", 180)], 720),
        ],
      },
      {
        member_id: "child-1",
        meals: [
          meal("breakfast", "زبادي بالعسل", [ing("زبادي", 120), ing("عسل", 10)], 180),
          meal("lunch", "كبسة دجاج", [ing("دجاج", 60), ing("أرز", 90)], 380),
        ],
      },
    ],
  };
  return { slice, skeleton };
}

const lunchOf = (slice: DaySlice, id: string) =>
  slice.members.find((m) => m.member_id === id)!.meals.find((m) => m.slot === "lunch")!;

describe("assembleSharedMeals", () => {
  it("merges a 3-way shared lunch into one batch recipe with a correct split", () => {
    const { slice, skeleton } = fixture();
    assembleSharedMeals(slice, skeleton, 0);

    for (const id of ["mom", "dad", "child-1"]) {
      const m = lunchOf(slice, id);
      expect(m.shared_recipe).toBe(true);
      // ingredients are the GROUP TOTAL, identical on every member's copy
      const chicken = m.ingredients.find((i) => i.name_ar === "دجاج")!;
      const rice = m.ingredients.find((i) => i.name_ar === "أرز")!;
      expect(chicken.amount).toBe(80 + 120 + 60); // 260g total
      expect(rice.amount).toBe(120 + 180 + 90); // 390g total
      expect(m.batch_finished_weight_g).toBe(260 + 390); // 650g
      expect(m.per_member_portions).toHaveLength(3);
    }
  });

  it("derives per-member grams + percentages from each portion's weight", () => {
    const { slice, skeleton } = fixture();
    assembleSharedMeals(slice, skeleton, 0);
    const portions = lunchOf(slice, "mom").per_member_portions!;
    const byId = Object.fromEntries(portions.map((p) => [p.member_id, p]));

    expect(byId["mom"]!.portion_grams).toBe(200); // 80 + 120
    expect(byId["dad"]!.portion_grams).toBe(300); // 120 + 180
    expect(byId["child-1"]!.portion_grams).toBe(150); // 60 + 90
    // percentages of 650g total
    expect(byId["mom"]!.portion_percentage).toBe(31); // round(200/650)
    expect(byId["dad"]!.portion_percentage).toBe(46); // round(300/650)
    expect(byId["child-1"]!.portion_percentage).toBe(23); // round(150/650)
  });

  it("keeps each member's own calories/macros on the shared meal", () => {
    const { slice, skeleton } = fixture();
    assembleSharedMeals(slice, skeleton, 0);
    expect(lunchOf(slice, "mom").calories).toBe(500);
    expect(lunchOf(slice, "dad").calories).toBe(720);
    expect(lunchOf(slice, "child-1").calories).toBe(380);
  });

  it("does NOT share a meal only one member eats (different dish name)", () => {
    const { slice, skeleton } = fixture();
    assembleSharedMeals(slice, skeleton, 0);
    const childBreakfast = slice.members
      .find((m) => m.member_id === "child-1")!
      .meals.find((m) => m.slot === "breakfast")!;
    expect(childBreakfast.shared_recipe).toBe(false);
    expect(childBreakfast.per_member_portions).toBeUndefined();
    // mom+dad DO share breakfast (same dish)
    const momBreakfast = slice.members
      .find((m) => m.member_id === "mom")!
      .meals.find((m) => m.slot === "breakfast")!;
    expect(momBreakfast.shared_recipe).toBe(true);
    expect(momBreakfast.per_member_portions).toHaveLength(2);
  });

  it("clears any model-provided shared fields before recomputing", () => {
    const { slice, skeleton } = fixture();
    // simulate the model wrongly stamping shared fields on a solo dish
    const childBreakfast = slice.members
      .find((m) => m.member_id === "child-1")!
      .meals.find((m) => m.slot === "breakfast")!;
    childBreakfast.shared_recipe = true;
    childBreakfast.batch_finished_weight_g = 9999;
    childBreakfast.per_member_portions = [{ member_id: "child-1", portion_grams: 9999 }];

    assembleSharedMeals(slice, skeleton, 0);
    expect(childBreakfast.shared_recipe).toBe(false);
    expect(childBreakfast.batch_finished_weight_g).toBeUndefined();
    expect(childBreakfast.per_member_portions).toBeUndefined();
  });
});
