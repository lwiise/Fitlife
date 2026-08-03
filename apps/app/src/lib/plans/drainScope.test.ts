import { describe, it, expect } from "vitest";
import { MEMBER_GEN_MAX_ATTEMPTS, type MealPlan } from "@fitlife/plan-engine";
import { incompleteInPlanMemberIds } from "./drainScope";

/**
 * A week that stopped at 4 of 7 took five drain rounds to finish.
 *
 * `pickNextMemberId` returns ONE member and the run targets only them, so a
 * household where five people are each missing the same three days needed five
 * separate invocations — each waiting on a page visit to dispatch, each holding
 * the generation lock for its duration. The engine has always supported filling
 * every incomplete member in one carry-over run (`membersToGenerate` is
 * `beneficiaries.filter((b) => !isComplete(b))` when no `onlyMemberId` is
 * given); the drain simply never asked for it.
 */

type Member = MealPlan["members"][number];

function member(id: string, filledDays: number): Member {
  return {
    member_id: id,
    member_name_ar: id,
    primary_goal: "fat_loss",
    daily_calories_target: 1600,
    macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
    days: Array.from({ length: 7 }, (_, i) => ({
      day_index: i,
      day_name_ar: `يوم ${i}`,
      day_total: { calories: 600, protein_g: 40, carbs_g: 50, fat_g: 20 },
      meals:
        i < filledDays
          ? [
              {
                slot: "lunch",
                slot_name_ar: "الغداء",
                recipe_name_ar: "دجاج",
                ingredients: [{ name_ar: "دجاج", amount: 200, unit: "g" }],
                prep_steps_ar: ["اطبخي"],
                calories: 600,
                macros: { protein_g: 40, carbs_g: 50, fat_g: 20 },
              },
            ]
          : [],
    })),
  } as unknown as Member;
}

const plan = (members: Member[], gen_attempts?: Record<string, number>): MealPlan =>
  ({
    week_start_date: "2026-08-01",
    days_total: 7,
    generating: false,
    members,
    ...(gen_attempts ? { gen_attempts } : {}),
  }) as unknown as MealPlan;

const gaps = (p: MealPlan) =>
  incompleteInPlanMemberIds({ plan: p, maxAttempts: MEMBER_GEN_MAX_ATTEMPTS });

describe("incompleteInPlanMemberIds", () => {
  it("names everyone still short of a full week", () => {
    // The measured shape: a run stopped at 4 of 7 for the whole household.
    const p = plan([
      member("mom", 4),
      member("dad", 4),
      member("saud", 4),
      member("lama", 4),
      member("noura", 4),
    ]);
    expect(gaps(p)).toHaveLength(5);
  });

  it("is empty for a finished week, so the drain does not fire", () => {
    expect(gaps(plan([member("mom", 7), member("dad", 7)]))).toEqual([]);
  });

  it("returns ONE when only one person is short — the old single-member path", () => {
    expect(gaps(plan([member("mom", 7), member("dad", 5)]))).toEqual(["dad"]);
  });

  it("skips a member who has burned the retry cap", () => {
    // A deterministically-failing day must not keep the household in the drain
    // forever; the existing cap is the same one pickNextMemberId honours.
    const p = plan([member("mom", 7), member("dad", 5)], {
      dad: MEMBER_GEN_MAX_ATTEMPTS,
    });
    expect(gaps(p)).toEqual([]);
  });

  it("honours a plan that is not seven days long", () => {
    const p = { ...plan([member("mom", 3)]), days_total: 3 } as MealPlan;
    expect(gaps(p)).toEqual([]);
  });

  it("only ever names members already IN the plan", () => {
    // An absent member is a different job — skeleton, and a shared newcomer
    // needs the whole shared group rebuilt. Mixing them into one run is exactly
    // what regenerateSharedGroup exists for, so they must not appear here.
    const p = plan([member("mom", 4)]);
    expect(gaps(p)).toEqual(["mom"]);
  });
});
