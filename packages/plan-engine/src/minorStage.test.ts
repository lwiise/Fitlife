/**
 * Two minors, six years apart, were fed the same food.
 *
 * Found by driving the deployed app as a real family: سعود (16, male, 58 kg) and
 * لمى (10, female, 33 kg) came out of four consecutive regenerations with the
 * IDENTICAL daily figure — 985 kcal — because the only thing every prompt said
 * about either of them was «طفل — بالحصص، بدون هدف سعرات». Their ages and
 * weights were in the roster two clauses earlier; the sentence that decided how
 * much food they got erased the difference.
 *
 * What these tests defend is narrow and deliberate: a minor's stage and age must
 * reach every prompt that sizes their food, and the no-BMR/TDEE rule must
 * survive intact. No calorie number is asserted here, and none is set in the
 * code — the fix stops a sixteen-year-old being described as a ten-year-old,
 * nothing more.
 */
import { describe, it, expect } from "vitest";
import { buildDayPrompt, buildSkeletonPrompt, STATIC_SYSTEM } from "./systemPrompt";
import { minorStage, ADOLESCENT_AGE_MIN, CHILD_AGE_CUTOFF } from "./childRule";
import type {
  PlanPromptContext,
  PlanPromptContextMom,
  PlanPromptContextMember,
} from "./buildContext";
import type { PlanSkeleton } from "./schema";

function mom(over: Partial<PlanPromptContextMom> = {}): PlanPromptContextMom {
  return {
    id: "mom",
    display_name: "هند",
    sex: "female",
    member_type: "adult",
    age: 36,
    height_cm: 163,
    weight_kg: 78,
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
    ...over,
  };
}

function member(over: Partial<PlanPromptContextMember> = {}): PlanPromptContextMember {
  return {
    id: "m1",
    name: "فيصل",
    role: "son",
    member_type: "child",
    sex: "male",
    age: 16,
    height_cm: 172,
    weight_kg: 58,
    activity_level: "moderate",
    primary_goal: "child_growth",
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

function ctx(members: PlanPromptContextMember[], owner = mom()): PlanPromptContext {
  return {
    mom: owner,
    family_members: members,
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

/** One skeleton member per id, so the day prompt renders a line for each. */
function skeletonFor(ids: string[]): PlanSkeleton {
  return {
    members: ids.map((id) => ({
      member_id: id,
      member_name_ar: id,
      primary_goal: "general_health" as const,
      daily_calories_target: 985,
      macros_target: { protein_g: 60, carbs_g: 120, fat_g: 33 },
      days: [
        {
          day_index: 0,
          day_name_ar: "اليوم 1",
          meals: [{ slot: "breakfast" as const, slot_name_ar: "فطور", recipe_name_ar: "بيض" }],
        },
      ],
    })),
    methodology_notes_ar: "ملاحظات",
    safety_disclaimer_ar: "تنبيه",
  };
}

const saud = member({ id: "saud", name: "سعود", age: 16, sex: "male", weight_kg: 58 });
const lama = member({
  id: "lama",
  name: "لمى",
  role: "daughter",
  age: 10,
  sex: "female",
  weight_kg: 33,
  height_cm: 138,
});

/** The one clause each minor gets, sliced out of the roster for comparison. */
function minorClause(prompt: string, name: string): string {
  const line = prompt.split("\n").find((l) => l.includes(name)) ?? "";
  return line.slice(line.indexOf("("));
}

describe("minorStage", () => {
  it("splits at 13 and treats an unknown age as the younger stage", () => {
    expect(minorStage(12)).toBe("child");
    expect(minorStage(ADOLESCENT_AGE_MIN)).toBe("adolescent");
    expect(minorStage(17)).toBe("adolescent");
    expect(minorStage(null)).toBe("child");
    expect(minorStage(undefined)).toBe("child");
  });

  it("sits inside the child cutoff — an adolescent is still a minor", () => {
    expect(ADOLESCENT_AGE_MIN).toBeLessThan(CHILD_AGE_CUTOFF);
  });
});

describe("the roster distinguishes an adolescent from a child", () => {
  it("names the stage and the actual age for each", () => {
    const out = buildSkeletonPrompt(ctx([saud, lama]));
    expect(out).toContain("مراهق، 16 سنة");
    expect(out).toContain("طفلة، 10 سنوات");
  });

  it("gives the two of them DIFFERENT instructions — the regression itself", () => {
    const out = buildSkeletonPrompt(ctx([saud, lama]));
    expect(minorClause(out, "سعود")).not.toEqual(minorClause(out, "لمى"));
  });

  it("tells the model outright not to level an adolescent down to a young child", () => {
    const out = buildSkeletonPrompt(ctx([saud, lama]));
    expect(minorClause(out, "سعود")).toContain("أعلى بوضوح من حاجة الطفل الصغير");
    // The young child's own clause carries no such comparison — nothing to say.
    expect(minorClause(out, "لمى")).not.toContain("أعلى بوضوح");
  });

  it("keeps the no-BMR/TDEE rule for BOTH stages", () => {
    const out = buildSkeletonPrompt(ctx([saud, lama]));
    for (const name of ["سعود", "لمى"]) {
      expect(minorClause(out, name)).toContain("بدون معادلات BMR/TDEE");
      expect(minorClause(out, name)).toContain("ولا حد سعرات");
    }
  });

  it("points the portion at the person's own numbers", () => {
    const out = buildSkeletonPrompt(ctx([saud, lama]));
    expect(minorClause(out, "سعود")).toContain("حسب عمره ووزنه ونشاطه");
    expect(minorClause(out, "لمى")).toContain("حسب عمرها ووزنها ونشاطها");
  });

  it("follows the minor's own sex, not the household default", () => {
    const out = buildSkeletonPrompt(
      ctx([member({ id: "n", name: "نورة", age: 15, sex: "female" })]),
    );
    expect(out).toContain("مراهقة، 15 سنة");
    expect(out).not.toContain("مراهق، 15");
  });

  // Arabic counts 3-10 in the plural. The roster's own age field said «10 سنة»
  // while the clause three fields later said «10 سنوات» — a line disagreeing
  // with itself, in the register the model imitates when it writes the plan.
  it("counts years the way Arabic does, in the roster field too", () => {
    const out = buildSkeletonPrompt(ctx([lama]));
    expect(out).toContain("لمى، 10 سنوات");
    expect(out).not.toContain("10 سنة");
    expect(buildSkeletonPrompt(ctx([saud]))).toContain("سعود، 16 سنة");
  });

  it("still describes a minor whose age was never recorded", () => {
    const out = buildSkeletonPrompt(ctx([member({ id: "x", name: "خالد", age: null })]));
    expect(out).toContain("(طفل — استخدمي حصص الهرم الغذائي");
  });
});

describe("a MINOR account owner gets the same clause", () => {
  // Signup accepts 13+, so the owner herself can be an adolescent — and she is
  // the one path that used to be handed an adult BMR target outright.
  it("describes a 15-year-old owner as an adolescent", () => {
    const out = buildSkeletonPrompt(ctx([], mom({ age: 15, member_type: "adult" })));
    expect(out).toContain("مراهقة، 15 سنة");
    expect(out).toContain("بدون معادلات BMR/TDEE");
  });

  it("describes a male minor owner in the masculine", () => {
    const out = buildSkeletonPrompt(ctx([], mom({ age: 16, sex: "male" })));
    expect(out).toContain("مراهق، 16 سنة");
    expect(out).toContain("حسب عمره ووزنه ونشاطه");
  });
});

describe("the day prompt sizes the food, so it carries the stage too", () => {
  it("labels each minor's line with their stage and age", () => {
    const out = buildDayPrompt(ctx([saud, lama]), skeletonFor(["saud", "lama"]), 0);
    expect(out).toContain("مراهق (16 سنة)");
    expect(out).toContain("طفلة (10 سنوات)");
  });

  it("never hands a minor a calorie target", () => {
    const out = buildDayPrompt(ctx([saud, lama]), skeletonFor(["saud", "lama"]), 0);
    expect(out).not.toContain("985 سعرة");
    expect(out).toContain("بدون هدف سعرات");
  });

  it("still gives an ADULT their calorie band", () => {
    const adult = member({ id: "dad", name: "فيصل", age: 41, is_child: false, member_type: "adult" });
    const out = buildDayPrompt(ctx([adult]), skeletonFor(["dad"]), 0);
    expect(out).toContain("الهدف: 985 سعرة");
  });
});

describe("the methodology states the distinction it already illustrated", () => {
  // Its family-portion example splits «المراهق: 540 جم (30٪)» from «الطفل: 180 جم
  // (10٪)» of one pot — the rule text above it never said so.
  it("says the portion follows age and growth stage", () => {
    expect(STATIC_SYSTEM).toContain("حصة المراهق (13-17) أكبر بوضوح من حصة الطفل الصغير");
  });

  it("keeps the absolute no-BMR/TDEE rule for minors", () => {
    expect(STATIC_SYSTEM).toContain("لا تستخدمي معادلات BMR/TDEE للأطفال إطلاقاً");
  });

  it("forbids giving two minors of different ages the same estimate", () => {
    const out = buildSkeletonPrompt(ctx([saud, lama]));
    expect(out).toContain("لا تعطي قاصرَين مختلفَي العمر نفس الرقم");
  });
});
