import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PlanPromptContext, PlanPromptContextMember } from "../buildContext";
import { generateMealPlan, translateMealPlan } from "../generate";
import { generateWorkoutPlan } from "../workout/generate";
import { streamAnthropic } from "../anthropic";
import { MealPlanSchema } from "../schema";
import { DEMO_API_KEY, isDemoApiKey, isDemoEmail, demoAiEmailList } from "./index";

// Any network call in demo mode is a bug: the whole point is $0 and no model.
const fetchSpy = vi.fn(() => {
  throw new Error("demo mode must not call fetch");
});
let realFetch: typeof fetch;

beforeAll(() => {
  process.env.DEMO_AI_DELAY_MS = "0";
  realFetch = globalThis.fetch;
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  delete process.env.DEMO_AI_DELAY_MS;
});

function member(over: Partial<PlanPromptContextMember>): PlanPromptContextMember {
  return {
    id: "m",
    name: "فرد",
    role: "husband",
    member_type: "adult",
    sex: "male",
    age: 40,
    height_cm: 178,
    weight_kg: 85,
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
    ...over,
  };
}

function familyContext(): PlanPromptContext {
  return {
    mom: {
      id: "user-1",
      display_name: "هند",
      sex: "female",
      member_type: "adult",
      age: 36,
      height_cm: 163,
      weight_kg: 74,
      activity_level: "light",
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
      target_weight_kg: 65,
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
      workout_profile: {
        location: "gym",
        equipment: [],
        injuries: [],
        desired_days: 4,
        preferred_days: [0, 1, 3, 4],
        focus_areas: ["full_body"],
        experience: "beginner",
        session_minutes: "m30_45",
      },
    },
    family_members: [
      member({ id: "husband", name: "فهد" }),
      member({
        id: "kid",
        name: "لمى",
        role: "daughter",
        member_type: "child",
        sex: "female",
        age: 10,
        height_cm: 140,
        weight_kg: 33,
        primary_goal: null,
        is_child: true,
      }),
      member({
        id: "grandma",
        name: "أم فهد",
        role: "grandmother",
        sex: "female",
        age: 68,
        height_cm: 155,
        weight_kg: 70,
        activity_level: "sedentary",
        primary_goal: "general_health",
        meal_mode: "independent",
      }),
    ],
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

describe("demo account gate", () => {
  it("matches exact addresses and *@domain patterns, case-insensitively", () => {
    const list = demoAiEmailList("Demo@Fit.test, *@demo.fitlife.sa  other@x.com");
    expect(isDemoEmail("demo@fit.test", list)).toBe(true);
    expect(isDemoEmail("anyone@demo.fitlife.sa", list)).toBe(true);
    expect(isDemoEmail("OTHER@x.com", list)).toBe(true);
    expect(isDemoEmail("real@gmail.com", list)).toBe(false);
    expect(isDemoEmail("x@notdemo.fitlife.sa.evil.com", list)).toBe(false);
  });

  it("is off for everyone when the list is empty", () => {
    expect(isDemoEmail("demo@fit.test", demoAiEmailList(""))).toBe(false);
    expect(isDemoEmail(null, ["demo@fit.test"])).toBe(false);
  });

  it("only the sentinel key is a demo key", () => {
    expect(isDemoApiKey(DEMO_API_KEY)).toBe(true);
    expect(isDemoApiKey("sk-ant-real")).toBe(false);
  });
});

describe("demo meal generation runs the real engine", () => {
  it("builds a full, valid 7-day family week with shared batches and on-target adults", async () => {
    const context = familyContext();
    // A clean demo run needs no re-rolls, repairs or deferrals: any engine
    // warning means the demo replies drifted from what the engine accepts.
    const warn = vi.spyOn(console, "warn");
    const result = await generateMealPlan({ anthropicApiKey: DEMO_API_KEY, context });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();

    expect(result.missingDays).toEqual([]);
    expect(result.usage.cost_usd).toBe(0);
    expect(MealPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.plan.members.map((m) => m.member_id).sort()).toEqual(
      ["grandma", "husband", "kid", "mom"],
    );
    for (const m of result.plan.members) {
      expect(m.days).toHaveLength(7);
      for (const d of m.days) expect(d.meals).toHaveLength(4);
    }

    // Shared members were merged into family batches by the engine itself.
    const mom = result.plan.members.find((m) => m.member_id === "mom")!;
    const sharedLunch = mom.days[0]!.meals.find((meal) => meal.slot === "lunch")!;
    expect(sharedLunch.shared_recipe).toBe(true);
    expect(sharedLunch.per_member_portions?.map((p) => p.member_id).sort()).toEqual(
      ["husband", "kid", "mom"],
    );

    // The independent member eats their own dish.
    const grandma = result.plan.members.find((m) => m.member_id === "grandma")!;
    const grandmaLunch = grandma.days[0]!.meals.find((meal) => meal.slot === "lunch")!;
    expect(grandmaLunch.recipe_name_ar).not.toBe(sharedLunch.recipe_name_ar);

    // Adults land inside the engine's own ±10% calorie band every day.
    for (const m of result.plan.members.filter((x) => !x.is_child)) {
      for (const d of m.days) {
        const dev = Math.abs(d.day_total.calories - m.daily_calories_target);
        expect(dev).toBeLessThanOrEqual(m.daily_calories_target * 0.1);
      }
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("translates the week for the housekeeper without a model call", async () => {
    const { plan } = await generateMealPlan({
      anthropicApiKey: DEMO_API_KEY,
      context: familyContext(),
    });
    const { plan: translated, usage } = await translateMealPlan({
      anthropicApiKey: DEMO_API_KEY,
      plan,
      locale: "en",
    });
    expect(usage.cost_usd).toBe(0);
    const meal = translated.members[0]!.days[0]!.meals[0]!;
    expect(meal.prep_steps_translated_locale).toBe("en");
    expect(meal.recipe_name_translated).toMatch(/[A-Za-z]/);
    expect(meal.prep_steps_translated?.length).toBe(meal.prep_steps_ar.length);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("demo workout generation", () => {
  it("builds a program on the trainee's chosen days that passes the engine's fit rules", async () => {
    const warn = vi.spyOn(console, "warn");
    const result = await generateWorkoutPlan({
      anthropicApiKey: DEMO_API_KEY,
      context: familyContext(),
      weekStartDate: "2026-09-27",
    });
    // No re-roll or equipment repair: the demo program is legal as emitted.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    expect(result.missingMembers).toEqual([]);
    const mom = result.plan.members[0]!;
    expect(mom.weekly_sessions.map((s) => s.day_index)).toEqual([0, 1, 3, 4]);
    for (const s of mom.weekly_sessions) {
      expect(s.exercises.length).toBeGreaterThan(0);
      for (const ex of s.exercises) expect(ex.exercise_id).toBeTruthy();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("demo workout generation across profiles", () => {
  const cases = [
    { location: "home", equipment: ["none"], desired_days: 3, injuries: ["knee"] },
    { location: "both", equipment: ["dumbbells", "bands"], desired_days: 5, injuries: [] },
    { location: "gym", equipment: [], desired_days: 6, injuries: ["shoulder"] },
  ] as const;
  for (const c of cases) {
    it(`needs no repair for ${c.location} / ${c.desired_days} days`, async () => {
      const context = familyContext();
      context.mom.workout_profile = {
        ...context.mom.workout_profile!,
        location: c.location,
        equipment: [...c.equipment],
        injuries: [...c.injuries],
        desired_days: c.desired_days,
        preferred_days: null,
      };
      const warn = vi.spyOn(console, "warn");
      const result = await generateWorkoutPlan({
        anthropicApiKey: DEMO_API_KEY,
        context,
        weekStartDate: "2026-09-27",
      });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
      expect(result.plan.members[0]!.weekly_sessions).toHaveLength(c.desired_days);
    });
  }
});

describe("demo chat and unknown calls", () => {
  it("streams a labelled demo reply", async () => {
    const chunks: string[] = [];
    const res = await streamAnthropic({
      apiKey: DEMO_API_KEY,
      model: "x",
      maxTokens: 100,
      systemPrompt: "",
      onText: (d) => chunks.push(d),
      demo: { kind: "chat", messages: [{ role: "user", content: "كم سعرة في عشائي؟" }] },
    });
    expect(chunks.join("")).toBe(res.text);
    expect(res.text).toContain("وضع العرض");
    expect(res.text).not.toMatch(/[!*#]/);
  });

  it("refuses a demo-key call that carries no demo hint", async () => {
    await expect(
      streamAnthropic({ apiKey: DEMO_API_KEY, model: "x", maxTokens: 10, systemPrompt: "" }),
    ).rejects.toThrow(/demo mode/);
  });
});
