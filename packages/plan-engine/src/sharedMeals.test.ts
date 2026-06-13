import { describe, it, expect } from "vitest";
import { resyncSharedMeals, normalizeDishKey } from "./generate";
import type { Meal, Ingredient } from "./schema";

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

/** Every member freshly generated — the initial-plan / full-family case. */
const allFresh = (members: { member_id: string; meals: Meal[] }[]) =>
  members.map((m) => ({ ...m, fresh: true }));

const mealOf = (out: Map<string, Meal[]>, id: string, slot: Meal["slot"]) =>
  out.get(id)!.find((m) => m.slot === slot)!;

// 3 members share lunch "كبسة دجاج" (different portions); mom + dad share breakfast;
// the child has a different breakfast (own dish) → not shared.
function familyDay(): { member_id: string; meals: Meal[] }[] {
  return [
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
  ];
}

describe("resyncSharedMeals — fresh family (initial plan)", () => {
  it("merges a 3-way shared lunch into one batch recipe with a correct split", () => {
    const out = resyncSharedMeals(allFresh(familyDay()));
    for (const id of ["mom", "dad", "child-1"]) {
      const m = mealOf(out, id, "lunch");
      expect(m.shared_recipe).toBe(true);
      const chicken = m.ingredients.find((i) => i.name_ar === "دجاج")!;
      const rice = m.ingredients.find((i) => i.name_ar === "أرز")!;
      expect(chicken.amount).toBe(80 + 120 + 60); // 260g total
      expect(rice.amount).toBe(120 + 180 + 90); // 390g total
      expect(m.batch_finished_weight_g).toBe(260 + 390); // 650g
      expect(m.per_member_portions).toHaveLength(3);
    }
  });

  it("derives per-member grams + percentages from each portion's weight", () => {
    const out = resyncSharedMeals(allFresh(familyDay()));
    const portions = mealOf(out, "mom", "lunch").per_member_portions!;
    const byId = Object.fromEntries(portions.map((p) => [p.member_id, p]));
    expect(byId["mom"]!.portion_grams).toBe(200); // 80 + 120
    expect(byId["dad"]!.portion_grams).toBe(300); // 120 + 180
    expect(byId["child-1"]!.portion_grams).toBe(150); // 60 + 90
    expect(byId["mom"]!.portion_percentage).toBe(31); // round(200/650)
    expect(byId["dad"]!.portion_percentage).toBe(46); // round(300/650)
    expect(byId["child-1"]!.portion_percentage).toBe(23); // round(150/650)
  });

  it("keeps each member's own calories/macros on the shared meal", () => {
    const out = resyncSharedMeals(allFresh(familyDay()));
    expect(mealOf(out, "mom", "lunch").calories).toBe(500);
    expect(mealOf(out, "dad", "lunch").calories).toBe(720);
    expect(mealOf(out, "child-1", "lunch").calories).toBe(380);
  });

  it("retains each member's OWN single portion in own_portion (for later re-sync)", () => {
    const out = resyncSharedMeals(allFresh(familyDay()));
    const momLunch = mealOf(out, "mom", "lunch");
    expect(momLunch.own_portion?.recipe_name_ar).toBe("كبسة دجاج");
    const own = momLunch.own_portion!.ingredients;
    expect(own.find((i) => i.name_ar === "دجاج")!.amount).toBe(80);
    expect(own.find((i) => i.name_ar === "أرز")!.amount).toBe(120);
    // top-level ingredients are the BATCH, own_portion is the single portion
    expect(momLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(260);
  });

  it("does NOT share a meal only one member eats (different dish name)", () => {
    const out = resyncSharedMeals(allFresh(familyDay()));
    const childBreakfast = mealOf(out, "child-1", "breakfast");
    expect(childBreakfast.shared_recipe).toBeFalsy();
    expect(childBreakfast.per_member_portions).toBeUndefined();
    const momBreakfast = mealOf(out, "mom", "breakfast");
    expect(momBreakfast.shared_recipe).toBe(true);
    expect(momBreakfast.per_member_portions).toHaveLength(2);
  });

  it("clears any model-provided shared fields on a solo dish", () => {
    const members = allFresh(familyDay());
    // Simulate the model wrongly stamping shared fields on the child's solo breakfast.
    const childBreakfast = members
      .find((m) => m.member_id === "child-1")!
      .meals.find((m) => m.slot === "breakfast")!;
    childBreakfast.shared_recipe = true;
    childBreakfast.batch_finished_weight_g = 9999;
    childBreakfast.per_member_portions = [{ member_id: "child-1", portion_grams: 9999 }];

    const out = resyncSharedMeals(members);
    const result = mealOf(out, "child-1", "breakfast");
    expect(result.shared_recipe).toBeFalsy();
    expect(result.batch_finished_weight_g).toBeUndefined();
    expect(result.per_member_portions).toBeUndefined();
  });
});

// Cosmetic Arabic variants the model emits for the SAME dish, built from code points
// so the invisible/combining chars survive the source round-trip deterministically.
const TATWEEL = String.fromCodePoint(0x0640); // ـ
const FATHATAN = String.fromCodePoint(0x064b); // tanwin fath ◌ً
const ZWSP = String.fromCodePoint(0x200b); // zero-width space
const BASE_LUNCH = "كبسة دجاج";

describe("normalizeDishKey", () => {
  const k = normalizeDishKey;
  it("strips a single leading definite article", () => {
    expect(k("ال" + BASE_LUNCH)).toBe(k(BASE_LUNCH));
  });
  it("strips tatweel (Lm)", () => {
    expect(k("كب" + TATWEEL + "سة دجاج")).toBe(k(BASE_LUNCH));
  });
  it("strips harakat / tanwin (Mn)", () => {
    expect(k("كبسة" + FATHATAN + " دجاج")).toBe(k(BASE_LUNCH));
  });
  it("strips zero-width / bidi marks (Cf)", () => {
    expect(k("كبسة" + ZWSP + " دجاج")).toBe(k(BASE_LUNCH));
  });
  it("folds ta-marbuta to ha", () => {
    expect(k("كبسه دجاج")).toBe(k(BASE_LUNCH));
  });
  it("folds alef-hamza to bare alef and collapses whitespace", () => {
    expect(k("  أرز   بالخلطة ")).toBe(k("ارز بالخلطة"));
  });
  it("does NOT collapse genuinely different dishes", () => {
    expect(k(BASE_LUNCH)).not.toBe(k("مندي لحم"));
  });
  it("does NOT strip Arabic-Indic digits (distinct dishes stay distinct)", () => {
    expect(k("عصير ١")).not.toBe(k("عصير ٢"));
  });
});

// A lunch-only family fixture whose per-member dish names are parameterizable, so we
// can simulate the model emitting cosmetically different names for the same dish.
function sharedLunchFresh(names: { mom: string; dad: string; child: string }) {
  const m = (id: string, lunch: string, chicken: number, rice: number, cal: number) => ({
    member_id: id,
    meals: [meal("lunch", lunch, [ing("دجاج", chicken), ing("أرز", rice)], cal)],
  });
  return allFresh([
    m("mom", names.mom, 80, 120, 500),
    m("dad", names.dad, 120, 180, 720),
    m("child-1", names.child, 60, 90, 380),
  ]);
}

describe("resyncSharedMeals — cosmetic name variants", () => {
  it("merges members whose dish names differ only cosmetically", () => {
    const out = resyncSharedMeals(
      sharedLunchFresh({
        mom: BASE_LUNCH,
        dad: "ال" + BASE_LUNCH, // leading definite article
        child: "كب" + TATWEEL + "سة دجاج", // tatweel inside the word
      }),
    );
    for (const id of ["mom", "dad", "child-1"]) {
      const m = mealOf(out, id, "lunch");
      expect(m.shared_recipe).toBe(true);
      expect(m.per_member_portions).toHaveLength(3);
    }
    const chicken = mealOf(out, "mom", "lunch").ingredients.find((i) => i.name_ar === "دجاج")!;
    expect(chicken.amount).toBe(80 + 120 + 60); // 260g total
    expect(mealOf(out, "mom", "lunch").batch_finished_weight_g).toBe(260 + 390); // 650g
  });

  it("displays an original Arabic name, never the normalized grouping key", () => {
    const variants = {
      mom: BASE_LUNCH,
      dad: "ال" + BASE_LUNCH,
      child: "كب" + TATWEEL + "سة دجاج",
    };
    const out = resyncSharedMeals(sharedLunchFresh(variants));
    const name = mealOf(out, "mom", "lunch").recipe_name_ar;
    expect(Object.values(variants)).toContain(name);
    expect(name).not.toBe(normalizeDishKey(BASE_LUNCH));
  });

  it("does NOT merge two genuinely different dishes", () => {
    const out = resyncSharedMeals(
      sharedLunchFresh({ mom: BASE_LUNCH, dad: "مندي لحم", child: BASE_LUNCH }),
    );
    expect(mealOf(out, "dad", "lunch").shared_recipe).toBeFalsy();
    expect(mealOf(out, "dad", "lunch").per_member_portions).toBeUndefined();
    expect(mealOf(out, "mom", "lunch").shared_recipe).toBe(true);
    expect(mealOf(out, "mom", "lunch").per_member_portions).toHaveLength(2);
  });
});

describe("resyncSharedMeals — editing one member re-syncs the others", () => {
  it("recomputes the shared batch + split to include the edited member's new portion (Issue 3)", () => {
    const initial = resyncSharedMeals(allFresh(familyDay())); // mom+dad+child share lunch
    // Carry mom + child verbatim; regenerate ONLY dad with a bigger portion.
    const dadNew = {
      member_id: "dad",
      fresh: true,
      meals: [
        meal("breakfast", "بيض باللبنة", [ing("بيض", 4, "piece"), ing("لبنة", 90)], 460),
        meal("lunch", "كبسة دجاج", [ing("دجاج", 150), ing("أرز", 220)], 880),
      ],
    };
    const out = resyncSharedMeals([
      { member_id: "mom", fresh: false, meals: initial.get("mom")! },
      { member_id: "child-1", fresh: false, meals: initial.get("child-1")! },
      dadNew,
    ]);

    // Dad's new portion is in the batch; the co-members' batch updates to match.
    const momLunch = mealOf(out, "mom", "lunch");
    expect(momLunch.shared_recipe).toBe(true);
    expect(momLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(80 + 60 + 150); // 290
    expect(momLunch.ingredients.find((i) => i.name_ar === "أرز")!.amount).toBe(120 + 90 + 220); // 430
    expect(momLunch.batch_finished_weight_g).toBe(290 + 430); // 720
    const byId = Object.fromEntries(
      momLunch.per_member_portions!.map((p) => [p.member_id, p]),
    );
    expect(byId["dad"]!.portion_grams).toBe(370); // 150 + 220, dad's NEW portion

    // The co-members' OWN dishes + calories are untouched — only the batch view moved.
    expect(momLunch.calories).toBe(500);
    expect(momLunch.own_portion!.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(80);
    expect(mealOf(out, "child-1", "lunch").calories).toBe(380);
  });

  it("breaks a member out to an individual meal when their dish diverges (Issue 1)", () => {
    const initial = resyncSharedMeals(
      allFresh([
        { member_id: "mom", meals: [meal("lunch", "كبسة دجاج", [ing("دجاج", 80), ing("أرز", 120)], 500)] },
        { member_id: "child-1", meals: [meal("lunch", "كبسة دجاج", [ing("دجاج", 60), ing("أرز", 90)], 380)] },
      ]),
    );
    const out = resyncSharedMeals([
      { member_id: "mom", fresh: false, meals: initial.get("mom")! },
      {
        member_id: "child-1",
        fresh: true,
        meals: [meal("lunch", "سمك مشوي", [ing("سمك", 150)], 300)],
      },
    ]);
    const childLunch = mealOf(out, "child-1", "lunch");
    expect(childLunch.recipe_name_ar).toBe("سمك مشوي");
    expect(childLunch.shared_recipe).toBeFalsy();
    expect(childLunch.per_member_portions).toBeUndefined();

    // mom is now alone on كبسة دجاج → dissolves back to her OWN single portion.
    const momLunch = mealOf(out, "mom", "lunch");
    expect(momLunch.shared_recipe).toBeFalsy();
    expect(momLunch.per_member_portions).toBeUndefined();
    expect(momLunch.recipe_name_ar).toBe("كبسة دجاج");
    expect(momLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(80); // her own portion, not a batch
    expect(momLunch.own_portion).toBeUndefined();
  });

  it("drops a departed member from a 3-way batch, keeping the remaining two shared", () => {
    const initial = resyncSharedMeals(allFresh(familyDay())); // mom+dad+child share lunch
    const out = resyncSharedMeals([
      { member_id: "mom", fresh: false, meals: initial.get("mom")! },
      { member_id: "dad", fresh: false, meals: initial.get("dad")! },
      {
        member_id: "child-1",
        fresh: true,
        meals: [meal("lunch", "سمك مشوي", [ing("سمك", 120)], 280)],
      },
    ]);
    const momLunch = mealOf(out, "mom", "lunch");
    expect(momLunch.shared_recipe).toBe(true);
    const ids = momLunch.per_member_portions!.map((p) => p.member_id).sort();
    expect(ids).toEqual(["dad", "mom"]); // child dropped
    expect(momLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(80 + 120); // 200, no child
    expect(mealOf(out, "child-1", "lunch").shared_recipe).toBeFalsy();
  });

  it("leaves a carried member untouched (same reference) when the edit doesn't reach them", () => {
    const initial = resyncSharedMeals(allFresh(familyDay()));
    const momMeals = initial.get("mom")!;
    const out = resyncSharedMeals([
      { member_id: "mom", fresh: false, meals: momMeals },
      // Edit the child onto its OWN unrelated dish that no one else eats.
      {
        member_id: "child-1",
        fresh: true,
        meals: [meal("lunch", "عدس", [ing("عدس", 90)], 250)],
      },
    ]);
    // The child's new dish reaches no one; mom's breakfast here (dad absent → solo)
    // is returned by reference — byte-identical carry-over.
    const momBreakfast = out.get("mom")!.find((m) => m.slot === "breakfast")!;
    expect(momBreakfast).toBe(momMeals.find((m) => m.slot === "breakfast"));
  });

  it("re-syncs a legacy shared meal that lacks own_portion (scaling fallback)", () => {
    // Simulate a plan generated before own_portion existed: a shared batch with a
    // per-member split but no stored single portions.
    const legacyMom: Meal = {
      slot: "lunch",
      slot_name_ar: "lunch",
      recipe_name_ar: "كبسة دجاج",
      ingredients: [ing("دجاج", 200), ing("أرز", 300)], // batch of mom (40%) + dad (60%)
      prep_steps_ar: ["جهّزي الكبسة"],
      calories: 500,
      macros: { protein_g: 30, carbs_g: 40, fat_g: 10 },
      shared_recipe: true,
      batch_finished_weight_g: 500,
      per_member_portions: [
        { member_id: "mom", portion_grams: 200, portion_percentage: 40 },
        { member_id: "dad", portion_grams: 300, portion_percentage: 60 },
      ],
    };
    const out = resyncSharedMeals([
      { member_id: "mom", fresh: false, meals: [legacyMom] },
      {
        member_id: "dad",
        fresh: true,
        meals: [meal("lunch", "كبسة دجاج", [ing("دجاج", 120), ing("أرز", 180)], 720)],
      },
    ]);
    const momLunch = mealOf(out, "mom", "lunch");
    expect(momLunch.shared_recipe).toBe(true);
    expect(momLunch.per_member_portions).toHaveLength(2);
    // mom's portion is reconstructed by scaling the old batch by her 40% share.
    expect(momLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(80 + 120); // 80 = 200*0.4
    // and own_portion is now stored, so the NEXT edit is exact (self-heals).
    expect(momLunch.own_portion).toBeDefined();
  });
});

describe("resyncSharedMeals — shared slot label", () => {
  it("unifies slot_name_ar across the shared group (canonical = largest portion)", () => {
    const snack = (id: string, slotName: string, eggs: number, cal: number) => ({
      member_id: id,
      fresh: true,
      meals: [
        {
          slot: "snack" as const,
          slot_name_ar: slotName,
          recipe_name_ar: "بيض مسلوق",
          ingredients: [ing("بيض", eggs)],
          prep_steps_ar: ["اسلقي البيض"],
          calories: cal,
          macros: { protein_g: 10, carbs_g: 5, fat_g: 5 },
        },
      ],
    });
    // The model emitted DIFFERENT slot labels for the same shared snack; dad has the
    // larger portion → his label is canonical and applies to both.
    const out = resyncSharedMeals([
      snack("mom", "سناك الصباح", 60, 100),
      snack("dad", "سناك المساء", 120, 200),
    ]);
    const momSnack = out.get("mom")![0]!;
    const dadSnack = out.get("dad")![0]!;
    expect(momSnack.shared_recipe).toBe(true);
    expect(dadSnack.shared_recipe).toBe(true);
    expect(momSnack.slot_name_ar).toBe(dadSnack.slot_name_ar); // unified
    expect(momSnack.slot_name_ar).toBe("سناك المساء"); // canonical = larger portion (dad)
  });
});
