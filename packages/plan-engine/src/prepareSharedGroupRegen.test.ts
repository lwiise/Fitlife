import { describe, it, expect } from "vitest";

import { joinMarksNeeded, prepareMemberJoins, prepareSharedGroupRegen } from "./generate";
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
// Four-day week starting 2026-06-06, so "today" 2026-06-07 is day 1. Every
// day's table: breakfast, lunch, dinner.
const WEEK = [0, 1, 2, 3];
const LUNCH: Meal = { ...MEAL, slot: "lunch", slot_name_ar: "الغداء", recipe_name_ar: "كبسة" };
const DINNER: Meal = { ...MEAL, slot: "dinner", slot_name_ar: "العشاء", recipe_name_ar: "شوربة" };
const tableDay = (di: number): Day => ({ ...day(di), meals: [MEAL, LUNCH, DINNER] });
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
const onDay = (
  dateISO: string,
  checkins: { slot: string; member_id: string | null }[] = [],
  absences: { slot: string; member_id: string }[] = [],
) => ({
  dateISO,
  checkins: checkins.map((c) => ({ ...c, local_date: dateISO })),
  absences: absences.map((a) => ({ ...a, local_date: dateISO })),
});
const TODAY = "2026-06-07";

/** The order the worker runs them in: record joins on the plan as read, then clear. */
function sharedRun(
  ctx: PlanPromptContext,
  plan: MealPlan,
  today: ReturnType<typeof onDay> | undefined,
  memberRegenerate = false,
) {
  return prepareSharedGroupRegen(ctx, prepareMemberJoins(ctx, plan, today), {
    todayISO: today?.dateISO,
    memberRegenerate,
  });
}

describe("a shared add rebuilds only what is left of the week", () => {
  const joinCtx = () =>
    makeCtx("shared", [
      ctxMember("m-shared", "shared"),
      ctxMember("m-indep", "independent"),
      ctxMember("m-new", "shared"), // the newcomer, not in the plan yet
    ]);

  it("keeps past days AND today for the shared table; clears only the days after today", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared"), weekMember("m-indep")]);

    const { existingPlan } = sharedRun(joinCtx(), plan, onDay(TODAY));

    for (const id of ["mom", "m-shared"]) {
      expect(mealedDayIndices(existingPlan, id)).toEqual([0, 1]);
      const before = plan.members.find((m) => m.member_id === id)!.days.slice(0, 2);
      const after = existingPlan.members.find((m) => m.member_id === id)!.days.slice(0, 2);
      expect(after).toEqual(before);
    }
    expect(dayShells(existingPlan, "mom")).toBe(WEEK.length);
    expect(mealedDayIndices(existingPlan, "m-indep")).toEqual(WEEK);
  });

  it("records where the newcomer's week starts, with today's answered slots closed", () => {
    const { existingPlan } = sharedRun(
      joinCtx(),
      weekPlan([weekMember("mom"), weekMember("m-shared")]),
      onDay(TODAY, [{ slot: "breakfast", member_id: "mom" }]),
    );
    expect(existingPlan.member_joins?.["m-new"]).toEqual({
      day_index: 1,
      closed_slots: ["breakfast"],
    });
    // Nobody already in the plan gets one.
    expect(existingPlan.member_joins?.mom).toBeUndefined();
    expect(existingPlan.member_joins?.["m-shared"]).toBeUndefined();
  });

  it("a fully answered today means the newcomer starts tomorrow — and today is still kept", () => {
    const { existingPlan } = sharedRun(
      joinCtx(),
      weekPlan([weekMember("mom"), weekMember("m-shared")]),
      onDay(TODAY, [{ slot: "dinner", member_id: "household" }]),
    );
    // Dinner marked: breakfast and lunch are behind the household too.
    expect(existingPlan.member_joins?.["m-new"]).toEqual({ day_index: 2 });
    expect(mealedDayIndices(existingPlan, "mom")).toEqual([0, 1]);
  });

  it("keeps join records already on the plan", () => {
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")], {
      member_joins: { "m-shared": { day_index: 1 } },
    });
    const { existingPlan } = sharedRun(joinCtx(), plan, onDay(TODAY));
    expect(existingPlan.member_joins?.["m-shared"]).toEqual({ day_index: 1 });
    expect(existingPlan.member_joins?.["m-new"]).toEqual({ day_index: 1 });
  });

  it("a week that is already over clears nothing and records the newcomer for next week", () => {
    const { existingPlan } = sharedRun(
      joinCtx(),
      weekPlan([weekMember("mom"), weekMember("m-shared")]),
      onDay("2026-06-15"),
    );
    expect(mealedDayIndices(existingPlan, "mom")).toEqual(WEEK);
    expect(existingPlan.member_joins?.["m-new"]).toEqual({ day_index: WEEK.length });
  });

  it("joining on the week's first day with nothing answered needs no record", () => {
    const { existingPlan } = sharedRun(
      joinCtx(),
      weekPlan([weekMember("mom"), weekMember("m-shared")]),
      onDay("2026-06-06"),
    );
    expect(existingPlan.member_joins).toBeUndefined();
    // Today's dishes are still kept (the newcomer joins them); the rest rebuilds.
    expect(mealedDayIndices(existingPlan, "mom")).toEqual([0]);
  });

  it("a member's REGENERATE rebuilds the whole week even while another shared member is pending", () => {
    // The review's case: dad's allergy edit must reach tonight's dinner, even
    // though m-new (added while a run was busy) is not in the plan yet.
    const { existingPlan } = sharedRun(
      joinCtx(),
      weekPlan([weekMember("mom"), weekMember("m-shared")]),
      onDay(TODAY, [{ slot: "breakfast", member_id: "mom" }]),
      true,
    );
    expect(mealedDayIndices(existingPlan, "mom")).toEqual([]);
    expect(mealedDayIndices(existingPlan, "m-shared")).toEqual([]);
    // …and the pending member it pulls in still joins only what is left.
    expect(existingPlan.member_joins?.["m-new"]).toEqual({
      day_index: 1,
      closed_slots: ["breakfast"],
    });
  });

  it("no newcomer, or no date, is the whole-week rebuild it always was", () => {
    const ctx = makeCtx("shared", [ctxMember("m-shared", "shared")]);
    const plan = weekPlan([weekMember("mom"), weekMember("m-shared")]);
    expect(mealedDayIndices(sharedRun(ctx, plan, onDay(TODAY)).existingPlan, "mom")).toEqual([]);
    expect(mealedDayIndices(sharedRun(joinCtx(), plan, undefined).existingPlan, "mom")).toEqual(
      [],
    );
  });
});

describe("prepareMemberJoins — every newcomer, whatever run brings them in", () => {
  const plan = () => weekPlan([weekMember("mom"), weekMember("m-shared"), weekMember("m-indep")]);
  const ctx = (newcomers: [string, "shared" | "independent"][] = []) =>
    makeCtx("shared", [
      ctxMember("m-shared", "shared"),
      ctxMember("m-indep", "independent"),
      ...newcomers.map(([id, mode]) => ctxMember(id, mode)),
    ]);

  it("records an independent newcomer's start and touches nobody else", () => {
    const before = plan();
    const after = prepareMemberJoins(
      ctx([["new-indep", "independent"]]),
      before,
      onDay(TODAY, [{ slot: "breakfast", member_id: "mom" }]),
    );
    expect(after.member_joins).toEqual({
      "new-indep": { day_index: 1, closed_slots: ["breakfast"] },
    });
    expect(after.members).toEqual(before.members);
  });

  it("an independent newcomer sits at the whole household's mealtimes — an independent member's mark counts", () => {
    const after = prepareMemberJoins(
      ctx([["new-indep", "independent"]]),
      plan(),
      onDay(TODAY, [{ slot: "breakfast", member_id: "m-indep" }]),
    );
    expect(after.member_joins?.["new-indep"]).toEqual({
      day_index: 1,
      closed_slots: ["breakfast"],
    });
  });

  it("a shared newcomer sits at the shared table — a private meal's mark does not close it", () => {
    const after = prepareMemberJoins(
      ctx([["new-shared", "shared"]]),
      plan(),
      onDay(TODAY, [{ slot: "breakfast", member_id: "m-indep" }]),
    );
    expect(after.member_joins?.["new-shared"]).toEqual({ day_index: 1 });
  });

  it("a marked lunch closes the breakfast nobody marked — it was eaten hours ago", () => {
    const after = prepareMemberJoins(
      ctx([["new-shared", "shared"]]),
      plan(),
      onDay(TODAY, [{ slot: "lunch", member_id: "m-shared" }]),
    );
    expect(after.member_joins?.["new-shared"]).toEqual({
      day_index: 1,
      closed_slots: ["breakfast", "lunch"],
    });
  });

  it("an absentee's personal mark says nothing about the meal", () => {
    const after = prepareMemberJoins(
      ctx([["new-shared", "shared"]]),
      plan(),
      onDay(TODAY, [{ slot: "lunch", member_id: "m-shared" }], [{ slot: "lunch", member_id: "m-shared" }]),
    );
    expect(after.member_joins?.["new-shared"]).toEqual({ day_index: 1 });
  });

  it("leaves the plan as it is with no marks read, for people already in it, or for a day-0 join with nothing answered", () => {
    const p = plan();
    expect(prepareMemberJoins(ctx([["new-indep", "independent"]]), p, undefined)).toBe(p);
    expect(prepareMemberJoins(ctx(), p, onDay(TODAY))).toBe(p);
    expect(prepareMemberJoins(ctx([["new-indep", "independent"]]), p, onDay("2026-06-06"))).toBe(p);
  });

  it("a refill of a joiner's still-empty first day adds what was answered since they joined", () => {
    const joiner = { ...weekMember("new-indep"), days: WEEK.map((di) => (di < 2 ? { ...day(di), meals: [] } : tableDay(di))) };
    const p = weekPlan([weekMember("mom"), weekMember("m-shared"), joiner], {
      member_joins: { "new-indep": { day_index: 1, closed_slots: ["breakfast"] } },
    });
    // Lunch was cooked after they joined; their day 1 never landed.
    const after = prepareMemberJoins(
      ctx([["new-indep", "independent"]]),
      p,
      onDay(TODAY, [{ slot: "lunch", member_id: "mom" }]),
    );
    expect(after.member_joins?.["new-indep"]).toEqual({
      day_index: 1,
      closed_slots: ["breakfast", "lunch"],
    });
    // Once dinner is answered too, nothing of today is left for them.
    const later = prepareMemberJoins(
      ctx([["new-indep", "independent"]]),
      p,
      onDay(TODAY, [{ slot: "dinner", member_id: "household" }]),
    );
    expect(later.member_joins?.["new-indep"]).toEqual({ day_index: 2 });
  });

  it("a joiner whose first day already landed is left alone", () => {
    const joiner = { ...weekMember("new-indep"), days: WEEK.map((di) => (di < 1 ? { ...day(di), meals: [] } : tableDay(di))) };
    const p = weekPlan([weekMember("mom"), weekMember("m-shared"), joiner], {
      member_joins: { "new-indep": { day_index: 1, closed_slots: ["breakfast"] } },
    });
    const after = prepareMemberJoins(
      ctx([["new-indep", "independent"]]),
      p,
      onDay(TODAY, [{ slot: "lunch", member_id: "mom" }]),
    );
    expect(after.member_joins?.["new-indep"]).toEqual({ day_index: 1, closed_slots: ["breakfast"] });
  });
});

describe("joinMarksNeeded — today's marks are read only when a join is being decided", () => {
  const ctx = (extra: [string, "shared" | "independent"][] = []) =>
    makeCtx("shared", [
      ctxMember("m-shared", "shared"),
      ...extra.map(([id, mode]) => ctxMember(id, mode)),
    ]);

  it("yes for a newcomer, no for a plan everyone is already in", () => {
    const p = weekPlan([weekMember("mom"), weekMember("m-shared")]);
    expect(joinMarksNeeded(ctx([["m-new", "independent"]]), p, TODAY)).toBe(true);
    expect(joinMarksNeeded(ctx(), p, TODAY)).toBe(false);
  });

  it("yes for a joiner whose first day is today and still empty — no once it has landed or passed", () => {
    const empty = { ...weekMember("m-shared"), days: WEEK.map((di) => (di < 2 ? { ...day(di), meals: [] } : tableDay(di))) };
    const p = weekPlan([weekMember("mom"), empty], {
      member_joins: { "m-shared": { day_index: 1 } },
    });
    expect(joinMarksNeeded(ctx(), p, TODAY)).toBe(true);
    expect(joinMarksNeeded(ctx(), p, "2026-06-08")).toBe(false);
    const landed = weekPlan([weekMember("mom"), weekMember("m-shared")], {
      member_joins: { "m-shared": { day_index: 1 } },
    });
    expect(joinMarksNeeded(ctx(), landed, TODAY)).toBe(false);
  });
});
