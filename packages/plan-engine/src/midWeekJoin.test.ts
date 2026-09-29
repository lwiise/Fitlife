import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the model is faked — parsing, the band, shared-meal assembly and the
// carry-over rules are the real ones, which is the point of this suite.
vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import { generateMealPlan, prepareMemberJoins, prepareSharedGroupRegen } from "./generate";
import { incompleteInPlanMemberIds } from "./chain";
import { MEMBER_GEN_MAX_ATTEMPTS } from "./constants";
import type { PlanPromptContext, PlanPromptContextMember } from "./buildContext";
import type { Day, DaySlice, Meal, MealPlan, MemberPlan, PlanSkeleton } from "./schema";
import { DaySliceSchema, MealPlanSchema, PlanSkeletonSchema } from "./schema";
import type { JoinToday } from "./memberJoin";

const mockedStream = vi.mocked(streamAnthropic);

/**
 * A shared-table household — mom and «أبو محمد» — four days into their week
 * when «الجدة» (grandma) is added to the shared meals. Week starts 2026-06-06;
 * "today" is 2026-06-07 (day 1), and mom has already marked today's BREAKFAST.
 *
 * What the owner asked for (09/2026): nothing that already happened changes,
 * and the newcomer is added only to what is left —
 *   day 0 (past)           untouched, no grandma;
 *   day 1 breakfast (done) untouched, no grandma;
 *   day 1 lunch (open)     same dish, grandma now shares it;
 *   days 2-3               rebuilt for the table with grandma in it.
 */
const WEEK = [0, 1, 2, 3];
const WEEK_START = "2026-06-06";
const TODAY = "2026-06-07";

// Atwater-consistent macros for a meal of `kcal` (so the reconciliation guard
// never rewrites the fixtures): protein 25%, fat 25%, carbs the residual.
function macrosFor(kcal: number): Meal["macros"] {
  const protein_g = Math.round((kcal * 0.25) / 4);
  const fat_g = Math.round((kcal * 0.25) / 9);
  return { protein_g, fat_g, carbs_g: Math.round((kcal - protein_g * 4 - fat_g * 9) / 4) };
}

function dish(slot: Meal["slot"], name: string, kcal: number, grams: number): Meal {
  return {
    slot,
    slot_name_ar: slot === "breakfast" ? "الفطور" : "الغداء",
    recipe_name_ar: name,
    ingredients: [{ name_ar: "أرز", amount: grams, unit: "g" }],
    prep_steps_ar: ["اطبخي"],
    calories: kcal,
    macros: macrosFor(kcal),
  };
}

/** The prior plan's day for one member: breakfast 600 + lunch 1200 = their 1800 target. */
function priorDay(di: number): Day {
  const meals = [
    dish("breakfast", `فطور-${di}`, 600, 200),
    dish("lunch", `غداء-${di}`, 1200, 400),
  ];
  return {
    day_index: di,
    day_name_ar: `اليوم ${di + 1}`,
    meals,
    day_total: { calories: 1800, ...{ protein_g: 0, carbs_g: 0, fat_g: 0 } },
  };
}

function priorMember(member_id: string): MemberPlan {
  return {
    member_id,
    member_name_ar: member_id,
    primary_goal: "maintain",
    daily_calories_target: 1800,
    macros_target: { protein_g: 113, carbs_g: 225, fat_g: 50 },
    days: WEEK.map(priorDay),
  };
}

function adult(
  id: string,
  name: string,
  meal_mode: "shared" | "independent" = "shared",
): PlanPromptContextMember {
  return {
    id,
    name,
    role: id === "dad" ? "dad" : "grandparent",
    member_type: "adult",
    sex: id === "dad" ? "male" : "female",
    age: id === "dad" ? 40 : 62,
    height_cm: 165,
    weight_kg: 70,
    activity_level: "light",
    primary_goal: "maintain",
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
    is_child: false,
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
  };
}

function context(members: PlanPromptContextMember[]): PlanPromptContext {
  return {
    mom: {
      id: "user-1",
      display_name: "أم محمد",
      sex: "female",
      member_type: "adult",
      age: 35,
      height_cm: 165,
      weight_kg: 70,
      activity_level: "light",
      primary_goal: "maintain",
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
      meal_mode: "shared",
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
    family_members: members,
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

const priorPlan = (): MealPlan =>
  MealPlanSchema.parse({
    week_start_date: WEEK_START,
    members: [priorMember("mom"), priorMember("dad")],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    days_total: WEEK.length,
  });

const household = () => context([adult("dad", "أبو محمد"), adult("gma", "الجدة")]);

// Mom answered today's breakfast (the shared-meal fan-out wrote her row).
const breakfastDone: JoinToday = {
  dateISO: TODAY,
  checkins: [{ local_date: TODAY, slot: "breakfast", member_id: "mom" }],
  absences: [],
};

/**
 * The fake model. Skeleton prompt → one shared menu for the requested members
 * (breakfast + lunch, 2000 kcal for anyone new). Day prompt → for every member
 * line, one meal per listed dish, sized so the member's stated target is hit
 * exactly (which keeps the band quiet). `strayBreakfastFor` makes the model
 * disobey and add a breakfast the member was not given.
 */
function fakeModel(opts: { strayBreakfastFor?: string; onlyStrayFor?: string } = {}) {
  return async ({ systemPrompt }: { systemPrompt: string }) => {
    const dayMatch = systemPrompt.match(/day_index=(\d+)/);
    let text: string;
    if (!dayMatch) {
      const ids = [...systemPrompt.matchAll(/member_id="([^"]+)"/g)].map((m) => m[1]!);
      const skeleton: PlanSkeleton = {
        members: [...new Set(ids)].map((id) => ({
          member_id: id,
          member_name_ar: id,
          primary_goal: "maintain",
          daily_calories_target: 2000,
          macros_target: macrosFor(2000),
          days: WEEK.map((di) => ({
            day_index: di,
            day_name_ar: `اليوم ${di + 1}`,
            meals: [
              { slot: "breakfast", slot_name_ar: "الفطور", recipe_name_ar: `فطور-جديد-${di}` },
              { slot: "lunch", slot_name_ar: "الغداء", recipe_name_ar: `غداء-جديد-${di}` },
            ],
          })),
        })),
        methodology_notes_ar: "ملاحظات",
        safety_disclaimer_ar: "تنبيه",
      };
      PlanSkeletonSchema.parse(skeleton);
      text = JSON.stringify(skeleton);
    } else {
      const dayIndex = Number(dayMatch[1]);
      const blocks = [
        ...systemPrompt.matchAll(
          /• member_id="([^"]+)" — الهدف: (\d+) سعرة[^\n]*\n {2}وجبات اليوم: ([^\n]*)/g,
        ),
      ];
      const slice: DaySlice = {
        day_index: dayIndex,
        members: blocks.map(([, id, target, line]) => {
          const listed = [
            ...line!.matchAll(/\((breakfast|lunch|dinner|snack)\): ([^|]+)/g),
          ].map(([, slot, name]) => ({ slot: slot as Meal["slot"], name: name!.trim() }));
          const dishes = listed.length
            ? listed
            : [
                { slot: "breakfast" as const, name: `فطور-حر-${dayIndex}` },
                { slot: "lunch" as const, name: `غداء-حر-${dayIndex}` },
              ];
          const each = Math.round(Number(target) / dishes.length);
          const meals = dishes.map((d) => dish(d.slot, d.name, each, each / 3));
          // The disobedience: on the join day, a breakfast named exactly like
          // the one the family already cooked.
          if (opts.strayBreakfastFor === id && dayIndex === 1)
            meals.unshift(dish("breakfast", `فطور-${dayIndex}`, 400, 150));
          // Worse: nothing but the answered slot.
          if (opts.onlyStrayFor === id && dayIndex === 1)
            return { member_id: id!, meals: [dish("breakfast", `فطور-${dayIndex}`, 400, 150)] };
          return { member_id: id!, meals };
        }),
      };
      DaySliceSchema.parse(slice);
      text = JSON.stringify(slice);
    }
    return { text, tokensIn: 10, tokensOut: 20, stopReason: null };
  };
}

async function joinGrandma(opts: { strayBreakfastFor?: string } = {}) {
  mockedStream.mockImplementation(fakeModel(opts) as typeof streamAnthropic);
  const prior = priorPlan();
  const ctx = household();
  // The worker's order: record joins on the plan as read, then clear.
  const prep = prepareSharedGroupRegen(ctx, prepareMemberJoins(ctx, prior, breakfastDone), {
    todayISO: TODAY,
  });
  ctx.family_members = prep.familyMembers;
  const result = await generateMealPlan({
    anthropicApiKey: "test-key",
    context: ctx,
    existingPlan: prep.existingPlan,
  });
  return { prior, ...result };
}

const memberOf = (plan: MealPlan, id: string) => plan.members.find((m) => m.member_id === id)!;
const dayOf = (plan: MealPlan, id: string, di: number) =>
  memberOf(plan, id).days.find((d) => d.day_index === di)!;
const sharers = (meal: Meal) => (meal.per_member_portions ?? []).map((p) => p.member_id).sort();
const dayPrompts = () =>
  mockedStream.mock.calls
    .map((c) => c[0]!.systemPrompt)
    .filter((p) => /day_index=\d+/.test(p));

beforeEach(() => {
  mockedStream.mockReset();
});

describe("generateMealPlan — a shared member joining mid-week", () => {
  it("never touches a day that has passed, and gives the newcomer nothing on it", async () => {
    const { plan, prior } = await joinGrandma();

    for (const id of ["mom", "dad"]) {
      expect(dayOf(plan, id, 0)).toEqual(dayOf(prior, id, 0));
    }
    expect(dayOf(plan, "gma", 0).meals).toEqual([]);
    // No model call was spent on the past.
    expect(dayPrompts().some((p) => /day_index=0\b/.test(p))).toBe(false);
  });

  it("keeps today's answered breakfast byte-for-byte, without the newcomer in it", async () => {
    const { plan, prior } = await joinGrandma();

    for (const id of ["mom", "dad"]) {
      const before = dayOf(prior, id, 1).meals.find((m) => m.slot === "breakfast")!;
      const after = dayOf(plan, id, 1).meals.find((m) => m.slot === "breakfast")!;
      expect(after).toEqual(before);
      expect(sharers(after)).not.toContain("gma");
    }
    expect(dayOf(plan, "gma", 1).meals.map((m) => m.slot)).toEqual(["lunch"]);
  });

  it("adds the newcomer to today's still-open dish — same dish, re-portioned", async () => {
    const { plan } = await joinGrandma();

    const momLunch = dayOf(plan, "mom", 1).meals.find((m) => m.slot === "lunch")!;
    expect(momLunch.recipe_name_ar).toBe("غداء-1"); // today's menu is unchanged
    expect(momLunch.shared_recipe).toBe(true);
    expect(sharers(momLunch)).toEqual(["dad", "gma", "mom"]);
    // Mom and dad keep their own portion of it.
    expect(momLunch.calories).toBe(1200);
    // Today's call was about the newcomer alone, with a target sized to what is
    // left of the day: lunch is 1200 of the table's 1800 kcal → 2/3 of 2000.
    const today = dayPrompts().filter((p) => /day_index=1\b/.test(p));
    expect(today).toHaveLength(1);
    expect(today[0]).not.toContain('member_id="mom"');
    expect(today[0]).toContain('member_id="gma" — الهدف: 1333 سعرة');
    expect(today[0]).toContain("انضمّ إلى الخطة أثناء هذا اليوم");
  });

  it("rebuilds the days after today for the whole table, newcomer included", async () => {
    const { plan } = await joinGrandma();

    for (const di of [2, 3]) {
      for (const id of ["mom", "dad", "gma"]) {
        const lunch = dayOf(plan, id, di).meals.find((m) => m.slot === "lunch")!;
        expect(lunch.recipe_name_ar).toBe(`غداء-جديد-${di}`);
        expect(sharers(lunch)).toEqual(["dad", "gma", "mom"]);
      }
    }
  });

  it("records where the newcomer's week starts, and leaves nobody 'short'", async () => {
    const { plan, missingDays } = await joinGrandma();

    expect(plan.member_joins).toEqual({ gma: { day_index: 1, closed_slots: ["breakfast"] } });
    expect(missingDays).toEqual([]);
    // The drain, the chain and the sweeper read this — an empty day 0 for the
    // newcomer must not look like a gap to refill.
    expect(incompleteInPlanMemberIds({ plan, maxAttempts: MEMBER_GEN_MAX_ATTEMPTS })).toEqual([]);
  });

  it("drops a meal the model adds in an answered slot, so the cooked batch stays as it was", async () => {
    const { plan, prior } = await joinGrandma({ strayBreakfastFor: "gma" });

    expect(dayOf(plan, "gma", 1).meals.map((m) => m.slot)).toEqual(["lunch"]);
    const momBreakfast = dayOf(plan, "mom", 1).meals.find((m) => m.slot === "breakfast")!;
    expect(momBreakfast).toEqual(dayOf(prior, "mom", 1).meals[0]);
  });

  it("a later refill honours the join: no pre-join day, no answered slot", async () => {
    const { plan } = await joinGrandma();
    // Simulate grandma's day 3 lost to a failed call.
    const gapped: MealPlan = {
      ...plan,
      members: plan.members.map((m) =>
        m.member_id !== "gma"
          ? m
          : {
              ...m,
              days: m.days.map((d) =>
                d.day_index === 3
                  ? { ...d, meals: [], day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } }
                  : d,
              ),
            },
      ),
    };
    expect(incompleteInPlanMemberIds({ plan: gapped, maxAttempts: MEMBER_GEN_MAX_ATTEMPTS })).toEqual([
      "gma",
    ]);

    mockedStream.mockReset();
    mockedStream.mockImplementation(fakeModel() as typeof streamAnthropic);
    const refill = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: household(),
      existingPlan: gapped,
    });

    const days = dayPrompts().map((p) => Number(p.match(/day_index=(\d+)/)![1]));
    expect(days).toEqual([3]);
    expect(dayOf(refill.plan, "gma", 0).meals).toEqual([]);
    expect(dayOf(refill.plan, "gma", 3).meals.length).toBeGreaterThan(0);
    expect(refill.plan.member_joins?.gma).toEqual({ day_index: 1, closed_slots: ["breakfast"] });
  });

  it("after the week has ended, the newcomer is recorded with no meals and no model call", async () => {
    mockedStream.mockImplementation(async () => {
      throw new Error("no model call may be made when nothing of the week is left");
    });
    const ctx = household();
    const later = { dateISO: "2026-06-20", checkins: [], absences: [] };
    const prep = prepareSharedGroupRegen(ctx, prepareMemberJoins(ctx, priorPlan(), later), {
      todayISO: later.dateISO,
    });
    ctx.family_members = prep.familyMembers;
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: ctx,
      existingPlan: prep.existingPlan,
    });

    expect(mockedStream).not.toHaveBeenCalled();
    expect(memberOf(plan, "gma").days.every((d) => d.meals.length === 0)).toBe(true);
    expect(memberOf(plan, "gma").days).toHaveLength(WEEK.length);
    expect(plan.member_joins?.gma).toEqual({ day_index: WEEK.length });
    expect(dayOf(plan, "mom", 3)).toEqual(dayOf(priorPlan(), "mom", 3));
  });
});

/**
 * The same household when «الخال» (the uncle) is added as an INDEPENDENT member
 * on day 1, with today's breakfast already marked. He eats his own dishes, so
 * nobody else's meals may change at all — and he gets none of the week that
 * is already behind the household.
 */
describe("generateMealPlan — an independent member joining mid-week", () => {
  const withUncle = () =>
    context([adult("dad", "أبو محمد"), adult("uncle", "الخال", "independent")]);

  async function joinUncle() {
    mockedStream.mockImplementation(fakeModel() as typeof streamAnthropic);
    const prior = priorPlan();
    const ctx = withUncle();
    const existingPlan = prepareMemberJoins(ctx, prior, breakfastDone);
    const result = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: ctx,
      existingPlan,
      onlyMemberId: "uncle",
    });
    return { prior, ...result };
  }

  it("changes nothing for anyone else, on any day", async () => {
    const { plan, prior } = await joinUncle();
    for (const id of ["mom", "dad"]) {
      expect(memberOf(plan, id).days).toEqual(memberOf(prior, id).days);
    }
  });

  it("gives him no meals on the days already behind the household", async () => {
    const { plan } = await joinUncle();
    expect(dayOf(plan, "uncle", 0).meals).toEqual([]);
    expect(dayPrompts().some((p) => /day_index=0\b/.test(p))).toBe(false);
  });

  it("today: only the slots still open, his own dish, sized to what is left of the day", async () => {
    const { plan } = await joinUncle();
    const today = dayOf(plan, "uncle", 1).meals;
    expect(today.map((m) => m.slot)).toEqual(["lunch"]);
    expect(today[0]!.shared_recipe).toBeFalsy();
    const prompt = dayPrompts().find((p) => /day_index=1\b/.test(p))!;
    // Lunch is 1200 of the household's 1800 kcal day → 2/3 of his 2000.
    expect(prompt).toContain('member_id="uncle" — الهدف: 1333 سعرة');
  });

  it("plans the rest of the week in full, and leaves nobody 'short'", async () => {
    const { plan } = await joinUncle();
    for (const di of [2, 3]) {
      expect(dayOf(plan, "uncle", di).meals.map((m) => m.slot)).toEqual(["breakfast", "lunch"]);
    }
    expect(plan.member_joins).toEqual({ uncle: { day_index: 1, closed_slots: ["breakfast"] } });
    expect(incompleteInPlanMemberIds({ plan, maxAttempts: MEMBER_GEN_MAX_ATTEMPTS })).toEqual([]);
  });

  it("after the week has ended: recorded for next week, no model call, attempt caps kept", async () => {
    mockedStream.mockImplementation(async () => {
      throw new Error("no model call may be made when nothing of the week is left");
    });
    const ctx = withUncle();
    const prior = { ...priorPlan(), gen_attempts: { dad: 3 } };
    const existingPlan = prepareMemberJoins(ctx, prior, {
      dateISO: "2026-06-20",
      checkins: [],
      absences: [],
    });
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: ctx,
      existingPlan,
      onlyMemberId: "uncle",
    });

    expect(mockedStream).not.toHaveBeenCalled();
    expect(memberOf(plan, "uncle").days.every((d) => d.meals.length === 0)).toBe(true);
    expect(plan.member_joins?.uncle).toEqual({ day_index: WEEK.length });
    // The no-op path used to drop this, handing a capped member fresh retries.
    expect(plan.gen_attempts).toEqual({ dad: 3 });
  });
});

// ── What the adversarial review found (09/2026) ─────────────────────────────
describe("generateMealPlan — joins under refills and regenerates", () => {
  const emptyDay = (d: Day): Day => ({
    ...d,
    meals: [],
    day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  });
  const withDays = (plan: MealPlan, id: string, f: (d: Day) => Day): MealPlan => ({
    ...plan,
    members: plan.members.map((m) => (m.member_id === id ? { ...m, days: m.days.map(f) } : m)),
  });

  it("never aligns a whole-day member to a joiner's partial day — they get a full day of their own", async () => {
    const { plan } = await joinGrandma();
    // Mom's and dad's day 1 lost; only grandma's lunch-only first day remains.
    let gapped = withDays(plan, "mom", (d) => (d.day_index === 1 ? emptyDay(d) : d));
    gapped = withDays(gapped, "dad", (d) => (d.day_index === 1 ? emptyDay(d) : d));

    mockedStream.mockReset();
    mockedStream.mockImplementation(fakeModel() as typeof streamAnthropic);
    const refill = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: household(),
      existingPlan: gapped,
    });

    expect(dayOf(refill.plan, "mom", 1).meals.map((m) => m.slot)).toEqual(["breakfast", "lunch"]);
    expect(dayOf(refill.plan, "gma", 1).meals.map((m) => m.slot)).toEqual(["lunch"]);
  });

  it("a scoped regenerate of a joiner sizes her first day from the stored table, not a guess", async () => {
    const { plan } = await joinGrandma();

    mockedStream.mockReset();
    mockedStream.mockImplementation(fakeModel() as typeof streamAnthropic);
    await generateMealPlan({
      anthropicApiKey: "test-key",
      context: household(),
      existingPlan: plan,
      regenerateMemberId: "gma",
      regenScope: "both",
    });

    const day1 = dayPrompts().find((p) => /day_index=1\b/.test(p))!;
    // The live co-sharer days are being rebuilt in this call; the stored day
    // still says lunch is 1200 of 1800 → 2/3 of her 2000.
    expect(day1).toContain('member_id="gma" — الهدف: 1333 سعرة');
  });

  it("a joiner answered with nothing usable does not cost the others their day", async () => {
    const { plan } = await joinGrandma();

    mockedStream.mockReset();
    mockedStream.mockImplementation(fakeModel({ onlyStrayFor: "gma" }) as typeof streamAnthropic);
    const { plan: out, missingDays } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: household(),
      existingPlan: plan,
      regenerateMemberId: "gma",
      regenScope: "both",
    });

    // Throwing on the emptied joiner used to re-roll the whole day until it
    // was lost for everyone.
    expect(missingDays).not.toContain(1);
    // Mom's in-scope lunch landed fresh; her answered breakfast is untouched.
    const momDay1 = dayOf(out, "mom", 1).meals;
    expect(momDay1.find((m) => m.slot === "lunch")!.recipe_name_ar).not.toBe("غداء-1");
    expect(momDay1.find((m) => m.slot === "breakfast")).toEqual(
      dayOf(plan, "mom", 1).meals.find((m) => m.slot === "breakfast"),
    );
    // And grandma was not handed the answered breakfast.
    expect(dayOf(out, "gma", 1).meals.map((m) => m.slot)).not.toContain("breakfast");
  });

  it("a refill of her empty first day hears what was answered since she joined", async () => {
    const { plan } = await joinGrandma();
    const gapped = withDays(plan, "gma", (d) => (d.day_index === 1 ? emptyDay(d) : d));
    // Lunch was marked after she joined: nothing of day 1 is left for her.
    const lunchSince = {
      dateISO: TODAY,
      checkins: [
        { local_date: TODAY, slot: "breakfast", member_id: "mom" },
        { local_date: TODAY, slot: "lunch", member_id: "dad" },
      ],
      absences: [],
    };

    mockedStream.mockReset();
    mockedStream.mockImplementation(fakeModel() as typeof streamAnthropic);
    const ctx = household();
    const refill = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: ctx,
      existingPlan: prepareMemberJoins(ctx, gapped, lunchSince),
    });

    expect(refill.plan.member_joins?.gma).toEqual({ day_index: 2 });
    expect(dayOf(refill.plan, "gma", 1).meals).toEqual([]);
    expect(dayPrompts().some((p) => /day_index=1\b/.test(p))).toBe(false);
    expect(incompleteInPlanMemberIds({ plan: refill.plan, maxAttempts: MEMBER_GEN_MAX_ATTEMPTS })).toEqual([]);
  });

  it("someone joined after the week ended keeps a 0 target through later runs — no floored header", async () => {
    const ctx = household();
    const later = { dateISO: "2026-06-20", checkins: [], absences: [] };
    const prep = prepareSharedGroupRegen(ctx, prepareMemberJoins(ctx, priorPlan(), later), {
      todayISO: later.dateISO,
    });
    ctx.family_members = prep.familyMembers;
    mockedStream.mockImplementation(fakeModel() as typeof streamAnthropic);
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: ctx,
      existingPlan: prep.existingPlan,
    });

    // A later run for somebody else (dad lost a day).
    const gapped = withDays(plan, "dad", (d) => (d.day_index === 2 ? emptyDay(d) : d));
    const next = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: household(),
      existingPlan: gapped,
    });

    expect(memberOf(next.plan, "gma").daily_calories_target).toBe(0);
    expect(dayOf(next.plan, "dad", 2).meals.length).toBeGreaterThan(0);
  });
});
