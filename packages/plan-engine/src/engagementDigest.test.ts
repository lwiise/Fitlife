import { describe, expect, it } from "vitest";

import { canonicalRecipeKey } from "./canonicalRecipeKey";
import {
  computeEngagementDigest,
  engagementText,
  GOLDEN_LOVED_THRESHOLD,
  MIN_SIGNAL_EVENTS,
  type EngagementCheckinRow,
  type EngagementVerdictRow,
} from "./engagementDigest";
import { MealPlanSchema, PlanSkeletonSchema } from "./schema";

function checkin(
  overrides: Partial<EngagementCheckinRow> = {},
): EngagementCheckinRow {
  return { slot: "lunch", status: "cooked", reason: null, ...overrides };
}

function verdict(
  name: string,
  v: string,
  key?: string,
): EngagementVerdictRow {
  return {
    recipe_name_ar: name,
    canonical_key: key ?? canonicalRecipeKey(name),
    verdict: v,
  };
}

describe("computeEngagementDigest", () => {
  it("returns undefined below the minimum-signal floor (silence beats fabrication)", () => {
    const few = Array.from({ length: MIN_SIGNAL_EVENTS - 1 }, () => checkin());
    expect(computeEngagementDigest(few, [])).toBeUndefined();
    expect(computeEngagementDigest([], [])).toBeUndefined();
  });

  it("counts cooked/swapped and only ≥2 skips per slot (single skip is noise)", () => {
    const digest = computeEngagementDigest(
      [
        checkin(),
        checkin(),
        checkin({ status: "swapped", reason: "guests" }),
        checkin({ slot: "breakfast", status: "skipped", reason: "no_time" }),
        checkin({ slot: "breakfast", status: "skipped", reason: "no_time" }),
        checkin({ slot: "dinner", status: "skipped" }),
      ],
      [],
    );
    expect(digest).toBeDefined();
    expect(digest!.cooked_count).toBe(2);
    expect(digest!.swapped_count).toBe(1);
    expect(digest!.skipped_by_slot).toEqual({ breakfast: 2 });
    expect(digest!.reasons).toEqual({ guests: 1, no_time: 2 });
  });

  it("collapses per-person rows of one meal — a family skip is ONE skip, never N", () => {
    // One shared dinner, three members marked skipped (00019 per-person rows)
    // + the same breakfast skipped on two separate days.
    const digest = computeEngagementDigest(
      [
        checkin({ slot: "dinner", status: "skipped", reason: "guests", local_date: "2026-07-16" }),
        checkin({ slot: "dinner", status: "skipped", reason: "guests", local_date: "2026-07-16" }),
        checkin({ slot: "dinner", status: "skipped", local_date: "2026-07-16" }),
        checkin({ slot: "breakfast", status: "skipped", local_date: "2026-07-15" }),
        checkin({ slot: "breakfast", status: "skipped", local_date: "2026-07-16" }),
      ],
      [],
    );
    // The shared dinner is one meal → one skip; only breakfast crosses the
    // ≥2 pattern threshold via two distinct days.
    expect(digest!.skipped_by_slot).toEqual({ breakfast: 2 });
    // Distinct reasons count once per meal, not once per person.
    expect(digest!.reasons).toEqual({ guests: 1 });
  });

  it("scores a mixed shared meal by the meal's best outcome (cooked > swapped > skipped)", () => {
    const digest = computeEngagementDigest(
      [
        // Louis skipped his share, anas ate as planned → the dish WAS cooked.
        checkin({ slot: "breakfast", status: "skipped", local_date: "2026-07-16" }),
        checkin({ slot: "breakfast", status: "cooked", local_date: "2026-07-16" }),
        // Elsewhere: one swapped + one skipped → the kitchen swapped, not skipped.
        checkin({ slot: "lunch", status: "swapped", reason: "ordered_in", local_date: "2026-07-16" }),
        checkin({ slot: "lunch", status: "skipped", local_date: "2026-07-16" }),
        checkin({ local_date: "2026-07-15" }),
      ],
      [],
    );
    expect(digest!.cooked_count).toBe(2);
    expect(digest!.swapped_count).toBe(1);
    expect(digest!.skipped_by_slot).toEqual({});
    expect(digest!.reasons).toEqual({ ordered_in: 1 });
  });

  it("promotes dishes to golden at the loved threshold, never vetoed ones", () => {
    const loved = Array.from({ length: GOLDEN_LOVED_THRESHOLD }, () =>
      verdict("كبسة دجاج", "loved"),
    );
    const conflicted = [
      ...Array.from({ length: GOLDEN_LOVED_THRESHOLD }, () =>
        verdict("شوربة عدس", "loved"),
      ),
      verdict("شوربة عدس", "not_again"),
    ];
    const digest = computeEngagementDigest([], [
      ...loved,
      ...conflicted,
      verdict("سلطة كينوا", "loved"),
    ]);
    expect(digest!.golden_dishes.map((g) => g.recipe_name_ar)).toEqual([
      "كبسة دجاج",
    ]);
    // A dish with any not_again is a veto, not a golden.
    expect(digest!.vetoes.map((v) => v.recipe_name_ar)).toEqual(["شوربة عدس"]);
  });

  it("groups verdicts across regen rewordings via canonical keys", () => {
    const digest = computeEngagementDigest([], [
      verdict("كبسة الدجاج", "loved"),
      verdict("كبسة دجاج", "loved"),
      verdict("طبق كبسة الدجاج الشهية", "loved"),
      verdict("مقلوبة", "loved"),
      verdict("مقلوبة", "loved"),
    ]);
    expect(digest!.golden_dishes).toHaveLength(1);
    expect(digest!.golden_dishes[0]!.loved_count).toBe(3);
  });

  it("skips rows whose name normalizes to nothing", () => {
    const digest = computeEngagementDigest(
      Array.from({ length: 5 }, () => checkin()),
      [verdict("طبق صحي لذيذ", "not_again", "")],
    );
    expect(digest!.vetoes).toHaveLength(0);
  });
});

describe("engagementText", () => {
  it("renders nothing without a digest", () => {
    expect(engagementText(undefined)).toBe("");
  });

  it("renders evidence counts, hard veto and golden clauses, and the week_changes instruction", () => {
    const digest = computeEngagementDigest(
      [
        checkin({ slot: "breakfast", status: "skipped" }),
        checkin({ slot: "breakfast", status: "skipped", reason: "no_time" }),
        checkin(),
        checkin(),
      ],
      [
        ...Array.from({ length: 3 }, () => verdict("كبسة دجاج", "loved")),
        verdict("شوفان بالحليب", "not_again"),
      ],
    )!;
    const text = engagementText(digest);
    expect(text).toContain("ما حدث فعلياً في أسبوع العائلة الماضي");
    expect(text).toContain("الفطور");
    expect(text).toContain("«كبسة دجاج»");
    expect(text).toContain("«شوفان بالحليب»");
    expect(text).toContain("لا تدرجيها");
    expect(text).toContain("week_changes");
    // Bounded block — the whole point is protecting prompt economics.
    expect(text.length).toBeLessThan(2500);
  });
});

describe("week_changes schema tolerance", () => {
  const base = {
    week_start_date: "2026-07-18",
    members: [
      {
        member_id: "mom",
        member_name_ar: "نورة",
        daily_calories_target: 1800,
        macros_target: { protein_g: 120, carbs_g: 180, fat_g: 60 },
        days: [
          {
            day_index: 0,
            day_name_ar: "السبت",
            meals: [],
            day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          },
        ],
      },
    ],
  };

  it("accepts valid week_changes and trims extras to 3", () => {
    const changes = Array.from({ length: 5 }, (_, i) => ({
      change_ar: `تغيير ${i}`,
      because_ar: `سبب ${i}`,
    }));
    const parsed = MealPlanSchema.parse({ ...base, week_changes: changes });
    expect(parsed.week_changes).toHaveLength(3);
  });

  it("degrades malformed week_changes to undefined instead of failing the plan", () => {
    const parsed = MealPlanSchema.parse({
      ...base,
      week_changes: [{ change_ar: "بلا سبب" }],
    });
    expect(parsed.week_changes).toBeUndefined();
    const noneParsed = MealPlanSchema.parse(base);
    expect(noneParsed.week_changes).toBeUndefined();
  });

  it("parses week_changes on the skeleton too", () => {
    const parsed = PlanSkeletonSchema.parse({
      members: [
        {
          member_id: "mom",
          daily_calories_target: 1800,
          macros_target: { protein_g: 120, carbs_g: 180, fat_g: 60 },
          days: [
            {
              day_index: 0,
              day_name_ar: "السبت",
              meals: [
                { slot: "lunch", slot_name_ar: "الغداء", recipe_name_ar: "كبسة" },
              ],
            },
          ],
        },
      ],
      week_changes: [{ change_ar: "فطور أخف", because_ar: "فات الفطور مرتين" }],
    });
    expect(parsed.week_changes).toHaveLength(1);
  });
});
