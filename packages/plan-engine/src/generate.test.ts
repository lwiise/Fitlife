import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the Anthropic layer ──────────────────────────────────────────────
// Only `streamAnthropic` is faked; the pure helpers (`stripMarkdownFence`,
// `computeCostUsd`) keep their real implementations so the code under test
// parses our mocked SSE text exactly as it would a real response.
vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return {
    ...actual,
    streamAnthropic: vi.fn(),
  };
});

import { streamAnthropic } from "./anthropic";
import { generateMealPlan, resyncSharedMeals } from "./generate";
import type { PlanPromptContext } from "./buildContext";
import type { MealPlan, Day, Meal, DaySlice, PlanSkeleton } from "./schema";
import { MealPlanSchema, DaySliceSchema, PlanSkeletonSchema } from "./schema";

const mockedStream = vi.mocked(streamAnthropic);

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeMeal(recipeName: string): Meal {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: recipeName,
    ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
    prep_steps_ar: ["اخفقي البيض", "اطبخيه"],
    calories: 300,
    macros: { protein_g: 20, carbs_g: 10, fat_g: 15 },
  };
}

function makeDay(dayIndex: number, recipeName: string): Day {
  const meals = [makeMeal(recipeName)];
  return {
    day_index: dayIndex,
    day_name_ar: `اليوم ${dayIndex + 1}`,
    meals,
    day_total: { calories: 300, protein_g: 20, carbs_g: 10, fat_g: 15 },
  };
}

const DAY_INDICES = [0, 1, 2];

/** A member plan that is COMPLETE for every day in DAY_INDICES. */
function makeCompleteMember(memberId: string, name: string): MealPlan["members"][number] {
  return {
    member_id: memberId,
    member_name_ar: name,
    primary_goal: "fat_loss",
    daily_calories_target: 1800,
    macros_target: { protein_g: 120, carbs_g: 150, fat_g: 60 },
    days: DAY_INDICES.map((di) => makeDay(di, `${memberId}-طبق-${di}`)),
  };
}

function makeContext(opts?: { extraMember?: boolean }): PlanPromptContext {
  const family_members: PlanPromptContext["family_members"] = [];
  if (opts?.extraMember) {
    family_members.push({
      id: "member-2",
      name: "سارة",
      role: "daughter",
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
      feeding_mode: null,
    });
  }
  return {
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
    family_members,
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

/** An existing MealPlan complete for the given members across all DAY_INDICES. */
function makeExistingPlan(members: MealPlan["members"]): MealPlan {
  return MealPlanSchema.parse({
    week_start_date: "2026-06-06",
    members,
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    days_total: DAY_INDICES.length,
    generating: false,
  });
}

/**
 * Mock SSE text generator. Branches on the prompt shape:
 *  - Skeleton prompt (no `day_index=`): returns a valid PlanSkeleton covering the
 *    requested members across all DAY_INDICES with dish names + targets.
 *  - Day prompt (`day_index=N`): returns a minimal valid DaySlice covering exactly
 *    the members it asks to expand, for that day.
 * Both parse the `member_id="..."` tokens the real prompts emit, so a stray call
 * (e.g. accidentally regenerating a carried member) shows up in the output.
 */
function streamReturns(systemPrompt: string): {
  text: string;
  tokensIn: number;
  tokensOut: number;
  stopReason: null;
} {
  const memberIds = [...systemPrompt.matchAll(/member_id="([^"]+)"/g)].map((m) => m[1]!);
  const ids = memberIds.length > 0 ? memberIds : ["mom"];
  const dayMatch = systemPrompt.match(/day_index=(\d+)/);

  let text: string;
  if (!dayMatch) {
    // Phase 1 skeleton.
    const skeleton: PlanSkeleton = {
      members: ids.map((id) => ({
        member_id: id,
        member_name_ar: id,
        primary_goal: "fat_loss",
        daily_calories_target: 1600,
        macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
        days: DAY_INDICES.map((di) => ({
          day_index: di,
          day_name_ar: `اليوم ${di + 1}`,
          meals: [{ slot: "breakfast", slot_name_ar: "الفطور", recipe_name_ar: `${id}-fresh-${di}` }],
        })),
      })),
      methodology_notes_ar: "ملاحظات",
      safety_disclaimer_ar: "تنبيه",
    };
    PlanSkeletonSchema.parse(skeleton);
    text = JSON.stringify(skeleton);
  } else {
    // Phase 2 day slice.
    const dayIndex = Number(dayMatch[1]);
    const slice: DaySlice = {
      day_index: dayIndex,
      members: ids.map((id) => ({
        member_id: id,
        meals: [makeMeal(`${id}-fresh-${dayIndex}`)],
      })),
    };
    DaySliceSchema.parse(slice);
    text = JSON.stringify(slice);
  }
  return { text, tokensIn: 10, tokensOut: 20, stopReason: null };
}

beforeEach(() => {
  mockedStream.mockReset();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("resyncSharedMeals — independent members never join a shared batch", () => {
  const lunch = (chicken: number): Meal => ({
    slot: "lunch",
    slot_name_ar: "غداء",
    // Same dish NAME for everyone — the collision that used to force a merge.
    recipe_name_ar: "كبسة",
    ingredients: [{ name_ar: "دجاج", amount: chicken, unit: "g" }],
    prep_steps_ar: ["جهّزي الكبسة"],
    calories: 500,
    macros: { protein_g: 30, carbs_g: 40, fat_g: 10 },
  });

  it("peels an independent member out of a name-colliding share; shared peers still batch", () => {
    const out = resyncSharedMeals(
      [
        { member_id: "mom", fresh: true, meals: [lunch(80)] },
        { member_id: "m1", fresh: true, meals: [lunch(120)] },
        { member_id: "m2", fresh: true, meals: [lunch(120)] },
      ],
      new Set(["mom"]), // mom is independent
    );
    const momLunch = out.get("mom")![0]!;
    // Independent mom stays individual despite the identical dish name.
    expect(momLunch.shared_recipe).toBeFalsy();
    expect(momLunch.per_member_portions).toBeUndefined();
    // The two shared members still form a batch together — without mom.
    const m1Lunch = out.get("m1")![0]!;
    expect(m1Lunch.shared_recipe).toBe(true);
    expect(m1Lunch.per_member_portions!.map((p) => p.member_id).sort()).toEqual([
      "m1",
      "m2",
    ]);
  });

  it("without the independent set, the same colliding dish DOES merge (guards the param)", () => {
    const out = resyncSharedMeals([
      { member_id: "mom", fresh: true, meals: [lunch(80)] },
      { member_id: "m1", fresh: true, meals: [lunch(120)] },
    ]);
    expect(out.get("mom")![0]!.shared_recipe).toBe(true);
  });
});

describe("generateMealPlan — incremental carry-over", () => {
  it("zero-call fast path: a fully-complete existing plan makes NO Anthropic calls", async () => {
    // Any call should fail the test outright.
    mockedStream.mockImplementation(async () => {
      throw new Error("streamAnthropic must not be called on the fast path");
    });

    const context = makeContext();
    const existingPlan = makeExistingPlan([makeCompleteMember("mom", "أم محمد")]);

    const { plan, usage } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan,
    });

    expect(mockedStream).not.toHaveBeenCalled();
    expect(usage).toEqual({ input_tokens: 0, output_tokens: 0, cost_usd: 0 });
    // Output carries the prior plan's content untouched.
    const momOut = plan.members.find((m) => m.member_id === "mom")!;
    expect(momOut.days).toHaveLength(DAY_INDICES.length);
    expect(plan.generating).toBe(false);
  });

  it("byte-identical cell reuse: complete members are carried over verbatim (deep-equal)", async () => {
    // Two members; mom is complete, member-2 is brand new (no days). Only
    // member-2 gets generated; mom's days must be the exact same objects/values.
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      streamReturns(systemPrompt),
    );

    const context = makeContext({ extraMember: true });
    const momMember = makeCompleteMember("mom", "أم محمد");
    const existingPlan = makeExistingPlan([momMember]); // member-2 absent → incomplete

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan,
    });

    const momOut = plan.members.find((m) => m.member_id === "mom")!;
    // Deep-equal against the ORIGINAL prior days: carried over unchanged.
    expect(momOut.days).toEqual(momMember.days);
    for (const di of DAY_INDICES) {
      const original = momMember.days.find((d) => d.day_index === di)!;
      const carried = momOut.days.find((d) => d.day_index === di)!;
      expect(carried).toEqual(original);
      // Same recipe text proves it was reused, not regenerated.
      expect(carried.meals[0]!.recipe_name_ar).toBe(`mom-طبق-${di}`);
    }

    // The new member WAS generated (fresh meals from the mock).
    const newOut = plan.members.find((m) => m.member_id === "member-2")!;
    expect(newOut.days).toHaveLength(DAY_INDICES.length);
    expect(newOut.days.every((d) => d.meals.length > 0)).toBe(true);
    expect(newOut.days[0]!.meals[0]!.recipe_name_ar).toContain("fresh");

    // streamAnthropic was called for the new member only (3 day calls; the
    // family-aligned gap-fill needs no skeleton call).
    expect(mockedStream).toHaveBeenCalled();
  });

  it("onlyMemberId: regenerates just that member's missing cells, carrying every other member untouched", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      streamReturns(systemPrompt),
    );

    const context = makeContext({ extraMember: true });
    const momMember = makeCompleteMember("mom", "أم محمد");
    // member-2 is missing day 1 only (has 0 and 2) — partial.
    const partialChild: MealPlan["members"][number] = {
      member_id: "member-2",
      member_name_ar: "سارة",
      primary_goal: undefined,
      daily_calories_target: 1400,
      macros_target: { protein_g: 80, carbs_g: 120, fat_g: 45 },
      days: [makeDay(0, "child-طبق-0"), makeDay(2, "child-طبق-2")],
    };
    const existingPlan = makeExistingPlan([momMember, partialChild]);

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan,
      onlyMemberId: "member-2",
    });

    // Mom: completely untouched (deep equal to original).
    const momOut = plan.members.find((m) => m.member_id === "mom")!;
    expect(momOut.days).toEqual(momMember.days);

    // member-2: its two existing days are carried verbatim, the missing one filled.
    const childOut = plan.members.find((m) => m.member_id === "member-2")!;
    expect(childOut.days.find((d) => d.day_index === 0)).toEqual(
      partialChild.days.find((d) => d.day_index === 0),
    );
    expect(childOut.days.find((d) => d.day_index === 2)).toEqual(
      partialChild.days.find((d) => d.day_index === 2),
    );
    const filled = childOut.days.find((d) => d.day_index === 1)!;
    expect(filled.meals.length).toBeGreaterThan(0);
    expect(filled.meals[0]!.recipe_name_ar).toContain("fresh");

    // Every generation call targeted ONLY member-2 — mom is never in a day prompt.
    for (const call of mockedStream.mock.calls) {
      const prompt = call[0]!.systemPrompt;
      const ids = [...prompt.matchAll(/member_id="([^"]+)"/g)].map((m) => m[1]);
      expect(ids).not.toContain("mom");
    }
  });
});

// ── Shared-meal re-sync through the full day loop ───────────────────────────
// The mock makes every member's lunch the SAME dish "كبسة" so they form one shared
// batch — letting us verify that editing one member re-syncs the carried member's
// batch (Issue 3), not just carry over the stale one.
function sharedStreamReturns(systemPrompt: string): {
  text: string;
  tokensIn: number;
  tokensOut: number;
  stopReason: null;
} {
  const ids = [...systemPrompt.matchAll(/member_id="([^"]+)"/g)].map((m) => m[1]!);
  const dayMatch = systemPrompt.match(/day_index=(\d+)/);
  // The edited member's regenerated portion is bigger than its carried one (دجاج 200).
  const lunchMeal = (recipe: string): Meal => ({
    slot: "lunch",
    slot_name_ar: "غداء",
    recipe_name_ar: recipe,
    ingredients: [{ name_ar: "دجاج", amount: 200, unit: "g" }],
    prep_steps_ar: ["جهّزي الكبسة"],
    calories: 700,
    macros: { protein_g: 40, carbs_g: 60, fat_g: 20 },
  });
  let text: string;
  if (!dayMatch) {
    const skeleton: PlanSkeleton = {
      members: ids.map((id) => ({
        member_id: id,
        member_name_ar: id,
        primary_goal: "fat_loss",
        daily_calories_target: 1600,
        macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
        days: DAY_INDICES.map((di) => ({
          day_index: di,
          day_name_ar: `اليوم ${di + 1}`,
          meals: [{ slot: "lunch", slot_name_ar: "غداء", recipe_name_ar: "كبسة" }],
        })),
      })),
      methodology_notes_ar: "ملاحظات",
      safety_disclaimer_ar: "تنبيه",
    };
    PlanSkeletonSchema.parse(skeleton);
    text = JSON.stringify(skeleton);
  } else {
    const slice: DaySlice = {
      day_index: Number(dayMatch[1]),
      members: ids.map((id) => ({ member_id: id, meals: [lunchMeal("كبسة")] })),
    };
    DaySliceSchema.parse(slice);
    text = JSON.stringify(slice);
  }
  return { text, tokensIn: 10, tokensOut: 20, stopReason: null };
}

/** mom + member-2 share "كبسة" each day, assembled (with own_portion) — a prior plan. */
function makeSharedExistingPlan(): MealPlan {
  const sumDay = (meals: Meal[]) => ({
    calories: Math.round(meals.reduce((s, m) => s + m.calories, 0)),
    protein_g: Math.round(meals.reduce((s, m) => s + m.macros.protein_g, 0)),
    carbs_g: Math.round(meals.reduce((s, m) => s + m.macros.carbs_g, 0)),
    fat_g: Math.round(meals.reduce((s, m) => s + m.macros.fat_g, 0)),
  });
  const portion = (id: string, chicken: number, cal: number): Meal => ({
    slot: "lunch",
    slot_name_ar: "غداء",
    recipe_name_ar: "كبسة",
    ingredients: [{ name_ar: "دجاج", amount: chicken, unit: "g" }],
    prep_steps_ar: ["جهّزي الكبسة"],
    calories: cal,
    macros: { protein_g: 30, carbs_g: 40, fat_g: 10 },
  });
  const momDays: Day[] = [];
  const childDays: Day[] = [];
  for (const di of DAY_INDICES) {
    const out = resyncSharedMeals([
      { member_id: "mom", fresh: true, meals: [portion("mom", 80, 500)] },
      { member_id: "member-2", fresh: true, meals: [portion("member-2", 120, 600)] },
    ]);
    const mm = out.get("mom")!;
    const cm = out.get("member-2")!;
    momDays.push({ day_index: di, day_name_ar: `اليوم ${di + 1}`, meals: mm, day_total: sumDay(mm) });
    childDays.push({ day_index: di, day_name_ar: `اليوم ${di + 1}`, meals: cm, day_total: sumDay(cm) });
  }
  return MealPlanSchema.parse({
    week_start_date: "2026-06-06",
    members: [
      {
        member_id: "mom",
        member_name_ar: "أم محمد",
        primary_goal: "fat_loss",
        daily_calories_target: 1800,
        macros_target: { protein_g: 120, carbs_g: 150, fat_g: 60 },
        days: momDays,
      },
      {
        member_id: "member-2",
        member_name_ar: "سارة",
        daily_calories_target: 1400,
        macros_target: { protein_g: 80, carbs_g: 120, fat_g: 45 },
        days: childDays,
      },
    ],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    days_total: DAY_INDICES.length,
    generating: false,
  });
}

describe("generateMealPlan — shared-meal re-sync on member edit", () => {
  it("editing one member updates the carried member's shared batch + leaves their own portion intact", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      sharedStreamReturns(systemPrompt),
    );

    const context = makeContext({ extraMember: true }); // mom + member-2
    const existing = makeSharedExistingPlan();
    // dispatch removes the edited member from the prior plan before regenerating it.
    const existingWithoutChild: MealPlan = {
      ...existing,
      members: existing.members.filter((m) => m.member_id !== "member-2"),
    };

    // Sanity: the prior plan's mom batch is mom(80) + child(120) = 200g دجاج.
    const priorMomLunch = existing.members
      .find((m) => m.member_id === "mom")!
      .days[0]!.meals.find((m) => m.slot === "lunch")!;
    expect(priorMomLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(200);

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan: existingWithoutChild,
    });

    const momLunch = plan.members
      .find((m) => m.member_id === "mom")!
      .days.find((d) => d.day_index === 0)!
      .meals.find((m) => m.slot === "lunch")!;

    // Re-synced: the carried mom's batch now reflects the edited member's NEW portion
    // (mom 80 + member-2 200 = 280g), and both members are in the split.
    expect(momLunch.shared_recipe).toBe(true);
    expect(momLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(280);
    expect(momLunch.per_member_portions!.map((p) => p.member_id).sort()).toEqual([
      "member-2",
      "mom",
    ]);
    // Mom's OWN portion + calories are untouched — only the shared batch view moved.
    expect(momLunch.own_portion!.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(80);
    expect(momLunch.calories).toBe(500);

    // The edited member got the (bigger) fresh portion and is in the same batch.
    const childLunch = plan.members
      .find((m) => m.member_id === "member-2")!
      .days.find((d) => d.day_index === 0)!
      .meals.find((m) => m.slot === "lunch")!;
    expect(childLunch.shared_recipe).toBe(true);
    expect(childLunch.own_portion!.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(200);
  });

  it("stamps generating_member_id on the regenerated member (and not on an initial full run)", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      sharedStreamReturns(systemPrompt),
    );
    const context = makeContext({ extraMember: true }); // mom + member-2

    // Single-member regenerate: member-2 removed from the prior plan → only it fills.
    const existing = makeSharedExistingPlan();
    const existingWithoutChild: MealPlan = {
      ...existing,
      members: existing.members.filter((m) => m.member_id !== "member-2"),
    };
    const regenSnaps: MealPlan[] = [];
    await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan: existingWithoutChild,
      onProgress: (snap) => {
        regenSnaps.push(snap);
      },
    });
    const genSnaps = regenSnaps.filter((s) => s.generating);
    expect(genSnaps.length).toBeGreaterThan(0);
    // Every "still generating" emit names the member we're regenerating — so the
    // loading screen never shows the account owner / another member.
    expect(genSnaps.every((s) => s.generating_member_id === "member-2")).toBe(true);

    // Initial full-family run (no prior plan): not a single targeted member → unset.
    const initSnaps: MealPlan[] = [];
    await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      onProgress: (snap) => {
        initSnaps.push(snap);
      },
    });
    expect(
      initSnaps.filter((s) => s.generating).every((s) => !s.generating_member_id),
    ).toBe(true);
  });

  it("dissolves a carried member's stale share on a day the regenerated member FAILS", async () => {
    // Day 1 generation fails; days 0 + 2 succeed. mom shared 'كبسة' with member-2 on
    // every day in the prior plan.
    mockedStream.mockImplementation(async ({ systemPrompt }) => {
      const dayMatch = systemPrompt.match(/day_index=(\d+)/);
      if (dayMatch && Number(dayMatch[1]) === 1) throw new Error("forced day-1 failure");
      return sharedStreamReturns(systemPrompt);
    });
    const context = makeContext({ extraMember: true });
    const existing = makeSharedExistingPlan();
    const existingWithoutChild: MealPlan = {
      ...existing,
      members: existing.members.filter((m) => m.member_id !== "member-2"),
    };

    const { plan, missingDays } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan: existingWithoutChild,
    });
    expect(missingDays).toContain(1);

    const momDay = (di: number) =>
      plan.members
        .find((m) => m.member_id === "mom")!
        .days.find((d) => d.day_index === di)!
        .meals.find((m) => m.slot === "lunch")!;

    // FAILED day: mom must NOT still show a share with member-2 (who has no meal here).
    // It dissolves to her own single portion (80g), not the stale 200g batch.
    const failedLunch = momDay(1);
    expect(failedLunch.shared_recipe).toBeFalsy();
    expect(failedLunch.per_member_portions).toBeUndefined();
    expect(failedLunch.ingredients.find((i) => i.name_ar === "دجاج")!.amount).toBe(80);

    // SUCCESSFUL day: the share re-forms with member-2's freshly generated portion.
    const okLunch = momDay(0);
    expect(okLunch.shared_recipe).toBe(true);
    expect(okLunch.per_member_portions!.map((p) => p.member_id).sort()).toEqual([
      "member-2",
      "mom",
    ]);
  });
});

// ── Item 2: the loading screen always names the CLICKED member ──────────────
describe("generateMealPlan — regenerateMemberId name stamping", () => {
  it("stamps the clicked member even when MORE THAN ONE member is incomplete", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      streamReturns(systemPrompt),
    );
    const context = makeContext({ extraMember: true }); // mom + member-2
    // A third member, deferred/absent from the prior plan alongside member-2 → TWO
    // incomplete members. Inferring the target from membersToGenerate.length===1
    // would fail (it's 2) and the loader would fall back to the owner;
    // regenerateMemberId pins the clicked member.
    context.family_members.push({
      id: "member-3",
      name: "ندى",
      role: "daughter",
      member_type: "child",
      sex: "female",
      age: 8,
      height_cm: 130,
      weight_kg: 28,
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
      feeding_mode: null,
    });
    // Only mom is in the prior plan (defines the 3-day grid); member-2 + member-3
    // are absent → both incomplete.
    const existingPlan = makeExistingPlan([makeCompleteMember("mom", "أم محمد")]);

    const snaps: MealPlan[] = [];
    await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan,
      regenerateMemberId: "member-2",
      onProgress: (snap) => {
        snaps.push(snap);
      },
    });
    const genSnaps = snaps.filter((s) => s.generating);
    expect(genSnaps.length).toBeGreaterThan(0);
    expect(genSnaps.every((s) => s.generating_member_id === "member-2")).toBe(true);
  });
});

// ── Shared-group regenerate (a member switched back to Shared re-merges) ──
// Both shared beneficiaries rebuild together, so the loader must NOT pin one member
// (UI shows them all loading), yet the regenerate still counts against the CLICKED
// member's weekly quota (regenerated_for). suppressTargetedMember decouples the two.
describe("generateMealPlan — suppressTargetedMember (shared-group regenerate)", () => {
  // A prior shared plan with every shared member's meals cleared (day shells kept) —
  // exactly what prepareSharedGroupRegen produces when a member flips back to Shared.
  const clearedSharedPlan = (): MealPlan => {
    const base = makeSharedExistingPlan(); // mom + member-2 sharing
    return {
      ...base,
      members: base.members.map((m) => ({
        ...m,
        days: m.days.map((d) => ({
          ...d,
          meals: [],
          day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        })),
      })),
    };
  };

  it("does not pin generating_member_id, but still records regenerated_for", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      sharedStreamReturns(systemPrompt),
    );
    const snaps: MealPlan[] = [];
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext({ extraMember: true }), // mom + member-2
      existingPlan: clearedSharedPlan(),
      regenerateMemberId: "mom",
      suppressTargetedMember: true,
      onProgress: (snap) => {
        snaps.push(snap);
      },
    });
    const genSnaps = snaps.filter((s) => s.generating);
    expect(genSnaps.length).toBeGreaterThan(0);
    // Two members rebuild together → no single member pinned.
    expect(genSnaps.every((s) => s.generating_member_id == null)).toBe(true);
    // Quota still attributes the regenerate to the clicked member.
    expect(plan.regenerated_for).toBe("mom");
  });

  it("WITHOUT suppress, the same multi-member regenerate pins the clicked member", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      sharedStreamReturns(systemPrompt),
    );
    const snaps: MealPlan[] = [];
    await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext({ extraMember: true }),
      existingPlan: clearedSharedPlan(),
      regenerateMemberId: "mom",
      onProgress: (snap) => {
        snaps.push(snap);
      },
    });
    const genSnaps = snaps.filter((s) => s.generating);
    expect(genSnaps.length).toBeGreaterThan(0);
    expect(genSnaps.every((s) => s.generating_member_id === "mom")).toBe(true);
  });
});

// ── New shared member anchors to a SHARED peer, never an independent member ──
// Repro: mom (main user) is 'independent' and is member #0 in the prior plan;
// member-2 is 'shared'. Adding member-3 ('shared') must align to member-2's shared
// dishes — NOT to mom's private independent dishes (the "first member with meals"
// the old family-grid loop would have picked).
describe("generateMealPlan — new shared member aligns to a shared peer", () => {
  it("aligns a newly-added shared member to the shared member's menu, not the independent main user's", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      streamReturns(systemPrompt),
    );

    // Context: mom INDEPENDENT, member-2 + member-3 SHARED.
    const context = makeContext({ extraMember: true }); // mom + member-2
    context.mom.meal_mode = "independent";
    context.family_members[0]!.meal_mode = "shared"; // member-2
    context.family_members.push({
      id: "member-3",
      name: "ندى",
      role: "daughter",
      member_type: "child",
      sex: "female",
      age: 8,
      height_cm: 130,
      weight_kg: 28,
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
      feeding_mode: null,
    });

    // Prior plan (member #0 = mom with her own independent dishes, member-2 with
    // its distinct shared dishes). member-3 is absent → it's the one being added.
    const momMember = makeCompleteMember("mom", "أم محمد"); // dishes "mom-طبق-{di}"
    const sharedMember = makeCompleteMember("member-2", "سارة"); // dishes "member-2-طبق-{di}"
    const existingPlan = makeExistingPlan([momMember, sharedMember]);

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan,
      onlyMemberId: "member-3",
    });

    // The day prompts for member-3 must align it to member-2's SHARED dish menu
    // (so the deterministic re-sync groups them into one batch), never to mom's
    // private "mom-طبق-*" dishes. (The mock day-slice always echoes "*-fresh-*", so
    // we assert on the dishes the engine ASKED for, which is the alignment signal.)
    const dayPrompts = mockedStream.mock.calls
      .map((c) => c[0]!.systemPrompt)
      .filter((p) => /day_index=\d/.test(p));
    expect(dayPrompts.length).toBe(DAY_INDICES.length);
    for (const di of DAY_INDICES) {
      const p = dayPrompts.find((pr) => pr.includes(`day_index=${di}`))!;
      expect(p).toContain(`member-2-طبق-${di}`); // aligned to the shared peer
      expect(p).not.toContain(`mom-طبق-${di}`); // NOT the independent main user
    }

    // mom (independent) and member-2 are carried over untouched.
    expect(
      plan.members.find((m) => m.member_id === "mom")!.days,
    ).toEqual(momMember.days);
    expect(
      plan.members.find((m) => m.member_id === "member-2")!.days,
    ).toEqual(sharedMember.days);
  });
});

// ── Item 3: literal partial regenerate (scope) ──────────────────────────────
// mom + member-2 share lunch "كبسة" AND each has their own breakfast — so we can
// regenerate one category and assert the other is preserved byte-for-byte.
function makeMixedExistingPlan(): MealPlan {
  const sumDay = (meals: Meal[]) => ({
    calories: Math.round(meals.reduce((s, m) => s + m.calories, 0)),
    protein_g: Math.round(meals.reduce((s, m) => s + m.macros.protein_g, 0)),
    carbs_g: Math.round(meals.reduce((s, m) => s + m.macros.carbs_g, 0)),
    fat_g: Math.round(meals.reduce((s, m) => s + m.macros.fat_g, 0)),
  });
  const breakfast = (id: string): Meal => ({
    slot: "breakfast",
    slot_name_ar: "فطور",
    recipe_name_ar: `فطور-${id}`,
    ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
    prep_steps_ar: ["اخفقي البيض"],
    calories: 300,
    macros: { protein_g: 20, carbs_g: 10, fat_g: 15 },
  });
  const lunchPortion = (chicken: number, cal: number): Meal => ({
    slot: "lunch",
    slot_name_ar: "غداء",
    recipe_name_ar: "كبسة",
    ingredients: [{ name_ar: "دجاج", amount: chicken, unit: "g" }],
    prep_steps_ar: ["جهّزي الكبسة"],
    calories: cal,
    macros: { protein_g: 30, carbs_g: 40, fat_g: 10 },
  });
  const momDays: Day[] = [];
  const childDays: Day[] = [];
  for (const di of DAY_INDICES) {
    const lunch = resyncSharedMeals([
      { member_id: "mom", fresh: true, meals: [lunchPortion(80, 500)] },
      { member_id: "member-2", fresh: true, meals: [lunchPortion(120, 600)] },
    ]);
    const momMeals = [breakfast("mom"), lunch.get("mom")![0]!];
    const childMeals = [breakfast("member-2"), lunch.get("member-2")![0]!];
    momDays.push({ day_index: di, day_name_ar: `اليوم ${di + 1}`, meals: momMeals, day_total: sumDay(momMeals) });
    childDays.push({ day_index: di, day_name_ar: `اليوم ${di + 1}`, meals: childMeals, day_total: sumDay(childMeals) });
  }
  return MealPlanSchema.parse({
    week_start_date: "2026-06-06",
    members: [
      {
        member_id: "mom",
        member_name_ar: "أم محمد",
        primary_goal: "fat_loss",
        daily_calories_target: 1800,
        macros_target: { protein_g: 120, carbs_g: 150, fat_g: 60 },
        days: momDays,
      },
      {
        member_id: "member-2",
        member_name_ar: "سارة",
        daily_calories_target: 1400,
        macros_target: { protein_g: 80, carbs_g: 120, fat_g: 45 },
        days: childDays,
      },
    ],
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    days_total: DAY_INDICES.length,
    generating: false,
  });
}

// Fresh day per requested member: a new breakfast + a NEW shared lunch name (same
// for everyone, so co-sharers re-form one batch).
function mixedStreamReturns(systemPrompt: string): {
  text: string;
  tokensIn: number;
  tokensOut: number;
  stopReason: null;
} {
  const ids = [...systemPrompt.matchAll(/member_id="([^"]+)"/g)].map((m) => m[1]!);
  const dayMatch = systemPrompt.match(/day_index=(\d+)/);
  const freshBf = (id: string, day: number): Meal => ({
    slot: "breakfast",
    slot_name_ar: "فطور",
    recipe_name_ar: `${id}-fresh-bf-${day}`,
    ingredients: [{ name_ar: "شوفان", amount: 50, unit: "g" }],
    prep_steps_ar: ["جهّزي الشوفان"],
    calories: 250,
    macros: { protein_g: 10, carbs_g: 30, fat_g: 8 },
  });
  const freshLunch = (): Meal => ({
    slot: "lunch",
    slot_name_ar: "غداء",
    recipe_name_ar: "كبسة-جديدة",
    ingredients: [{ name_ar: "دجاج", amount: 100, unit: "g" }],
    prep_steps_ar: ["جهّزي الكبسة الجديدة"],
    calories: 550,
    macros: { protein_g: 35, carbs_g: 50, fat_g: 15 },
  });
  let text: string;
  if (!dayMatch) {
    const skeleton: PlanSkeleton = {
      members: ids.map((id) => ({
        member_id: id,
        member_name_ar: id,
        primary_goal: "fat_loss",
        daily_calories_target: 1600,
        macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
        days: DAY_INDICES.map((di) => ({
          day_index: di,
          day_name_ar: `اليوم ${di + 1}`,
          meals: [
            { slot: "breakfast", slot_name_ar: "فطور", recipe_name_ar: `${id}-fresh-bf-${di}` },
            { slot: "lunch", slot_name_ar: "غداء", recipe_name_ar: "كبسة-جديدة" },
          ],
        })),
      })),
      methodology_notes_ar: "ملاحظات",
      safety_disclaimer_ar: "تنبيه",
    };
    PlanSkeletonSchema.parse(skeleton);
    text = JSON.stringify(skeleton);
  } else {
    const day = Number(dayMatch[1]);
    const slice: DaySlice = {
      day_index: day,
      members: ids.map((id) => ({ member_id: id, meals: [freshBf(id, day), freshLunch()] })),
    };
    DaySliceSchema.parse(slice);
    text = JSON.stringify(slice);
  }
  return { text, tokensIn: 10, tokensOut: 20, stopReason: null };
}

describe("generateMealPlan — partial scope regenerate", () => {
  it("scope 'individual': regenerates the member's own meals; shared meals preserved byte-for-byte", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      mixedStreamReturns(systemPrompt),
    );
    const context = makeContext({ extraMember: true });
    const existing = makeMixedExistingPlan();

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan: existing,
      regenerateMemberId: "mom",
      regenScope: "individual",
    });

    const momDay0 = plan.members
      .find((m) => m.member_id === "mom")!
      .days.find((d) => d.day_index === 0)!;
    const momBf = momDay0.meals.find((m) => m.slot === "breakfast")!;
    const momLunch = momDay0.meals.find((m) => m.slot === "lunch")!;

    // Own breakfast regenerated…
    expect(momBf.recipe_name_ar).toContain("fresh");
    // …shared lunch untouched (same dish, still shared).
    const origMomLunch = existing.members
      .find((m) => m.member_id === "mom")!
      .days.find((d) => d.day_index === 0)!
      .meals.find((m) => m.slot === "lunch")!;
    expect(momLunch).toEqual(origMomLunch);
    expect(momLunch.recipe_name_ar).toBe("كبسة");
    expect(momLunch.shared_recipe).toBe(true);

    // member-2 (a co-sharer of the lunch, NOT the target) is entirely untouched.
    const childOut = plan.members.find((m) => m.member_id === "member-2")!;
    const childOrig = existing.members.find((m) => m.member_id === "member-2")!;
    expect(childOut.days).toEqual(childOrig.days);
  });

  it("scope 'shared': regenerates the shared dish across co-sharers; own meals preserved", async () => {
    mockedStream.mockImplementation(async ({ systemPrompt }) =>
      mixedStreamReturns(systemPrompt),
    );
    const context = makeContext({ extraMember: true });
    const existing = makeMixedExistingPlan();

    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context,
      existingPlan: existing,
      regenerateMemberId: "mom",
      regenScope: "shared",
    });

    const momDay0 = plan.members
      .find((m) => m.member_id === "mom")!
      .days.find((d) => d.day_index === 0)!;
    const childDay0 = plan.members
      .find((m) => m.member_id === "member-2")!
      .days.find((d) => d.day_index === 0)!;
    const momLunch = momDay0.meals.find((m) => m.slot === "lunch")!;
    const childLunch = childDay0.meals.find((m) => m.slot === "lunch")!;

    // Shared lunch regenerated to the NEW dish — and STILL one consistent batch
    // across both members (the invariant).
    expect(momLunch.recipe_name_ar).toBe("كبسة-جديدة");
    expect(childLunch.recipe_name_ar).toBe("كبسة-جديدة");
    expect(momLunch.shared_recipe).toBe(true);
    expect(childLunch.shared_recipe).toBe(true);
    expect(momLunch.per_member_portions!.map((p) => p.member_id).sort()).toEqual([
      "member-2",
      "mom",
    ]);
    expect(childLunch.per_member_portions!.map((p) => p.member_id).sort()).toEqual([
      "member-2",
      "mom",
    ]);

    // Each member's OWN breakfast is preserved byte-for-byte.
    const origMomBf = existing.members
      .find((m) => m.member_id === "mom")!
      .days.find((d) => d.day_index === 0)!
      .meals.find((m) => m.slot === "breakfast")!;
    expect(momDay0.meals.find((m) => m.slot === "breakfast")!).toEqual(origMomBf);
    const origChildBf = existing.members
      .find((m) => m.member_id === "member-2")!
      .days.find((d) => d.day_index === 0)!
      .meals.find((m) => m.slot === "breakfast")!;
    expect(childDay0.meals.find((m) => m.slot === "breakfast")!).toEqual(origChildBf);
  });
});
