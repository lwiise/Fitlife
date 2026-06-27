import type {
  PlanPromptContext,
  PlanPromptContextMom,
  PlanPromptContextMember,
} from "../buildContext";

// Builders with sensible defaults so each fixture only spells out what's distinctive.

function mom(overrides: Partial<PlanPromptContextMom> = {}): PlanPromptContextMom {
  return {
    id: "user-1",
    display_name: "أم محمد",
    sex: "female",
    member_type: "adult",
    age: 35,
    height_cm: 165,
    weight_kg: 72,
    activity_level: "moderate",
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
    consulted_doctor: false,
    meal_mode: "shared",
    ...overrides,
  };
}

function member(
  id: string,
  name: string,
  role: string,
  overrides: Partial<PlanPromptContextMember> = {},
): PlanPromptContextMember {
  const isChild = role === "son" || role === "daughter";
  return {
    id,
    name,
    role,
    member_type: isChild ? "child" : "adult",
    sex: role === "dad" || role === "son" ? "male" : "female",
    age: isChild ? 9 : 38,
    height_cm: isChild ? 135 : 178,
    weight_kg: isChild ? 30 : 82,
    activity_level: "moderate",
    primary_goal: isChild ? null : "maintenance",
    dietary_restrictions: [],
    medical_conditions: [],
    allergies: [],
    dislikes: [],
    trimester: null,
    months_postpartum: null,
    high_risk_pregnancy: false,
    school_meal_handling: isChild ? "packed" : null,
    picky_eater: false,
    consulted_doctor: false,
    is_child: isChild,
    preferred_language: "ar",
    meal_mode: "shared",
    ...overrides,
  };
}

const FAMILY_WIDE = {
  dietary_restrictions: [],
  dislikes: [],
  cooking_methods: ["oven", "stovetop"],
  meal_out_frequency: "rarely",
};

export interface EvalFixture {
  name: string;
  context: PlanPromptContext;
}

export const EVAL_FIXTURES: EvalFixture[] = [
  {
    name: "solo-fat-loss",
    context: {
      mom: mom(),
      family_members: [],
      family_wide: FAMILY_WIDE,
      composition_summary: "عائلة من فرد: الأم.",
    },
  },
  {
    name: "family-of-4-shared",
    context: {
      mom: mom(),
      family_members: [
        member("dad-1", "أبو محمد", "dad"),
        member("kid-1", "محمد", "son", { age: 10 }),
        member("kid-2", "سارة", "daughter", { age: 7 }),
      ],
      family_wide: FAMILY_WIDE,
      composition_summary: "عائلة من 4 أفراد: الأم، الأب، وطفلان (10 سنة، 7 سنة).",
    },
  },
  {
    name: "pregnant-mom",
    context: {
      mom: mom({
        primary_goal: "maintenance",
        is_pregnant: true,
        pregnancy_trimester: 2,
        consulted_doctor: true,
      }),
      family_members: [member("dad-1", "أبو محمد", "dad")],
      family_wide: FAMILY_WIDE,
      composition_summary: "عائلة من فردين: الأم (حامل)، الأب.",
    },
  },
  {
    name: "lactating-member",
    context: {
      mom: mom(),
      family_members: [
        member("sister-1", "نورة", "sister", {
          member_type: "lactating",
          months_postpartum: 3,
          primary_goal: "maintenance",
          consulted_doctor: true,
        }),
      ],
      family_wide: FAMILY_WIDE,
      composition_summary: "عائلة من فردين: الأم، أخت (مرضعة).",
    },
  },
  {
    name: "household-with-housekeeper",
    context: {
      mom: mom(),
      family_members: [
        member("dad-1", "أبو محمد", "dad"),
        member("kid-1", "محمد", "son", { age: 9 }),
        member("hk-1", "Maria", "housekeeper", {
          preferred_language: "tl",
          primary_goal: "maintenance",
        }),
      ],
      family_wide: FAMILY_WIDE,
      composition_summary:
        "عائلة من 3 أفراد: الأم، الأب، وطفل (9 سنة). يوجد خادمة تطبخ للعائلة.",
      housekeeper_locale: "tl",
    },
  },
];
