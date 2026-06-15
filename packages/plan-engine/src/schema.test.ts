import { describe, it, expect } from "vitest";
import {
  IngredientSchema,
  MacrosSchema,
  PerMemberPortionSchema,
  MealSchema,
  DaySchema,
  MemberPlanSchema,
  MealPlanSchema,
  SkeletonMemberSchema,
  planHasContent,
  type MealPlan,
} from "./schema";

// ─── Fixtures / factories ─────────────────────────────────────────────────
// Small builders that return fresh objects each call so individual tests can
// mutate their copy without leaking state. Everything is deep-cloned via JSON
// so factory output is independent and deterministic.

function makeIngredient(): Record<string, unknown> {
  return {
    name_ar: "صدر دجاج",
    amount: 120,
    unit: "g",
  };
}

function makeMacros(): Record<string, unknown> {
  return { protein_g: 35, carbs_g: 40, fat_g: 12 };
}

function makeIndividualMeal(): Record<string, unknown> {
  return {
    slot: "lunch",
    slot_name_ar: "الغداء",
    recipe_name_ar: "دجاج مشوي مع أرز",
    ingredients: [makeIngredient()],
    prep_steps_ar: ["تتبيل الدجاج", "الشوي على نار متوسطة"],
    calories: 520,
    macros: makeMacros(),
  };
}

function makeSharedMeal(): Record<string, unknown> {
  return {
    ...makeIndividualMeal(),
    shared_recipe: true,
    batch_finished_weight_g: 1400,
    per_member_portions: [
      { member_id: "mom", portion_grams: 350, portion_percentage: 25 },
      { member_id: "child-1", portion_grams: 250, portion_percentage: 18 },
    ],
  };
}

function makeDay(meals: Record<string, unknown>[] = [makeIndividualMeal()]): Record<string, unknown> {
  return {
    day_index: 0,
    day_name_ar: "السبت",
    meals,
    day_total: { calories: 1800, protein_g: 120, carbs_g: 150, fat_g: 55 },
  };
}

function makeMember(days: Record<string, unknown>[] = [makeDay()]): Record<string, unknown> {
  return {
    member_id: "mom",
    member_name_ar: "الأم",
    daily_calories_target: 1800,
    macros_target: makeMacros(),
    days,
  };
}

function makeValidPlan(): Record<string, unknown> {
  return {
    week_start_date: "2026-06-07",
    members: [makeMember()],
  };
}

// Typed factory for planHasContent() (needs a parsed/typed MealPlan).
function parsePlan(raw: Record<string, unknown>): MealPlan {
  const r = MealPlanSchema.safeParse(raw);
  if (!r.success) throw new Error("fixture did not parse: " + JSON.stringify(r.error.issues));
  return r.data;
}

// ─── MealPlanSchema ─────────────────────────────────────────────────────────
describe("MealPlanSchema", () => {
  it("parses a full valid plan", () => {
    const res = MealPlanSchema.safeParse(makeValidPlan());
    expect(res.success).toBe(true);
  });

  it("fails when members is empty", () => {
    const plan = makeValidPlan();
    plan.members = [];
    expect(MealPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("fails when members is missing", () => {
    const plan = makeValidPlan();
    delete plan.members;
    expect(MealPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("fails when week_start_date is missing", () => {
    const plan = makeValidPlan();
    delete plan.week_start_date;
    expect(MealPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("accepts optional progressive fields when present", () => {
    const plan = makeValidPlan();
    plan.generating = true;
    plan.days_total = 7;
    plan.generating_member_id = "mom";
    plan.gen_attempts = { mom: 2 };
    plan.hidden_for_member_ids = ["child-1"];
    const res = MealPlanSchema.safeParse(plan);
    expect(res.success).toBe(true);
  });

  it("rejects non-integer days_total", () => {
    const plan = makeValidPlan();
    plan.days_total = 7.5;
    expect(MealPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects non-boolean generating", () => {
    const plan = makeValidPlan();
    plan.generating = "yes";
    expect(MealPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects non-array hidden_for_member_ids", () => {
    const plan = makeValidPlan();
    plan.hidden_for_member_ids = "child-1";
    expect(MealPlanSchema.safeParse(plan).success).toBe(false);
  });
});

// ─── MealSchema ───────────────────────────────────────────────────────────
describe("MealSchema", () => {
  it("parses an individual meal (no shared fields)", () => {
    expect(MealSchema.safeParse(makeIndividualMeal()).success).toBe(true);
  });

  it("parses a shared meal with batch + per-member portions", () => {
    const res = MealSchema.safeParse(makeSharedMeal());
    expect(res.success).toBe(true);
  });

  it("rejects an invalid slot enum value", () => {
    const meal = makeIndividualMeal();
    meal.slot = "brunch";
    expect(MealSchema.safeParse(meal).success).toBe(false);
  });

  it.each(["slot", "recipe_name_ar", "ingredients", "prep_steps_ar", "calories", "macros"])(
    "requires core field %s",
    (field) => {
      const meal = makeIndividualMeal();
      delete meal[field];
      expect(MealSchema.safeParse(meal).success).toBe(false);
    },
  );

  it("rejects empty recipe_name_ar", () => {
    const meal = makeIndividualMeal();
    meal.recipe_name_ar = "";
    expect(MealSchema.safeParse(meal).success).toBe(false);
  });

  it("rejects non-numeric calories", () => {
    const meal = makeIndividualMeal();
    meal.calories = "520";
    expect(MealSchema.safeParse(meal).success).toBe(false);
  });

  it("rejects malformed macros (missing protein_g)", () => {
    const meal = makeIndividualMeal();
    meal.macros = { carbs_g: 40, fat_g: 12 };
    expect(MealSchema.safeParse(meal).success).toBe(false);
  });

  it("accepts optional translation + Sara recipe fields", () => {
    const meal = makeIndividualMeal();
    meal.recipe_name_translated = "Grilled chicken with rice";
    meal.prep_steps_translated = ["Marinate", "Grill"];
    meal.prep_steps_translated_locale = "en";
    meal.prep_time_minutes = 10;
    meal.cook_time_minutes = 25;
    meal.servings_count = 4;
    meal.substitutions_ar = ["يمكن استبدال الأرز بالكينوا"];
    meal.notes_ar = "يحفظ في الثلاجة ليومين";
    expect(MealSchema.safeParse(meal).success).toBe(true);
  });

  it("rejects an invalid translation locale", () => {
    const meal = makeIndividualMeal();
    meal.prep_steps_translated_locale = "fr";
    expect(MealSchema.safeParse(meal).success).toBe(false);
  });
});

// ─── batch_finished_weight_g ────────────────────────────────────────────────
describe("MealSchema.batch_finished_weight_g", () => {
  it("is optional (individual meal omits it)", () => {
    const meal = makeIndividualMeal();
    expect("batch_finished_weight_g" in meal).toBe(false);
    expect(MealSchema.safeParse(meal).success).toBe(true);
  });

  it("accepts a numeric value", () => {
    const meal = makeIndividualMeal();
    meal.batch_finished_weight_g = 1400;
    expect(MealSchema.safeParse(meal).success).toBe(true);
  });

  it("rejects a non-numeric value", () => {
    const meal = makeSharedMeal();
    meal.batch_finished_weight_g = "1400";
    expect(MealSchema.safeParse(meal).success).toBe(false);
  });
});

// ─── PerMemberPortionSchema ─────────────────────────────────────────────────
describe("PerMemberPortionSchema", () => {
  it("requires member_id", () => {
    expect(PerMemberPortionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty member_id", () => {
    expect(PerMemberPortionSchema.safeParse({ member_id: "" }).success).toBe(false);
  });

  it("parses with only member_id (all other fields optional)", () => {
    expect(PerMemberPortionSchema.safeParse({ member_id: "mom" }).success).toBe(true);
  });

  it("parses with all optional fields", () => {
    const res = PerMemberPortionSchema.safeParse({
      member_id: "mom",
      portion_grams: 350,
      portion_percentage: 25,
      ingredients: [makeIngredient()],
      notes_ar: "بدون ملح",
    });
    expect(res.success).toBe(true);
  });

  it("rejects non-numeric portion_grams", () => {
    const res = PerMemberPortionSchema.safeParse({ member_id: "mom", portion_grams: "350" });
    expect(res.success).toBe(false);
  });

  it("rejects non-numeric portion_percentage", () => {
    const res = PerMemberPortionSchema.safeParse({
      member_id: "mom",
      portion_percentage: "25",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a malformed ingredient in the optional add-ons array", () => {
    const res = PerMemberPortionSchema.safeParse({
      member_id: "mom",
      ingredients: [{ name_ar: "زيت زيتون", amount: 10, unit: "oz" }],
    });
    expect(res.success).toBe(false);
  });

  it("rejects non-string notes_ar", () => {
    const res = PerMemberPortionSchema.safeParse({ member_id: "mom", notes_ar: 5 });
    expect(res.success).toBe(false);
  });
});

// ─── IngredientSchema ───────────────────────────────────────────────────────
describe("IngredientSchema", () => {
  it("parses a basic ingredient", () => {
    expect(IngredientSchema.safeParse(makeIngredient()).success).toBe(true);
  });

  it.each(["g", "kg", "ml", "l", "tbsp", "tsp", "cup", "piece", "serving", "unlimited"])(
    "accepts unit %s",
    (unit) => {
      const ing = makeIngredient();
      ing.unit = unit;
      expect(IngredientSchema.safeParse(ing).success).toBe(true);
    },
  );

  it('accepts the "unlimited" unit (Sara\'s سلطة حرة)', () => {
    const ing = { name_ar: "سلطة خضراء", amount: 0, unit: "unlimited" };
    expect(IngredientSchema.safeParse(ing).success).toBe(true);
  });

  it("rejects an unknown unit", () => {
    const ing = makeIngredient();
    ing.unit = "ounce";
    expect(IngredientSchema.safeParse(ing).success).toBe(false);
  });

  it("requires amount to be numeric", () => {
    const ing = makeIngredient();
    ing.amount = "120";
    expect(IngredientSchema.safeParse(ing).success).toBe(false);
  });

  it("requires non-empty name_ar", () => {
    const ing = makeIngredient();
    ing.name_ar = "";
    expect(IngredientSchema.safeParse(ing).success).toBe(false);
  });

  it("accepts optional amount_min / amount_max range", () => {
    const ing = makeIngredient();
    ing.amount = 120;
    ing.amount_min = 100;
    ing.amount_max = 120;
    expect(IngredientSchema.safeParse(ing).success).toBe(true);
  });

  it("rejects non-numeric amount_max", () => {
    const ing = makeIngredient();
    ing.amount_max = "120";
    expect(IngredientSchema.safeParse(ing).success).toBe(false);
  });
});

// ─── planHasContent() ───────────────────────────────────────────────────────
describe("planHasContent()", () => {
  it("returns true when at least one member has a day with meals", () => {
    const plan = parsePlan(makeValidPlan());
    expect(planHasContent(plan)).toBe(true);
  });

  it("returns false when every day has empty meals", () => {
    const plan = parsePlan(makeValidPlan());
    plan.members[0].days[0].meals = [];
    expect(planHasContent(plan)).toBe(false);
  });

  it("returns true if any member (not the first) has content", () => {
    const raw = makeValidPlan() as { members: Record<string, unknown>[] };
    const emptyMember = makeMember([makeDay([])]);
    emptyMember.member_id = "child-1";
    emptyMember.member_name_ar = "طفل";
    const contentMember = makeMember([makeDay([makeIndividualMeal()])]);
    contentMember.member_id = "child-2";
    contentMember.member_name_ar = "طفل آخر";
    raw.members = [emptyMember, contentMember];
    const plan = parsePlan(raw);
    expect(planHasContent(plan)).toBe(true);
  });

  it("returns false when a member has days but all are empty", () => {
    const raw = makeValidPlan() as { members: Record<string, unknown>[] };
    raw.members = [makeMember([makeDay([]), makeDay([])])];
    const plan = parsePlan(raw);
    expect(planHasContent(plan)).toBe(false);
  });
});

// ─── sanity: shared sub-schemas used above still parse standalone ───────────
describe("supporting schemas", () => {
  it("MacrosSchema parses", () => {
    expect(MacrosSchema.safeParse(makeMacros()).success).toBe(true);
  });

  it("DaySchema parses", () => {
    expect(DaySchema.safeParse(makeDay()).success).toBe(true);
  });

  it("MemberPlanSchema requires at least one day", () => {
    const member = makeMember([]);
    expect(MemberPlanSchema.safeParse(member).success).toBe(false);
  });

  it("MemberPlanSchema rejects more than 7 days", () => {
    const member = makeMember(Array.from({ length: 8 }, (_, i) => {
      const d = makeDay();
      d.day_index = i % 7;
      return d;
    }));
    expect(MemberPlanSchema.safeParse(member).success).toBe(false);
  });
});

// ─── Children have no weight goal ─────────────────────────────────────────────
// A child's primary_goal is null (the model returns explicit null, not just an
// omitted field). .optional() rejects null and failed the whole skeleton for any
// family with a child; .nullish() must accept null, undefined, and a real goal.
describe("primary_goal is nullable (children have no goal)", () => {
  it("MemberPlanSchema accepts primary_goal: null", () => {
    expect(MemberPlanSchema.safeParse({ ...makeMember(), primary_goal: null }).success).toBe(true);
  });

  it("SkeletonMemberSchema accepts primary_goal: null", () => {
    const skeletonMember = {
      member_id: "child-1",
      member_name_ar: "سارة",
      primary_goal: null,
      daily_calories_target: 1400,
      macros_target: makeMacros(),
      days: [{ day_index: 0, day_name_ar: "السبت", meals: [{ slot: "lunch", slot_name_ar: "الغداء", recipe_name_ar: "كبسة دجاج" }] }],
    };
    expect(SkeletonMemberSchema.safeParse(skeletonMember).success).toBe(true);
  });

  it("SkeletonMemberSchema still accepts an omitted goal and a real goal", () => {
    const base = {
      member_id: "mom",
      daily_calories_target: 1800,
      macros_target: makeMacros(),
      days: [{ day_index: 0, day_name_ar: "السبت", meals: [{ slot: "lunch", slot_name_ar: "الغداء", recipe_name_ar: "كبسة دجاج" }] }],
    };
    expect(SkeletonMemberSchema.safeParse(base).success).toBe(true);
    expect(SkeletonMemberSchema.safeParse({ ...base, primary_goal: "fat_loss" }).success).toBe(true);
  });
});
