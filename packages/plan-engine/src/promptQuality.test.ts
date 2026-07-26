/**
 * Guards the prompt-quality fixes: the methodology/cookbook precedence, the
 * Gulf-staples contradiction, the per-recipe calorie band that couldn't reach
 * an adult day target, the فصحى register, and the postpartum-without-lactation
 * clause. These are prose assertions on a CACHED static block, so they're cheap
 * and they catch an accidental revert of the whole block.
 */
import { describe, it, expect } from "vitest";
import { STATIC_SYSTEM, buildSkeletonPrompt } from "./systemPrompt";
import type { PlanPromptContext, PlanPromptContextMom } from "./buildContext";

function mom(over: Partial<PlanPromptContextMom> = {}): PlanPromptContextMom {
  return {
    id: "mom",
    display_name: "سارة",
    sex: "female",
    member_type: "adult",
    age: 34,
    height_cm: 162,
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

function ctx(over: Partial<PlanPromptContextMom> = {}): PlanPromptContext {
  return {
    mom: mom(over),
    family_members: [],
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "فرد واحد",
  };
}

describe("STATIC_SYSTEM — methodology vs cookbook precedence", () => {
  it("states an explicit precedence order", () => {
    expect(STATIC_SYSTEM).toContain("ترتيب المراجع عند التعارض");
    // Safety first, day targets before style preferences, cookbook last.
    const order = STATIC_SYSTEM.slice(STATIC_SYSTEM.indexOf("ترتيب المراجع عند التعارض"));
    expect(order.indexOf("قواعد السلامة")).toBeLessThan(order.indexOf("أهداف السعرات"));
    expect(order.indexOf("أهداف السعرات")).toBeLessThan(
      order.indexOf("تفضيلات كتاب الوصفات"),
    );
  });

  it("the cookbook block defers to the methodology in its own words", () => {
    expect(STATIC_SYSTEM).toContain("الأولوية عند التعارض");
    expect(STATIC_SYSTEM).toContain("فالمنهجية أولاً والكتاب يتكيّف");
  });
});

describe("STATIC_SYSTEM — Gulf staples are no longer banned", () => {
  it("keeps the methodology's staples list", () => {
    for (const dish of ["كبسة", "الجريش", "المرقوق", "السمك مع الأرز"]) {
      expect(STATIC_SYSTEM).toContain(dish);
    }
    expect(STATIC_SYSTEM).toContain("لا حرمان");
  });

  it("no longer forbids white rice / pasta / bread outright", () => {
    // The old cookbook rules read «لا تستخدمي أرز أبيض كمكون رئيسي» etc., which
    // contradicted the staples list above and, being the later block, won.
    expect(STATIC_SYSTEM).not.toContain("لا تستخدمي أرز أبيض");
    expect(STATIC_SYSTEM).not.toContain("لا تستخدمي مكرونة عادية");
    expect(STATIC_SYSTEM).not.toContain("لا تستخدمي خبز أبيض");
  });

  it("frames them as portion-controlled defaults instead", () => {
    expect(STATIC_SYSTEM).toContain("بمقدار موزون");
    expect(STATIC_SYSTEM).toContain("تفضيلات الأسلوب (افتراضات، لا محرّمات)");
  });
});

describe("STATIC_SYSTEM — the per-recipe calorie band can reach adult targets", () => {
  it("no longer caps a serving at the old 120-430 band", () => {
    expect(STATIC_SYSTEM).not.toContain("١٢٠-٤٣٠");
    expect(STATIC_SYSTEM).not.toContain("120-430");
  });

  it("says the day target governs and main meals may run high", () => {
    expect(STATIC_SYSTEM).toContain("هدف الفرد اليومي");
    expect(STATIC_SYSTEM).toContain("600-800");
  });
});

describe("STATIC_SYSTEM — register is فصحى with Western digits", () => {
  it("drops the عامية phrasings and the أنتي misspelling", () => {
    for (const slang of [
      "أنتي", // misspelling of أنتِ
      "لازم تحتوي",
      "خلي الوصفات تطلع",
      "لما تنشئين",
      "ممنوع السكر",
      "ممنوع الطحين",
      "لا تتقيدي",
    ]) {
      expect(STATIC_SYSTEM).not.toContain(slang);
    }
    // اللي as a standalone relative pronoun (not inside الليمون).
    expect(STATIC_SYSTEM).not.toMatch(/(^|[\s(«])اللي([\s)»,.،]|$)/);
  });

  it("uses Western digits throughout, like the methodology", () => {
    const arabicIndic = STATIC_SYSTEM.match(/[٠-٩]/g) ?? [];
    expect(arabicIndic).toEqual([]);
  });
});

describe("describeMom — postpartum without lactation", () => {
  it("a formula-feeding mother gets the recovery rules, not lactation calories", () => {
    const prompt = buildSkeletonPrompt(
      ctx({ member_type: "adult", months_postpartum: 2 }),
    );
    expect(prompt).toContain("ولدت قبل 2 شهر ولا ترضع");
    expect(prompt).toContain("لا تضيفي سعرات الرضاعة");
    expect(prompt).toContain("قواعد التعافي بعد الولادة");
    expect(prompt).not.toContain("طبّقي قواعد الرضاعة");
  });

  it("a lactating mother still gets the lactation clause", () => {
    const prompt = buildSkeletonPrompt(
      ctx({ member_type: "lactating", months_postpartum: 3, feeding_mode: "exclusive" }),
    );
    expect(prompt).toContain("مرضعة");
    expect(prompt).toContain("طبّقي قواعد الرضاعة");
    expect(prompt).not.toContain("ولا ترضع");
  });

  it("a mother with no recent birth gets neither clause", () => {
    const prompt = buildSkeletonPrompt(ctx());
    expect(prompt).not.toContain("قواعد التعافي بعد الولادة");
    expect(prompt).not.toContain("طبّقي قواعد الرضاعة");
  });

  it("a male owner never gets a postpartum clause", () => {
    const prompt = buildSkeletonPrompt(
      ctx({ sex: "male", member_type: "adult", months_postpartum: 2 }),
    );
    expect(prompt).not.toContain("ولدت قبل");
  });
});
