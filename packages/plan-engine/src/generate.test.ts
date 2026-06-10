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
});
