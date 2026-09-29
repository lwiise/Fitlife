import { describe, it, expect, vi, beforeEach } from "vitest";

// «سارة عدّلت خطتك» across carry-over runs. Every drain/chain/sweeper refill and
// per-member regeneration mints a NEW meal_plans row; before the carry, a run
// whose skeleton said nothing (or never ran) wrote that row without
// week_changes, so Sara's note vanished mid-week. The rule under test: a run's
// own changes win; otherwise the SAME plan week's changes carry; never across
// weeks.

vi.mock("./anthropic", async () => {
  const actual = await vi.importActual<typeof import("./anthropic")>("./anthropic");
  return { ...actual, streamAnthropic: vi.fn() };
});

import { streamAnthropic } from "./anthropic";
import { generateMealPlan, resolveWeekChanges } from "./generate";
import type { PlanPromptContext } from "./buildContext";
import type { MealPlan, Day, Meal, DaySlice, PlanSkeleton } from "./schema";
import { MealPlanSchema, DaySliceSchema, PlanSkeletonSchema } from "./schema";

const mockedStream = vi.mocked(streamAnthropic);

const WEEK = "2026-06-06";
const DAY_INDICES = [0, 1, 2];

const OLD_CHANGES = [
  { change_ar: "فطور أخف في أيام الدوام", because_ar: "فات الفطور ٣ مرات الأسبوع الماضي" },
];
const NEW_CHANGES = [
  { change_ar: "عادت الكبسة يوم الجمعة", because_ar: "أحببتموها مرتين" },
  { change_ar: "لا شوفان هذا الأسبوع", because_ar: "قيّمتموه «لا تكرّريها»" },
];

// Calories and 4/4/9 macros agree (400 + 704 + 495 ≈ 1600) and sit on the
// 1600 target every fixture states, so neither the day band nor the Atwater
// repair perturbs a scripted run.
function makeMeal(recipeName: string): Meal {
  return {
    slot: "breakfast",
    slot_name_ar: "الفطور",
    recipe_name_ar: recipeName,
    ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
    prep_steps_ar: ["اخفقي البيض", "اطبخيه"],
    calories: 1600,
    macros: { protein_g: 100, carbs_g: 176, fat_g: 55 },
  };
}

function makeDay(dayIndex: number, recipeName: string): Day {
  return {
    day_index: dayIndex,
    day_name_ar: `اليوم ${dayIndex + 1}`,
    meals: [makeMeal(recipeName)],
    day_total: { calories: 1600, protein_g: 100, carbs_g: 176, fat_g: 55 },
  };
}

function makeMember(
  memberId: string,
  dayIndices: number[] = DAY_INDICES,
): MealPlan["members"][number] {
  return {
    member_id: memberId,
    member_name_ar: memberId,
    primary_goal: "fat_loss",
    daily_calories_target: 1600,
    macros_target: { protein_g: 100, carbs_g: 176, fat_g: 55 },
    days: dayIndices.map((di) => makeDay(di, `${memberId}-طبق-${di}`)),
  };
}

/** `null` = a prior plan with no week_changes (undefined would take the default). */
function makeExistingPlan(
  members: MealPlan["members"],
  weekChanges: MealPlan["week_changes"] | null = OLD_CHANGES,
): MealPlan {
  return MealPlanSchema.parse({
    week_start_date: WEEK,
    members,
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
    week_changes: weekChanges ?? undefined,
    days_total: DAY_INDICES.length,
    generating: false,
  });
}

function makeContext(opts?: { withChild?: boolean }): PlanPromptContext {
  const person = {
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
  };
  const family_members: PlanPromptContext["family_members"] = opts?.withChild
    ? [
        {
          ...person,
          id: "member-2",
          name: "لمى",
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
          feeding_mode: null,
        },
      ]
    : [];
  return {
    mom: {
      ...person,
      id: "user-1",
      display_name: "هند",
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

/** Skeleton prompt (no `day_index=`) → a skeleton carrying `skeletonChanges`;
 *  day prompt → a slice for exactly the members it names. */
function scripted(skeletonChanges: MealPlan["week_changes"]) {
  return async ({ systemPrompt }: { systemPrompt: string }) => {
    const found = [...systemPrompt.matchAll(/member_id="([^"]+)"/g)].map((m) => m[1]!);
    const ids = found.length > 0 ? found : ["mom"];
    const dayMatch = systemPrompt.match(/day_index=(\d+)/);
    let text: string;
    if (!dayMatch) {
      const skeleton: PlanSkeleton = {
        members: ids.map((id) => ({
          member_id: id,
          member_name_ar: id,
          primary_goal: "fat_loss",
          daily_calories_target: 1600,
          macros_target: { protein_g: 100, carbs_g: 176, fat_g: 55 },
          days: DAY_INDICES.map((di) => ({
            day_index: di,
            day_name_ar: `اليوم ${di + 1}`,
            meals: [
              { slot: "breakfast", slot_name_ar: "الفطور", recipe_name_ar: `${id}-fresh-${di}` },
            ],
          })),
        })),
        methodology_notes_ar: "ملاحظات",
        safety_disclaimer_ar: "تنبيه",
        ...(skeletonChanges ? { week_changes: skeletonChanges } : {}),
      };
      PlanSkeletonSchema.parse(skeleton);
      text = JSON.stringify(skeleton);
    } else {
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
  };
}

const isSkeletonCall = (call: (typeof mockedStream.mock.calls)[number]) =>
  !/day_index=\d+/.test(call[0]!.systemPrompt);

beforeEach(() => {
  mockedStream.mockReset();
});

describe("resolveWeekChanges — the carry rule", () => {
  const plan = (week: string, changes: MealPlan["week_changes"] | null): MealPlan => ({
    ...makeExistingPlan([makeMember("mom")], changes),
    week_start_date: week,
  });

  it("fresh plan (no existing plan) → the skeleton's changes only", () => {
    expect(resolveWeekChanges(NEW_CHANGES, null, WEEK)).toEqual(NEW_CHANGES);
    expect(resolveWeekChanges(undefined, null, WEEK)).toBeUndefined();
    expect(resolveWeekChanges(undefined, undefined, WEEK)).toBeUndefined();
  });

  it("same-week carry-over with no skeleton changes → carried", () => {
    expect(resolveWeekChanges(undefined, plan(WEEK, OLD_CHANGES), WEEK)).toEqual(OLD_CHANGES);
    // A skeleton that ran and said «nothing worth noting» is still no changes.
    expect(resolveWeekChanges([], plan(WEEK, OLD_CHANGES), WEEK)).toEqual(OLD_CHANGES);
  });

  it("same-week with new skeleton changes → the new ones", () => {
    expect(resolveWeekChanges(NEW_CHANGES, plan(WEEK, OLD_CHANGES), WEEK)).toEqual(NEW_CHANGES);
  });

  it("different week → never carried", () => {
    expect(resolveWeekChanges(undefined, plan("2026-05-30", OLD_CHANGES), WEEK)).toBeUndefined();
    expect(resolveWeekChanges([], plan("2026-05-30", OLD_CHANGES), WEEK)).toBeUndefined();
    // Its own changes are still its own.
    expect(resolveWeekChanges(NEW_CHANGES, plan("2026-05-30", OLD_CHANGES), WEEK)).toEqual(
      NEW_CHANGES,
    );
  });

  it("empty arrays → undefined", () => {
    expect(resolveWeekChanges([], null, WEEK)).toBeUndefined();
    expect(resolveWeekChanges([], plan(WEEK, []), WEEK)).toBeUndefined();
    expect(resolveWeekChanges(undefined, plan(WEEK, null), WEEK)).toBeUndefined();
  });
});

describe("generateMealPlan — week_changes on every assembled plan", () => {
  it("fresh plan: the skeleton's changes land on the final plan", async () => {
    mockedStream.mockImplementation(scripted(NEW_CHANGES));
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext(),
    });
    expect(mockedStream.mock.calls.some(isSkeletonCall)).toBe(true);
    expect(plan.week_changes).toEqual(NEW_CHANGES);
  });

  it("fresh plan with a silent skeleton: no changes, nothing invented", async () => {
    mockedStream.mockImplementation(scripted(undefined));
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext(),
    });
    expect(plan.week_changes).toBeUndefined();
  });

  it("zero-call fast path carries the week's changes", async () => {
    mockedStream.mockImplementation(async () => {
      throw new Error("streamAnthropic must not be called on the fast path");
    });
    const emitted: MealPlan[] = [];
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext(),
      existingPlan: makeExistingPlan([makeMember("mom")]),
      onProgress: (snap) => {
        emitted.push(snap);
      },
    });
    expect(mockedStream).not.toHaveBeenCalled();
    expect(plan.week_changes).toEqual(OLD_CHANGES);
    expect(emitted.every((s) => s.week_changes?.[0]?.change_ar === OLD_CHANGES[0]!.change_ar)).toBe(
      true,
    );
  });

  it("gap-fill refill (no skeleton call): every emit and the final plan carry the week's changes", async () => {
    mockedStream.mockImplementation(scripted(NEW_CHANGES)); // would leak if a skeleton ran
    const emitted: MealPlan[] = [];
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext({ withChild: true }),
      // member-2 is missing day 1; mom has it, so the family grid supplies the
      // dish and no skeleton is needed — the drain's typical shape.
      existingPlan: makeExistingPlan([makeMember("mom"), makeMember("member-2", [0, 2])]),
      onlyMemberId: "member-2",
      onProgress: (snap) => {
        emitted.push(snap);
      },
    });
    expect(mockedStream.mock.calls.some(isSkeletonCall)).toBe(false);
    expect(emitted.length).toBeGreaterThan(1);
    // The pre-skeleton shell is persisted too; it must not blink the note off.
    for (const snap of emitted) expect(snap.week_changes).toEqual(OLD_CHANGES);
    expect(plan.week_changes).toEqual(OLD_CHANGES);
  });

  it("same-week run whose skeleton ran silent: carried", async () => {
    mockedStream.mockImplementation(scripted([]));
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext({ withChild: true }),
      // member-2 is absent from the plan → it needs a skeleton.
      existingPlan: makeExistingPlan([makeMember("mom")]),
    });
    expect(mockedStream.mock.calls.some(isSkeletonCall)).toBe(true);
    expect(plan.week_changes).toEqual(OLD_CHANGES);
  });

  it("same-week run whose skeleton emitted changes: its own replace the carried ones", async () => {
    mockedStream.mockImplementation(scripted(NEW_CHANGES));
    const emitted: MealPlan[] = [];
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext({ withChild: true }),
      existingPlan: makeExistingPlan([makeMember("mom")]),
      onProgress: (snap) => {
        emitted.push(snap);
      },
    });
    // The shell (before the skeleton answers) still shows the week's note…
    expect(emitted[0]!.week_changes).toEqual(OLD_CHANGES);
    // …and the run's own changes win from the skeleton onward.
    expect(emitted.at(-1)!.week_changes).toEqual(NEW_CHANGES);
    expect(plan.week_changes).toEqual(NEW_CHANGES);
  });

  it("a prior plan with no changes carries nothing", async () => {
    mockedStream.mockImplementation(async () => {
      throw new Error("no call expected");
    });
    const { plan } = await generateMealPlan({
      anthropicApiKey: "test-key",
      context: makeContext(),
      existingPlan: makeExistingPlan([makeMember("mom")], null),
    });
    expect(plan.week_changes).toBeUndefined();
  });
});
