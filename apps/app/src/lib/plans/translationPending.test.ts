import { describe, it, expect } from "vitest";
import type { MealPlan } from "@fitlife/plan-engine";

/**
 * The housekeeper's cooking instructions had no retry of any kind.
 *
 * Adding a maid fires `triggerPlanTranslation`, which deliberately no-ops while
 * a generation is live because "the freshly-generated plan lands already
 * translated". But the generation only translates if budget REMAINS after its
 * day loop, and at five beneficiaries the loop routinely spends the whole
 * 15-minute box. Observed on a real household: maid added mid-generation, plan
 * finished `ready`, zero translated meals, no housekeeper view, and nothing
 * anywhere saying the product's headline feature had not happened.
 *
 * `drainDeferredMembers` now retries it on the same page-visit loop that fills
 * missing days. This pins the "is it still pending?" rule it uses.
 */

function planIsTranslated(plan: MealPlan, locale: string): boolean {
  const meals = plan.members.flatMap((m) => m.days.flatMap((d) => d.meals));
  if (meals.length === 0) return true;
  return meals.every((meal) => meal.prep_steps_translated_locale === locale);
}

function makePlan(opts: { meals: Array<string | undefined> }): MealPlan {
  return {
    week_start_date: "2026-08-01",
    days_total: 7,
    generating: false,
    members: [
      {
        member_id: "mom",
        member_name_ar: "هند",
        primary_goal: "fat_loss",
        daily_calories_target: 1600,
        macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
        days: [
          {
            day_index: 0,
            day_name_ar: "السبت",
            meals: opts.meals.map((loc) => ({
              slot: "lunch",
              slot_name_ar: "الغداء",
              recipe_name_ar: "دجاج",
              ingredients: [{ name_ar: "دجاج", amount: 200, unit: "g" }],
              prep_steps_ar: ["اطبخي"],
              calories: 600,
              macros: { protein_g: 40, carbs_g: 50, fat_g: 20 },
              ...(loc ? { prep_steps_translated_locale: loc } : {}),
            })),
            day_total: { calories: 600, protein_g: 40, carbs_g: 50, fat_g: 20 },
          },
        ],
      },
    ],
  } as unknown as MealPlan;
}

describe("translation pending", () => {
  it("is pending when no meal carries the locale", () => {
    expect(planIsTranslated(makePlan({ meals: [undefined, undefined] }), "tl")).toBe(
      false,
    );
  });

  it("is done when every meal carries it", () => {
    expect(planIsTranslated(makePlan({ meals: ["tl", "tl"] }), "tl")).toBe(true);
  });

  it("treats a HALF-translated plan as still pending, so it gets finished", () => {
    // A run that translated some meals and then hit its deadline must not look
    // complete, or the remainder is stranded forever.
    expect(planIsTranslated(makePlan({ meals: ["tl", undefined] }), "tl")).toBe(false);
  });

  it("treats a plan translated into a DIFFERENT language as pending", () => {
    // Her language changed; the old translation does not count.
    expect(planIsTranslated(makePlan({ meals: ["id", "id"] }), "tl")).toBe(false);
  });

  it("does not consider an empty plan pending — there is nothing to translate", () => {
    expect(planIsTranslated(makePlan({ meals: [] }), "tl")).toBe(true);
  });
});
