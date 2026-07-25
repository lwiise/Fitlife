import { describe, it, expect } from "vitest";
import {
  resolveHousekeeperLocale,
  planNeedsTranslation,
  translationMemberIds,
  partialPlanNote,
} from "./generate";
import type { MealPlan } from "./schema";

/**
 * The end-of-run completion decisions, shared by runMealPlanGeneration (dev,
 * inline, SDK) and the Netlify background function (prod, SDK-free fetch).
 * These two runners had already forked once — see translationMemberIds below.
 */

function planWith(locales: (string | null)[]): MealPlan {
  return {
    members: [
      {
        days: [
          {
            meals: locales.map((l) => ({ prep_steps_translated_locale: l })),
          },
        ],
      },
    ],
  } as unknown as MealPlan;
}

describe("resolveHousekeeperLocale", () => {
  it("returns a supported non-Arabic locale", () => {
    expect(resolveHousekeeperLocale("en")).toBe("en");
    expect(resolveHousekeeperLocale("ur")).toBe("ur");
  });

  it("returns undefined for Arabic — it is the source language", () => {
    expect(resolveHousekeeperLocale("ar")).toBeUndefined();
  });

  it("ignores an unknown locale rather than trusting it", () => {
    expect(resolveHousekeeperLocale("klingon")).toBeUndefined();
    expect(resolveHousekeeperLocale("")).toBeUndefined();
    expect(resolveHousekeeperLocale(null)).toBeUndefined();
    expect(resolveHousekeeperLocale(undefined)).toBeUndefined();
  });
});

describe("planNeedsTranslation", () => {
  it("is false without a target locale", () => {
    expect(planNeedsTranslation(planWith([null]), undefined)).toBe(false);
  });

  it("is true when any meal is not yet in the target locale", () => {
    expect(planNeedsTranslation(planWith(["en", null]), "en")).toBe(true);
    expect(planNeedsTranslation(planWith(["ur"]), "en")).toBe(true);
  });

  it("is false once every meal is translated — a born-translated plan", () => {
    expect(planNeedsTranslation(planWith(["en", "en"]), "en")).toBe(false);
  });
});

describe("translationMemberIds", () => {
  const rows = [
    { id: "a", role: "member" },
    { id: "b", role: "member" },
    { id: "hk", role: "housekeeper" },
  ];

  it("excludes the housekeeper — she cooks, she is not a beneficiary", () => {
    expect(translationMemberIds(rows)).toEqual(["a", "b"]);
  });

  it("narrows to the tier-capped allow-list", () => {
    // THE regression this guards. On a capped run the deferred members are
    // deliberately absent from the plan, so counting them would leave
    // hasPendingGeneration permanently true and the housekeeper would never
    // receive a translated plan. The background function narrowed this set;
    // runMealPlanGeneration did not.
    expect(translationMemberIds(rows, ["a"])).toEqual(["a"]);
  });

  it("treats an empty allow-list as covering nobody, not everybody", () => {
    expect(translationMemberIds(rows, [])).toEqual([]);
  });

  it("ignores allow-listed ids that are not family members", () => {
    expect(translationMemberIds(rows, ["a", "ghost"])).toEqual(["a"]);
  });
});

describe("partialPlanNote", () => {
  it("is null for a whole plan", () => {
    expect(partialPlanNote([])).toBeNull();
  });

  it("records day indices only — never recipe or member content", () => {
    expect(partialPlanNote([2, 5])).toBe("partial: days [2, 5] failed");
  });

  it("appends a cause when one is known", () => {
    expect(partialPlanNote([3], "schema validation")).toBe(
      "partial: days [3] failed — schema validation",
    );
  });

  it("omits the cause separator when the cause is empty", () => {
    expect(partialPlanNote([3], "")).toBe("partial: days [3] failed");
  });
});
