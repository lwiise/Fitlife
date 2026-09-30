/**
 * A man's wife used to be stored as a generic 'other_adult': her wizard was
 * titled «إضافة فرد بالغ» and asked her sex, and the prompt introduced her as
 * «فرد بالغ». She is now the spouse role like any husband, which makes one
 * rule load-bearing: every label for that role follows the member's own sex.
 */
import { describe, it, expect } from "vitest";
import {
  SPOUSE_ROLE,
  familyRoleLabelAr,
  isSpouseRole,
  spouseSexFor,
} from "./familyRole";
import {
  buildCompositionSummary,
  type PlanPromptContext,
  type PlanPromptContextMember,
  type PlanPromptContextMom,
} from "./buildContext";
import { buildSkeletonPrompt } from "./systemPrompt";

function member(over: Partial<PlanPromptContextMember> = {}): PlanPromptContextMember {
  return {
    id: "m1",
    name: "نورة",
    role: SPOUSE_ROLE,
    member_type: "adult",
    sex: "female",
    age: 34,
    height_cm: 162,
    weight_kg: 68,
    activity_level: "light",
    primary_goal: "fat_loss",
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

function owner(sex: "male" | "female"): PlanPromptContextMom {
  return {
    id: "mom",
    display_name: sex === "male" ? "لويس" : "هند",
    sex,
    member_type: "adult",
    age: 38,
    height_cm: 175,
    weight_kg: 85,
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
    consulted_doctor: true,
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
    notes: null,
  };
}

function ctx(ownerSex: "male" | "female", spouse: PlanPromptContextMember): PlanPromptContext {
  return {
    mom: owner(ownerSex),
    family_members: [spouse],
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: buildCompositionSummary([spouse], ownerSex === "male"),
  };
}

describe("the spouse's sex", () => {
  it("is the owner's opposite", () => {
    expect(spouseSexFor("male")).toBe("female");
    expect(spouseSexFor("female")).toBe("male");
  });

  it("is a husband for an owner who has not answered (the feminine fallback)", () => {
    expect(spouseSexFor(null)).toBe("male");
    expect(spouseSexFor(undefined)).toBe("male");
  });

  it("is keyed off the one spouse role", () => {
    expect(isSpouseRole(SPOUSE_ROLE)).toBe(true);
    expect(isSpouseRole("other_adult")).toBe(false);
    expect(isSpouseRole(null)).toBe(false);
  });
});

describe("the spouse's label follows their sex", () => {
  it("names a wife «الزوجة» and a husband «الزوج»", () => {
    expect(familyRoleLabelAr(SPOUSE_ROLE, "female")).toBe("الزوجة");
    expect(familyRoleLabelAr(SPOUSE_ROLE, "male")).toBe("الزوج");
  });

  it("treats a spouse row with no sex on file as a husband, as it always was", () => {
    expect(familyRoleLabelAr(SPOUSE_ROLE, null)).toBe("الزوج");
  });

  it("leaves every other role as it was", () => {
    expect(familyRoleLabelAr("other_adult", "female")).toBe("فرد بالغ");
    expect(familyRoleLabelAr("son", "male")).toBe("ابن");
    expect(familyRoleLabelAr("daughter", "female")).toBe("ابنة");
    expect(familyRoleLabelAr("unknown_role")).toBe("unknown_role");
  });
});

describe("the plan prompt introduces a man's wife as his wife", () => {
  const out = buildSkeletonPrompt(ctx("male", member()));

  it("in the roster", () => {
    expect(out).toContain("الزوجة: نورة");
    expect(out).not.toContain("الزوج: نورة");
    expect(out).not.toContain("فرد بالغ: نورة");
  });

  it("in the family summary: father and mother, not two fathers", () => {
    expect(buildCompositionSummary([member()], true)).toContain("الأب، الأم");
  });

  it("still introduces a woman's husband as her husband", () => {
    const husband = member({ name: "فيصل", sex: "male" });
    expect(buildSkeletonPrompt(ctx("female", husband))).toContain("الزوج: فيصل");
    expect(buildCompositionSummary([husband], false)).toContain("الأم، الأب");
  });
});
