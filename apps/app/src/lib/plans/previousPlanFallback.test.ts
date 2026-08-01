import { describe, it, expect } from "vitest";
import { planHasContent, MealPlanSchema } from "@fitlife/plan-engine";
import { resolveStaleness } from "./staleness";

/**
 * A regeneration that comes back EMPTY must not hide the week the household
 * already has.
 *
 * Production: adding a third member triggers a full shared-group rebuild; that
 * run produced zero days, was written `failed`, and — being the newest row —
 * replaced a complete 7/7 plan with an error screen on /plan and /dashboard.
 * The good plan was never deleted, only shadowed, and because
 * `DeferredMemberDrain` requires status "ready" it could not self-heal either.
 *
 * getLatestPlan now reads two rows and falls back. These tests pin the decision
 * rule it applies (the query itself is server-only).
 */

function plan(filledDays: number, memberIds = ["mom"]) {
  return {
    week_start_date: "2026-08-01",
    days_total: 7,
    generating: false,
    members: memberIds.map((id, i) => ({
      member_id: id,
      member_name_ar: i === 0 ? "هند" : id,
      primary_goal: "fat_loss" as const,
      daily_calories_target: 1600,
      macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
      days: Array.from({ length: 7 }, (_, d) => ({
        day_index: d,
        day_name_ar: `اليوم ${d + 1}`,
        meals:
          d < filledDays
            ? [
                {
                  slot: "lunch" as const,
                  slot_name_ar: "الغداء",
                  recipe_name_ar: `طبق ${d}`,
                  ingredients: [{ name_ar: "دجاج", amount: 200, unit: "g" }],
                  prep_steps_ar: ["اطبخي الدجاج"],
                  calories: 1600,
                  macros: { protein_g: 100, carbs_g: 140, fat_g: 55 },
                },
              ]
            : [],
        day_total:
          d < filledDays
            ? { calories: 1600, protein_g: 100, carbs_g: 140, fat_g: 55 }
            : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      })),
    })),
  };
}

/** The rule getLatestPlan applies when the newest row is failed-and-empty. */
function shouldServePrevious(
  newest: { status: string; planData: unknown },
  previous?: { status: string; planData: unknown },
): boolean {
  const newestResolved = resolveStaleness({
    status: newest.status as "ready" | "failed" | "generating",
    planData: null,
    updatedAt: new Date().toISOString(),
    errorMessage: null,
  });
  if (!(newestResolved.status === "failed" && !newestResolved.planData)) return false;
  if (!previous || previous.status !== "ready") return false;
  const parsed = MealPlanSchema.safeParse(previous.planData);
  return parsed.success && planHasContent(parsed.data);
}

describe("previous-plan fallback", () => {
  it("serves the previous week when the newest run came back empty", () => {
    expect(
      shouldServePrevious(
        { status: "failed", planData: null },
        { status: "ready", planData: plan(7, ["mom", "m1"]) },
      ),
    ).toBe(true);
  });

  it("does not fall back when the newest plan is healthy", () => {
    expect(
      shouldServePrevious(
        { status: "ready", planData: plan(7) },
        { status: "ready", planData: plan(7) },
      ),
    ).toBe(false);
  });

  it("does not fall back to a previous plan that is itself empty", () => {
    expect(
      shouldServePrevious(
        { status: "failed", planData: null },
        { status: "ready", planData: plan(0) },
      ),
    ).toBe(false);
  });

  it("does not fall back to a previous plan that also failed", () => {
    expect(
      shouldServePrevious(
        { status: "failed", planData: null },
        { status: "failed", planData: plan(7) },
      ),
    ).toBe(false);
  });

  it("does not fall back when there is no previous plan at all", () => {
    expect(shouldServePrevious({ status: "failed", planData: null }, undefined)).toBe(
      false,
    );
  });

  it("keeps a PARTIAL newest plan rather than reaching backwards", () => {
    // resolveStaleness already surfaces a partial week as ready-with-content;
    // the drain builds on it, so the fallback must not preempt that path.
    const resolved = resolveStaleness({
      status: "ready",
      planData: MealPlanSchema.parse(plan(2)),
      updatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      errorMessage: null,
    });
    expect(resolved.status).toBe("ready");
    expect(resolved.planData).not.toBeNull();
  });
});
