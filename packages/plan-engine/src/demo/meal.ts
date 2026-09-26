/**
 * Demo-mode meal replies: the JSON a real model would return for the skeleton
 * call and for each day call, built deterministically from the household and the
 * dish library. The engine parses these exactly like model output, so the band
 * check, rescale, shared-meal assembly, progressive persistence and every UI
 * surface downstream run their REAL code paths — only the model is absent.
 */

import type { PlanPromptContext } from "../buildContext";
import { isChildByAge } from "../childRule";
import { PRIMARY_GOALS, type Ingredient, type PlanSkeleton } from "../schema";
import { SLOT_NAME_AR } from "../slotNames";
import {
  DEMO_DISHES_BY_SLOT,
  DEMO_DISH_BY_NAME,
  type DemoDish,
  type DemoSlot,
} from "./dishes";

const WEEK_DAYS = 7;
const SLOTS: DemoSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const SLOT_WEIGHT: Record<DemoSlot, number> = {
  breakfast: 25,
  lunch: 35,
  dinner: 25,
  snack: 15,
};
const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

interface DemoPerson {
  member_id: string;
  name: string;
  sex: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  primary_goal: string | null;
  member_type: string;
  is_child: boolean;
  pregnant: boolean;
  shared: boolean;
}

function peopleOf(context: PlanPromptContext): DemoPerson[] {
  const mom = context.mom;
  const list: DemoPerson[] = [
    {
      member_id: "mom",
      name: mom.display_name ?? (mom.sex === "male" ? "العميل" : "العميلة"),
      sex: mom.sex,
      age: mom.age,
      weight_kg: mom.weight_kg,
      height_cm: mom.height_cm,
      activity_level: mom.activity_level,
      primary_goal: mom.primary_goal,
      member_type: mom.member_type,
      is_child: isChildByAge(mom.member_type, mom.age),
      pregnant: mom.is_pregnant,
      shared: mom.meal_mode !== "independent",
    },
  ];
  for (const m of context.family_members) {
    if (m.role === "housekeeper") continue;
    list.push({
      member_id: m.id,
      name: m.name,
      sex: m.sex,
      age: m.age,
      weight_kg: m.weight_kg,
      height_cm: m.height_cm,
      activity_level: m.activity_level,
      primary_goal: m.primary_goal,
      member_type: m.member_type,
      is_child: m.is_child || isChildByAge(m.member_type, m.age),
      pregnant: m.member_type === "pregnant",
      shared: m.meal_mode !== "independent",
    });
  }
  return list;
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Rough, clearly-demo targets: Mifflin-St Jeor × activity, goal-adjusted. */
function demoTargets(p: DemoPerson): {
  daily_calories_target: number;
  macros_target: { protein_g: number; carbs_g: number; fat_g: number };
} {
  const male = p.sex === "male";
  const weight = p.weight_kg ?? (p.is_child ? 35 : male ? 80 : 68);
  let kcal: number;
  if (p.is_child) {
    const age = p.age ?? 9;
    kcal = age < 9 ? 1400 : age < 14 ? (male ? 1800 : 1600) : male ? 2400 : 1900;
  } else {
    const height = p.height_cm ?? (male ? 175 : 162);
    const age = p.age ?? 35;
    const bmr = 10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161);
    kcal = bmr * (ACTIVITY_FACTOR[p.activity_level ?? "light"] ?? 1.375);
    if (p.primary_goal === "fat_loss") kcal *= 0.82;
    else if (p.primary_goal === "muscle_gain") kcal *= 1.1;
    if (p.pregnant) kcal += 340;
    if (p.member_type === "lactating") kcal += 400;
    kcal = Math.max(kcal, male ? 1600 : 1300);
  }
  kcal = round10(kcal);
  const protein = Math.round(
    Math.min(p.is_child ? weight * 1.1 : weight * 1.6, (kcal * 0.3) / 4),
  );
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    daily_calories_target: kcal,
    macros_target: { protein_g: protein, carbs_g: carbs, fat_g: fat },
  };
}

function dishFor(slot: DemoSlot, dayIndex: number, offset: number): DemoDish {
  const list = DEMO_DISHES_BY_SLOT[slot];
  return list[(dayIndex + offset) % list.length]!;
}

/** Skeleton reply: targets + a week of dish names for the requested members. */
export function demoSkeletonReply(
  context: PlanPromptContext,
  memberIds: string[],
): string {
  const people = peopleOf(context);
  const wanted = new Set(memberIds);
  // Shared members eat the same dishes (offset 0), so the engine assembles them
  // into family batches. Each independent member gets their own rotation.
  let independentSeen = 0;
  const offsetById = new Map<string, number>();
  for (const p of people) {
    offsetById.set(p.member_id, p.shared ? 0 : ++independentSeen * 2);
  }
  const skeleton: PlanSkeleton = {
    members: people
      .filter((p) => wanted.has(p.member_id))
      .map((p) => {
        const offset = offsetById.get(p.member_id) ?? 0;
        const goal = (PRIMARY_GOALS as readonly string[]).includes(p.primary_goal ?? "")
          ? (p.primary_goal as (typeof PRIMARY_GOALS)[number])
          : null;
        return {
          member_id: p.member_id,
          member_name_ar: p.name,
          primary_goal: p.is_child ? null : goal,
          ...demoTargets(p),
          days: Array.from({ length: WEEK_DAYS }, (_, d) => ({
            day_index: d,
            day_name_ar: "يوم",
            meals: SLOTS.map((slot) => ({
              slot,
              slot_name_ar: SLOT_NAME_AR[slot] ?? slot,
              recipe_name_ar: dishFor(slot, d, offset).name_ar,
            })),
          })),
        };
      }),
    methodology_notes_ar:
      "هذه خطة تجريبية من وضع العرض، أُعدّت من قائمة أطباق ثابتة لاختبار شكل التطبيق. الكميات والسعرات تقريبية، ولا تُعدّ توصية غذائية.",
    safety_disclaimer_ar:
      "خطة تجريبية لأغراض العرض فقط، ولا تغني عن استشارة الطبيب أو أخصائي التغذية.",
    week_changes: [
      {
        change_ar: "أضفنا طبق سمك ثانياً هذا الأسبوع",
        because_ar: "مثال تجريبي: قيّمتم الهامور المشوي بـ«نحبّها» الأسبوع الماضي",
      },
      {
        change_ar: "جعلنا عشاء الأحد أخفّ",
        because_ar: "مثال تجريبي: سُجّل عشاء الأحد «تجاوزتها» مرتين",
      },
    ],
  };
  return JSON.stringify(skeleton);
}

const FALLBACK_DISH = (name: string, slot: DemoSlot): DemoDish => ({
  name_ar: name,
  name_en: name,
  slot,
  base_kcal: 400,
  prep_minutes: 10,
  cook_minutes: 20,
  ingredients: [
    { ar: "مكونات الطبق حسب الوصفة المعتادة", en: "Ingredients as usual", amount: 1, unit: "serving" },
  ],
  steps: [
    {
      ar: "حضّري الطبق بالطريقة المعتادة مع الالتزام بحجم الحصة.",
      en: "Prepare the dish as usual, keeping to the portion size.",
    },
  ],
});

function scaleAmount(amount: number, unit: Ingredient["unit"], factor: number): number {
  const v = amount * factor;
  switch (unit) {
    case "g":
    case "ml":
      return Math.max(5, Math.round(v / 5) * 5);
    case "piece":
      return Math.max(0.5, Math.round(v * 2) / 2);
    case "tbsp":
    case "tsp":
    case "cup":
      return Math.max(0.25, Math.round(v * 4) / 4);
    case "unlimited":
    case "serving":
      return amount;
    default:
      return Math.round(v * 100) / 100;
  }
}

/** Day reply: every requested member's meals for `dayIndex`, per the skeleton. */
export function demoDayReply(skeleton: PlanSkeleton, dayIndex: number): string {
  const members = skeleton.members.flatMap((m) => {
    const day = m.days.find((d) => d.day_index === dayIndex);
    if (!day) return [];
    const target = m.daily_calories_target > 0 ? m.daily_calories_target : 1800;
    const macros =
      m.macros_target.protein_g > 0
        ? m.macros_target
        : { protein_g: 90, carbs_g: 200, fat_g: 60 };
    const totalWeight = day.meals.reduce(
      (s, meal) => s + (SLOT_WEIGHT[meal.slot as DemoSlot] ?? 20),
      0,
    );
    const meals = day.meals.map((meal) => {
      const slot = meal.slot as DemoSlot;
      const share = (SLOT_WEIGHT[slot] ?? 20) / totalWeight;
      const calories = Math.round(target * share);
      const protein = Math.round(macros.protein_g * share);
      const fat = Math.round(macros.fat_g * share);
      const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
      const dish = DEMO_DISH_BY_NAME.get(meal.recipe_name_ar) ?? FALLBACK_DISH(meal.recipe_name_ar, slot);
      const factor = calories / dish.base_kcal;
      return {
        slot,
        recipe_name_ar: dish.name_ar,
        ingredients: dish.ingredients.map((g) => ({
          name_ar: g.ar,
          amount: scaleAmount(g.amount, g.unit, factor),
          unit: g.unit,
        })),
        prep_steps_ar: dish.steps.map((s) => s.ar),
        calories,
        macros: { protein_g: protein, carbs_g: carbs, fat_g: fat },
        ...(dish.notes_ar ? { notes_ar: dish.notes_ar } : {}),
      };
    });
    return [{ member_id: m.member_id, meals }];
  });
  return JSON.stringify({ day_index: dayIndex, members });
}
