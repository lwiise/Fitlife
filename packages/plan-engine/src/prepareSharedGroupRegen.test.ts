import { describe, it, expect } from "vitest";

import { prepareMemberJoin, prepareSharedGroupRegen } from "./generate";
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

// ── A newcomer joining a week already under way (owner directive 09/2026) ────
// Four-day week starting 2026-06-06, so "today" 2026-06-07 is day 1.
describe("prepareSharedGroupRegen — mid-week join rebuilds only what is left", () => {
  const WEEK = [0, 1, 2, 3];
  const LUNCH: Meal = { ...MEAL, slot: "lunch", slot_name_ar: "الغداء", recipe_name_ar: "كبسة" };
  // Every day's table: breakfast + lunch.
  const tableDay = (di: number): Day => ({ ...day(di), meals: [MEAL, LUNCH] });
  const weekMember = (member_id: string): MemberPlan => ({
    ...planMember(member_id),
    days: WEEK.map(tableDay),
  });
  const weekPlan = (members: MemberPlan[], extra: Partial<MealPlan> = {}): MealPlan =>
    MealPlanSchema.parse({
      week_start_date: "2026-06-06",
      members,
      days_total: WEEK.length,
      ...extra,
    });
  const mealedDayIndices = (plan: MealPlan, memberId: string) =>
    plan.members
      .find((m) => m.member_id === memberId)!
      .days.filter((d) => d.meals.length > 0)
      .map((d) => d.day_index);
  const joinCtx = () =>
    makeCtx("shared", [
      ctxMember("m-shared", "shared"),
      ctxMember("m-indep", "independent"),
      ctxMember("m-new", "shared"), // the newcomer, not in the plan yet
    ]);
  const today = (checkins: { slot: string; member_id: string | null }[] = []) => ({
    dateISO: "2026-06-07",
    checkins: checkins.map((c) => ({ ...c, local_date: "2026-06-07" })),
    absences: [],
  });

  it("keeps past days AND today for the shared table; clears only the days after today", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared"), weekMember("m-indep")]);

    const { existingPlan } = prepareSharedGroupRegen(joinCtx(), plan, today());

    // Day 0 (past) and day 1 (today) stay exactly as they were…
    for (const id of ["mom", "m-shared"]) {
      expect(mealedDayIndices(existingPlan, id)).toEqual([0, 1]);
      const before = plan.members.find((m) => m.member_id === id)!.days.slice(0, 2);
      const after = existingPlan.members.find((m) => m.member_id === id)!.days.slice(0, 2);
      expect(after).toEqual(before);
    }
    // …the rest of the week is what the group rebuilds, shells kept.
    expect(dayShells(existingPlan, "mom")).toBe(WEEK.length);
    // The independent member is untouched either way.
    expect(mealedDayIndices(existingPlan, "m-indep")).toEqual(WEEK);
  });

  it("stamps where the newcomer's week starts, with today's answered slots closed", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")]);

    const { existingPlan } = prepareSharedGroupRegen(
      joinCtx(),
      plan,
      today([{ slot: "breakfast", member_id: "mom" }]),
    );

    expect(existingPlan.member_joins).toEqual({
      "m-new": { day_index: 1, closed_slots: ["breakfast"] },
    });
    // Nobody else gets a join record.
    expect(existingPlan.member_joins?.mom).toBeUndefined();
  });

  it("a fully answered today means the newcomer starts tomorrow — and today is still kept", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")]);

    const { existingPlan } = prepareSharedGroupRegen(
      joinCtx(),
      plan,
      today([
        { slot: "breakfast", member_id: "m-shared" },
        { slot: "lunch", member_id: "household" },
      ]),
    );

    expect(existingPlan.member_joins?.["m-new"]).toEqual({ day_index: 2 });
    expect(mealedDayIndices(existingPlan, "mom")).toEqual([0, 1]);
  });

  it("keeps join records already on the plan", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")], {
      member_joins: { "m-shared": { day_index: 1 } },
    });

    const { existingPlan } = prepareSharedGroupRegen(joinCtx(), plan, today());

    expect(existingPlan.member_joins?.["m-shared"]).toEqual({ day_index: 1 });
    expect(existingPlan.member_joins?.["m-new"]).toEqual({ day_index: 1 });
  });

  it("a week that is already over clears nothing and records the newcomer for next week", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")]);

    const { existingPlan } = prepareSharedGroupRegen(joinCtx(), plan, {
      dateISO: "2026-06-15",
      checkins: [],
      absences: [],
    });

    expect(mealedDayIndices(existingPlan, "mom")).toEqual(WEEK);
    expect(existingPlan.member_joins?.["m-new"]).toEqual({ day_index: WEEK.length });
  });

  it("joining on the week's first day with nothing answered needs no record — they are a whole-week member", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")]);

    const { existingPlan } = prepareSharedGroupRegen(joinCtx(), plan, {
      dateISO: "2026-06-06",
      checkins: [],
      absences: [],
    });

    expect(existingPlan.member_joins).toBeUndefined();
    // Today's dishes are still kept (the newcomer joins them); the rest rebuilds.
    expect(mealedDayIndices(existingPlan, "mom")).toEqual([0]);
  });

  it("no newcomer (a shared member's regenerate re-merging) keeps the whole-week rebuild", () => {
    const ctx = makeCtx("shared", [ctxMember("m-shared", "shared")]);
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")]);

    const { existingPlan } = prepareSharedGroupRegen(ctx, plan, today());

    expect(mealedDayIndices(existingPlan, "mom")).toEqual([]);
    expect(existingPlan.member_joins).toBeUndefined();
  });

  it("without today's marks it is the whole-week rebuild it always was", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")]);

    const { existingPlan } = prepareSharedGroupRegen(joinCtx(), plan);

    expect(mealedDayIndices(existingPlan, "mom")).toEqual([]);
    expect(existingPlan.member_joins).toBeUndefined();
  });
});

// ── An independent (or queued) newcomer generated on their own ──────────────
// Same four-day week; "today" 2026-06-07 is day 1. The table is breakfast +
// lunch for everyone in the plan.
describe("prepareMemberJoin — one newcomer, planned only from what is left", () => {
  const WEEK = [0, 1, 2, 3];
  const LUNCH: Meal = { ...MEAL, slot: "lunch", slot_name_ar: "الغداء", recipe_name_ar: "كبسة" };
  const tableDay = (di: number): Day => ({ ...day(di), meals: [MEAL, LUNCH] });
  const weekMember = (member_id: string): MemberPlan => ({
    ...planMember(member_id),
    days: WEEK.map(tableDay),
  });
  const plan = () =>
    MealPlanSchema.parse({
      week_start_date: "2026-06-06",
      members: [weekMember("mom"), weekMember("m-shared"), weekMember("m-indep")],
      days_total: WEEK.length,
    });
  const ctx = () =>
    makeCtx("shared", [
      ctxMember("m-shared", "shared"),
      ctxMember("m-indep", "independent"),
      ctxMember("new-indep", "independent"),
      ctxMember("new-shared", "shared"),
    ]);
  const today = (checkins: { slot: string; member_id: string | null }[] = [], dateISO = "2026-06-07") => ({
    dateISO,
    checkins: checkins.map((c) => ({ ...c, local_date: dateISO })),
    absences: [],
  });

  it("records where an independent newcomer's week starts — and touches nobody else", () => {
    const before = plan();
    const after = prepareMemberJoin(ctx(), before, "new-indep", today([{ slot: "breakfast", member_id: "mom" }]));

    expect(after.member_joins).toEqual({
      "new-indep": { day_index: 1, closed_slots: ["breakfast"] },
    });
    expect(after.members).toEqual(before.members);
  });

  it("for an independent newcomer the whole household's mealtimes count — an independent member's mark closes the slot", () => {
    const after = prepareMemberJoin(
      ctx(),
      plan(),
      "new-indep",
      today([{ slot: "lunch", member_id: "m-indep" }]),
    );
    expect(after.member_joins?.["new-indep"]).toEqual({ day_index: 1, closed_slots: ["lunch"] });
  });

  it("a shared newcomer reached one at a time sits at the shared table — a private meal's mark does not close it", () => {
    const after = prepareMemberJoin(
      ctx(),
      plan(),
      "new-shared",
      today([{ slot: "lunch", member_id: "m-indep" }]),
    );
    expect(after.member_joins?.["new-shared"]).toEqual({ day_index: 1 });
  });

  it("a whole day answered means tomorrow; a week already over means next week", () => {
    const done = today([
      { slot: "breakfast", member_id: "household" },
      { slot: "lunch", member_id: "household" },
    ]);
    expect(prepareMemberJoin(ctx(), plan(), "new-indep", done).member_joins?.["new-indep"]).toEqual({
      day_index: 2,
    });
    expect(
      prepareMemberJoin(ctx(), plan(), "new-indep", today([], "2026-06-20")).member_joins?.[
        "new-indep"
      ],
    ).toEqual({ day_index: WEEK.length });
  });

  it("returns the plan unchanged for a refill, the owner, no marks read, or a day-0 join with nothing answered", () => {
    const p = plan();
    expect(prepareMemberJoin(ctx(), p, "m-indep", today())).toBe(p); // already in the plan
    expect(prepareMemberJoin(ctx(), p, "mom", today())).toBe(p);
    expect(prepareMemberJoin(ctx(), p, "new-indep")).toBe(p);
    expect(prepareMemberJoin(ctx(), p, "new-indep", today([], "2026-06-06"))).toBe(p);
  });
});
