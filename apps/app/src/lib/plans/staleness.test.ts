import { describe, it, expect } from "vitest";
import type { MealPlan } from "@fitlife/plan-engine";

import { resolveStaleness, STALE_GENERATION_MIN } from "./staleness";

const NOW = Date.parse("2026-07-27T16:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function makePlan(opts: {
  filledDays: number;
  generating?: boolean;
  members?: number;
}): MealPlan {
  const members = Array.from({ length: opts.members ?? 1 }, (_, i) => ({
    member_id: i === 0 ? "mom" : `member-${i}`,
    member_name_ar: i === 0 ? "الجازي" : `فرد ${i}`,
    primary_goal: "fat_loss" as const,
    daily_calories_target: 1600,
    macros_target: { protein_g: 100, carbs_g: 140, fat_g: 55 },
    days: Array.from({ length: 7 }, (_, d) => ({
      day_index: d,
      day_name_ar: `اليوم ${d + 1}`,
      meals:
        d < opts.filledDays
          ? [
              {
                slot: "breakfast" as const,
                slot_name_ar: "الفطور",
                recipe_name_ar: `طبق ${d}`,
                ingredients: [{ name_ar: "بيض", amount: 2, unit: "piece" }],
                prep_steps_ar: ["اخفقي البيض"],
                calories: 1600,
                macros: { protein_g: 100, carbs_g: 140, fat_g: 55 },
              },
            ]
          : [],
      day_total:
        d < opts.filledDays
          ? { calories: 1600, protein_g: 100, carbs_g: 140, fat_g: 55 }
          : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    })),
  }));
  return {
    week_start_date: "2026-07-26",
    members,
    days_total: 7,
    generating: opts.generating ?? true,
  } as MealPlan;
}

describe("resolveStaleness — a live run is left alone", () => {
  it("passes a fresh in-flight plan straight through", () => {
    const planData = makePlan({ filledDays: 3 });
    const out = resolveStaleness({
      status: "ready",
      planData,
      updatedAt: minutesAgo(1),
      errorMessage: null,
      now: NOW,
    });
    expect(out.status).toBe("ready");
    expect(out.planData).toBe(planData);
    expect(out.inProgress).toBe(true);
  });

  it("stays live right up to the threshold, and only then reacts", () => {
    const base = {
      status: "ready" as const,
      planData: makePlan({ filledDays: 3 }),
      errorMessage: null,
      now: NOW,
    };
    expect(
      resolveStaleness({ ...base, updatedAt: minutesAgo(STALE_GENERATION_MIN - 1) })
        .inProgress,
    ).toBe(true);
    expect(
      resolveStaleness({ ...base, updatedAt: minutesAgo(STALE_GENERATION_MIN) }).inProgress,
    ).toBe(false);
  });

  it("does not touch a finished plan, however old", () => {
    const planData = makePlan({ filledDays: 7, generating: false });
    const out = resolveStaleness({
      status: "ready",
      planData,
      updatedAt: minutesAgo(60 * 24 * 30),
      errorMessage: null,
      now: NOW,
    });
    expect(out.status).toBe("ready");
    expect(out.planData).toBe(planData);
  });
});

describe("resolveStaleness — a dead run keeps the days it produced", () => {
  // The regression this pins: a 4-member household killed at 4 of 7 days used to
  // have all four discarded, so the customer waited ~28 minutes and got a generic
  // failure, and the retry re-spent the whole API budget from zero.
  it("keeps a partial week and surfaces it as ready, not failed", () => {
    const out = resolveStaleness({
      status: "ready",
      planData: makePlan({ filledDays: 4, members: 4 }),
      updatedAt: minutesAgo(20),
      errorMessage: null,
      now: NOW,
    });

    expect(out.status).toBe("ready");
    expect(out.planData).not.toBeNull();
    const mom = out.planData!.members.find((m) => m.member_id === "mom")!;
    expect(mom.days.filter((d) => d.meals.length > 0)).toHaveLength(4);
  });

  it("clears `generating` so the viewer stops waiting on days that will never arrive", () => {
    const out = resolveStaleness({
      status: "ready",
      planData: makePlan({ filledDays: 4, generating: true }),
      updatedAt: minutesAgo(20),
      errorMessage: null,
      now: NOW,
    });
    expect(out.inProgress).toBe(false);
    expect(out.planData!.generating).toBe(false);
  });

  it("leaves the source plan object unmutated", () => {
    const planData = makePlan({ filledDays: 4, generating: true });
    resolveStaleness({
      status: "ready",
      planData,
      updatedAt: minutesAgo(20),
      errorMessage: null,
      now: NOW,
    });
    expect(planData.generating).toBe(true);
  });

  it("recovers a stale row still marked 'generating', not just a ready shell", () => {
    const out = resolveStaleness({
      status: "generating",
      planData: makePlan({ filledDays: 2 }),
      updatedAt: minutesAgo(20),
      errorMessage: null,
      now: NOW,
    });
    expect(out.status).toBe("ready");
    expect(out.planData).not.toBeNull();
  });
});

describe("resolveStaleness — nothing to show still fails honestly", () => {
  it("fails an empty shell, because there is nothing to render and nothing to build on", () => {
    const out = resolveStaleness({
      status: "ready",
      planData: makePlan({ filledDays: 0 }),
      updatedAt: minutesAgo(20),
      errorMessage: null,
      now: NOW,
    });
    expect(out.status).toBe("failed");
    expect(out.planData).toBeNull();
    expect(out.errorMessage).toMatch(/تعذّر/);
  });

  it("fails when there is no plan row content at all", () => {
    const out = resolveStaleness({
      status: "generating",
      planData: null,
      updatedAt: minutesAgo(20),
      errorMessage: null,
      now: NOW,
    });
    expect(out.status).toBe("failed");
  });

  it("keeps a real error message rather than replacing it with the generic one", () => {
    const out = resolveStaleness({
      status: "generating",
      planData: null,
      updatedAt: minutesAgo(20),
      errorMessage: "Anthropic API 429",
      now: NOW,
    });
    expect(out.errorMessage).toBe("Anthropic API 429");
  });

  it("treats an unparseable updated_at as infinitely old rather than infinitely live", () => {
    const out = resolveStaleness({
      status: "generating",
      planData: null,
      updatedAt: "not-a-date",
      errorMessage: null,
      now: NOW,
    });
    expect(out.status).toBe("failed");
  });
});
