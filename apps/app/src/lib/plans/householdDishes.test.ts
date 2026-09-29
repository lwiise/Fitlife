import { describe, expect, it } from "vitest";
import type { Meal, MemberPlan } from "@fitlife/plan-engine";
import { householdDayDishes } from "./householdDishes";

function meal(slot: Meal["slot"], recipe_name_ar: string, opts: Partial<Meal> = {}): Meal {
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

function shared(slot: Meal["slot"], name: string, sharers: string[]): Meal {
  return meal(slot, name, {
    shared_recipe: true,
    per_member_portions: sharers.map((member_id) => ({ member_id })),
  });
}

function member(member_id: string, days: Record<number, Meal[]>): Pick<MemberPlan, "member_id" | "days"> {
  return {
    member_id,
    days: Object.entries(days).map(([i, meals]) => ({
      day_index: Number(i),
      day_name_ar: "",
      meals,
      day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    })),
  };
}

const names = (dishes: ReturnType<typeof householdDayDishes>) =>
  dishes.map((d) => d.meal.recipe_name_ar);

describe("householdDayDishes", () => {
  it("lists a shared pot once, credited to its first sharer in roster order", () => {
    const kabsa = ["mom", "abc", "def"];
    const dishes = householdDayDishes(
      [
        member("mom", { 2: [shared("lunch", "كبسة", kabsa)] }),
        member("abc", { 2: [shared("lunch", "كبسة", kabsa)] }),
        member("def", { 2: [shared("lunch", "كبسة ", kabsa)] }),
      ],
      2,
    );
    expect(names(dishes)).toEqual(["كبسة"]);
    expect(dishes[0]!.memberId).toBe("mom");
    expect(dishes[0]!.sharerIds).toEqual(kabsa);
  });

  it("keeps every individual plate, even when two people have the same recipe", () => {
    const dishes = householdDayDishes(
      [
        member("mom", { 0: [meal("breakfast", "شوفان")] }),
        member("abc", { 0: [meal("breakfast", "شوفان")] }),
      ],
      0,
    );
    expect(dishes.map((d) => d.memberId)).toEqual(["mom", "abc"]);
    expect(dishes.every((d) => d.sharerIds === null)).toBe(true);
  });

  it("orders by the time of day across the household, then roster order", () => {
    const pot = ["mom", "abc"];
    const dishes = householdDayDishes(
      [
        member("mom", {
          // Emitted out of order on purpose; the snack comes before this
          // member's lunch, so it is a morning snack.
          1: [
            meal("snack", "تمر"),
            meal("dinner", "شوربة"),
            shared("lunch", "مرقوق", pot),
            meal("breakfast", "بيض"),
          ],
        }),
        member("abc", {
          1: [
            meal("breakfast", "لبنة"),
            shared("lunch", "مرقوق", pot),
            meal("snack", "مكسرات"), // after lunch: an evening snack
            meal("dinner", "سلطة"),
          ],
        }),
      ],
      1,
    );
    expect(names(dishes)).toEqual([
      "بيض",
      "لبنة",
      "تمر",
      "مرقوق",
      "مكسرات",
      "شوربة",
      "سلطة",
    ]);
  });

  it("does not merge two different shared pots in the same slot", () => {
    const dishes = householdDayDishes(
      [
        member("mom", { 3: [shared("dinner", "سمك", ["mom", "abc"])] }),
        member("abc", { 3: [shared("dinner", "سمك", ["mom", "abc"])] }),
        member("kid", { 3: [shared("dinner", "دجاج", ["kid", "teen"])] }),
        member("teen", { 3: [shared("dinner", "دجاج", ["kid", "teen"])] }),
      ],
      3,
    );
    expect(names(dishes)).toEqual(["سمك", "دجاج"]);
    expect(dishes.map((d) => d.memberId)).toEqual(["mom", "kid"]);
  });

  it("is empty for a day nobody has meals on, and skips members missing the day", () => {
    const roster = [
      member("mom", { 0: [meal("lunch", "كبسة")], 4: [] }),
      member("abc", { 0: [meal("lunch", "جريش")] }),
    ];
    expect(householdDayDishes(roster, 4)).toEqual([]);
    expect(householdDayDishes(roster, 6)).toEqual([]);
    expect(names(householdDayDishes(roster, 0))).toEqual(["كبسة", "جريش"]);
  });
});
