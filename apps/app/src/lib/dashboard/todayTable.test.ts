import { describe, expect, it } from "vitest";
import type { Meal, MemberPlan } from "@fitlife/plan-engine";
import { buildTodayTable } from "./todayTable";

const macros = { protein_g: 10, carbs_g: 10, fat_g: 5 };

function meal(slot: Meal["slot"], name: string, kcal: number, sharers?: string[]): Meal {
  return {
    slot,
    slot_name_ar: slot,
    recipe_name_ar: name,
    ingredients: [],
    prep_steps_ar: [],
    calories: kcal,
    macros,
    ...(sharers
      ? {
          shared_recipe: true,
          per_member_portions: sharers.map((id) => ({ member_id: id })),
        }
      : {}),
  } as Meal;
}

function member(id: string, meals: Meal[], target = 1800): MemberPlan {
  return {
    member_id: id,
    member_name_ar: id,
    daily_calories_target: target,
    macros_target: macros,
    days: [
      {
        day_index: 2,
        day_name_ar: "الثلاثاء",
        meals,
        day_total: {
          calories: meals.reduce((n, m) => n + m.calories, 0),
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        },
      },
    ],
  } as MemberPlan;
}

const SHARED = ["mom", "dad", "kid"];
const household = [
  member("mom", [
    meal("breakfast", "شكشوكة", 350),
    meal("lunch", "كبسة دجاج", 600, SHARED),
    meal("snack", "زبادي", 150),
    meal("dinner", "شوربة عدس", 400, SHARED),
  ]),
  member("dad", [
    meal("breakfast", "فول", 500),
    meal("lunch", "كبسة دجاج", 900, SHARED),
    meal("dinner", "شوربة عدس", 550, SHARED),
  ]),
  member("kid", [
    meal("breakfast", "شوفان", 300),
    meal("lunch", "كبسة دجاج", 400, SHARED),
    meal("dinner", "شوربة عدس", 300, SHARED),
  ]),
];
const roster = ["mom", "dad", "kid"];

describe("buildTodayTable", () => {
  it("folds a shared pot into ONE row carrying every sharer", () => {
    const t = buildTodayTable({
      members: household,
      rosterOrder: roster,
      dayIndex: 2,
      checkins: [],
      absences: [],
    });
    const lunch = t.rows.filter((r) => r.slot === "lunch");
    expect(lunch).toHaveLength(1);
    expect(lunch[0]!.eaterIds).toEqual(["mom", "dad", "kid"]);
    expect(lunch[0]!.writeIds.sort()).toEqual(["dad", "kid", "mom"]);
    // The owner's own portion, not the batch or someone else's.
    expect(lunch[0]!.kcal).toBe(600);
    expect(lunch[0]!.kcalFor).toBe("mom");
    // No stored percentages → equal shares that still add up to 100.
    expect(lunch[0]!.shares.map((x) => x.pct)).toEqual([34, 33, 33]);
    expect(lunch[0]!.shares.reduce((n, x) => n + x.pct, 0)).toBe(100);
  });

  it("splits the pot by stored percentages, renormalised after an absence", () => {
    const withPct = household.map((m) => ({
      ...m,
      days: m.days.map((d) => ({
        ...d,
        meals: d.meals.map((meal) =>
          meal.slot === "lunch"
            ? {
                ...meal,
                per_member_portions: [
                  { member_id: "mom", portion_percentage: 30 },
                  { member_id: "dad", portion_percentage: 50 },
                  { member_id: "kid", portion_percentage: 20 },
                ],
              }
            : meal,
        ),
      })),
    })) as MemberPlan[];
    const t = buildTodayTable({
      members: withPct,
      rosterOrder: roster,
      dayIndex: 2,
      checkins: [],
      absences: [{ day_index: 2, slot: "lunch", member_id: "kid" }],
    });
    const lunch = t.rows.find((r) => r.slot === "lunch")!;
    expect(lunch.shares).toEqual([
      { id: "mom", pct: 38 },
      { id: "dad", pct: 62 },
    ]);
  });

  it("keeps each member's own dish as its own row, in meal order", () => {
    const t = buildTodayTable({
      members: household,
      rosterOrder: roster,
      dayIndex: 2,
      checkins: [],
      absences: [],
    });
    expect(t.rows.map((r) => r.recipeName)).toEqual([
      "شكشوكة",
      "فول",
      "شوفان",
      "كبسة دجاج",
      "زبادي",
      "شوربة عدس",
    ]);
    const ful = t.rows.find((r) => r.recipeName === "فول")!;
    expect(ful.shared).toBe(false);
    expect(ful.writeIds).toEqual(["dad"]);
    expect(ful.kcalFor).toBe("dad");
  });

  it("drops absentees from eaters AND from the write roster", () => {
    const t = buildTodayTable({
      members: household,
      rosterOrder: roster,
      dayIndex: 2,
      checkins: [],
      absences: [{ day_index: 2, slot: "lunch", member_id: "mom" }],
    });
    const lunch = t.rows.find((r) => r.slot === "lunch")!;
    expect(lunch.eaterIds).toEqual(["dad", "kid"]);
    expect(lunch.writeIds).not.toContain("mom");
    // She is not eating it, so the calories shown are the first eater's.
    expect(lunch.kcalFor).toBe("dad");
    expect(lunch.kcal).toBe(900);
  });

  it("reads status like /plan: a sharer's row, else the household fallback", () => {
    const t = buildTodayTable({
      members: household,
      rosterOrder: roster,
      dayIndex: 2,
      checkins: [
        { day_index: 2, slot: "lunch", member_id: "kid", status: "cooked" },
        { day_index: 2, slot: "dinner", member_id: "household", status: "skipped" },
        // Another day never leaks into today.
        { day_index: 1, slot: "breakfast", member_id: "mom", status: "cooked" },
      ],
      absences: [],
    });
    expect(t.rows.find((r) => r.slot === "lunch")!.status).toBe("cooked");
    expect(t.rows.find((r) => r.slot === "dinner")!.status).toBe("skipped");
    expect(t.rows.find((r) => r.recipeName === "شكشوكة")!.status).toBeNull();
    expect(t.marked).toBe(2);
    expect(t.cooked).toBe(1);
    expect(t.nextKey).toBe(t.rows[0]!.key);
  });

  it("an absentee's personal mark never lights the shared dish", () => {
    const t = buildTodayTable({
      members: household,
      rosterOrder: roster,
      dayIndex: 2,
      checkins: [{ day_index: 2, slot: "lunch", member_id: "mom", status: "skipped" }],
      absences: [{ day_index: 2, slot: "lunch", member_id: "mom" }],
    });
    expect(t.rows.find((r) => r.slot === "lunch")!.status).toBeNull();
  });

  it("reports the owner's day against her target, and nothing for a solo minor", () => {
    const t = buildTodayTable({
      members: household,
      rosterOrder: roster,
      dayIndex: 2,
      checkins: [],
      absences: [],
    });
    expect(t.ownerDay).toEqual({ calories: 1500, target: 1800 });
    const minor = buildTodayTable({
      members: [member("mom", [meal("lunch", "x", 500)], 0)],
      rosterOrder: ["mom"],
      dayIndex: 2,
      checkins: [],
      absences: [],
    });
    expect(minor.ownerDay).toBeNull();
  });

  it("is empty for a day the plan does not hold", () => {
    const t = buildTodayTable({
      members: household,
      rosterOrder: roster,
      dayIndex: 5,
      checkins: [],
      absences: [],
    });
    expect(t.rows).toEqual([]);
    expect(t.nextKey).toBeNull();
  });
});
