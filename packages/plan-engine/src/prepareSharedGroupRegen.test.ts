import { describe, it, expect } from "vitest";

import { prepareSharedGroupRegen } from "./generate";
import type { PlanPromptContext, PlanPromptContextMember } from "./buildContext";
import type { MealPlan, MemberPlan, Meal, Day } from "./schema";
import { MealPlanSchema } from "./schema";

// ── Fixtures (mirror generate.test.ts) ───────────────────────────────────────
const MEAL: Meal = {
  slot: "breakfast",
  slot_name_ar: "الفطور",
  recipe_name_ar: "بيض",
  ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
  prep_steps_ar: ["اخفقي البيض"],
  calories: 300,
  macros: { protein_g: 20, carbs_g: 10, fat_g: 15 },
};

const day = (di: number): Day => ({
  day_index: di,
  day_name_ar: `اليوم ${di + 1}`,
  meals: [MEAL],
  day_total: { calories: 300, protein_g: 20, carbs_g: 10, fat_g: 15 },
});

/** A plan member complete for days 0 + 1. */
const planMember = (member_id: string): MemberPlan => ({
  member_id,
  member_name_ar: member_id,
  primary_goal: "fat_loss",
  daily_calories_target: 1800,
  macros_target: { protein_g: 120, carbs_g: 150, fat_g: 60 },
  days: [day(0), day(1)],
});

const makePlan = (members: MemberPlan[]): MealPlan =>
  MealPlanSchema.parse({
    week_start_date: "2026-06-06",
    members,
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    days_total: 2,
  });

const ctxMember = (
  id: string,
  meal_mode: "shared" | "independent",
  role = "daughter",
): PlanPromptContextMember => ({
  id,
  name: id,
  role,
  member_type: "child",
  sex: "female",
  age: 10,
  height_cm: 140,
  weight_kg: 35,
  activity_level: "moderate",
  primary_goal: null,
  dietary_restrictions: [],
  medical_conditions: [],
  allergies: [],
  dislikes: [],
  trimester: null,
  months_postpartum: null,
  high_risk_pregnancy: false,
  school_meal_handling: null,
  picky_eater: false,
  consulted_doctor: false,
  is_child: true,
  preferred_language: "ar",
  meal_mode,
  target_weight_kg: null,
  day_nature: null,
  exercise_days: null,
  exercise_type: null,
  water_cups: null,
  water_liters: null,
  sleep_hours: null,
  medications: [],
  supplements: [],
  nausea_foods: [],
  feeding_mode: null,
});

const makeCtx = (
  momMode: "shared" | "independent",
  family_members: PlanPromptContextMember[],
): PlanPromptContext => ({
  mom: {
    id: "user-1",
    display_name: "أم محمد",
    sex: "female",
    member_type: "adult",
    age: 35,
    height_cm: 165,
    weight_kg: 70,
    activity_level: "moderate",
    primary_goal: "fat_loss",
    dietary_restrictions: [],
    cuisine_preference: "khaleeji",
    medical_conditions: [],
    allergies: [],
    dislikes: [],
    is_pregnant: false,
    pregnancy_trimester: null,
    months_postpartum: null,
    high_risk_pregnancy: false,
    consulted_doctor: false,
    meal_mode: momMode,
    target_weight_kg: null,
    day_nature: null,
    exercise_days: null,
    exercise_type: null,
    water_cups: null,
    water_liters: null,
    sleep_hours: null,
    medications: [],
    supplements: [],
    nausea_foods: [],
    notes: null,
  },
  family_members,
  family_wide: {
    dietary_restrictions: [],
    dislikes: [],
    cooking_methods: [],
    meal_out_frequency: null,
  },
  composition_summary: "عائلة",
});

// Days that still carry meals — a "cleared" shared member drops to 0.
const mealedDays = (plan: MealPlan, memberId: string) =>
  plan.members
    .find((m) => m.member_id === memberId)
    ?.days.filter((d) => d.meals.length > 0).length ?? -1;

// Total day shells — preserved even when meals are cleared, so the week grid (and
// the in-place day-by-day loading UI) survives.
const dayShells = (plan: MealPlan, memberId: string) =>
  plan.members.find((m) => m.member_id === memberId)?.days.length ?? -1;

// ── Tests ────────────────────────────────────────────────────────────────────
describe("prepareSharedGroupRegen", () => {
  it("clears shared members' days (mom + shared member), leaves independent members intact", () => {
    const ctx = makeCtx("shared", [
      ctxMember("m-shared", "shared"),
      ctxMember("m-indep", "independent"),
    ]);
    const plan = makePlan([
      planMember("mom"),
      planMember("m-shared"),
      planMember("m-indep"),
    ]);

    const { existingPlan, familyMembers } = prepareSharedGroupRegen(ctx, plan);

    // Shared beneficiaries are emptied so the engine regenerates them together...
    expect(mealedDays(existingPlan, "mom")).toBe(0);
    expect(mealedDays(existingPlan, "m-shared")).toBe(0);
    // ...but their day shells survive (week grid intact → in-place streaming).
    expect(dayShells(existingPlan, "mom")).toBe(2);
    expect(dayShells(existingPlan, "m-shared")).toBe(2);
    // The independent member is carried verbatim.
    expect(mealedDays(existingPlan, "m-indep")).toBe(2);

    // Both in-plan family members stay in the run (shared regenerates, independent
    // is carried).
    expect(familyMembers.map((m) => m.id).sort()).toEqual(["m-indep", "m-shared"]);
  });

  it("keeps a shared newcomer (not yet in plan) but drops a pending independent member", () => {
    const ctx = makeCtx("shared", [
      ctxMember("m-shared", "shared"), // already in plan
      ctxMember("m-newcomer", "shared"), // the just-added shared member, not in plan
      ctxMember("m-pending-indep", "independent"), // pending, not in plan
    ]);
    const plan = makePlan([planMember("mom"), planMember("m-shared")]);

    const { familyMembers } = prepareSharedGroupRegen(ctx, plan);

    const ids = familyMembers.map((m) => m.id);
    expect(ids).toContain("m-shared");
    expect(ids).toContain("m-newcomer"); // shared newcomer joins the group regen
    expect(ids).not.toContain("m-pending-indep"); // generates later, one at a time
  });

  it("always keeps the housekeeper and never treats her as a shared beneficiary", () => {
    const ctx = makeCtx("shared", [
      ctxMember("m-shared", "shared"),
      // Housekeeper flagged 'shared' to prove the role guard (not meal_mode) excludes her.
      ctxMember("hk", "shared", "housekeeper"),
    ]);
    const plan = makePlan([planMember("mom"), planMember("m-shared")]);

    const { familyMembers } = prepareSharedGroupRegen(ctx, plan);

    expect(familyMembers.map((m) => m.id)).toContain("hk");
  });

  it("does NOT clear mom when mom is independent", () => {
    const ctx = makeCtx("independent", [ctxMember("m-shared", "shared")]);
    const plan = makePlan([planMember("mom"), planMember("m-shared")]);

    const { existingPlan } = prepareSharedGroupRegen(ctx, plan);

    // Independent mom is carried verbatim; only the shared member regenerates.
    expect(mealedDays(existingPlan, "mom")).toBe(2);
    expect(mealedDays(existingPlan, "m-shared")).toBe(0);
  });

  it("does not mutate its inputs (pure)", () => {
    const ctx = makeCtx("shared", [ctxMember("m-shared", "shared")]);
    const plan = makePlan([planMember("mom"), planMember("m-shared")]);

    prepareSharedGroupRegen(ctx, plan);

    // Original plan + context untouched.
    expect(mealedDays(plan, "mom")).toBe(2);
    expect(mealedDays(plan, "m-shared")).toBe(2);
    expect(ctx.family_members).toHaveLength(1);
  });
});
