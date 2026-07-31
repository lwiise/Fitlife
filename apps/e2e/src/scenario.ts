/**
 * The one scenario this suite is about: a Gulf household of three on the
 * «العائلة» (family) plan.
 *
 * Kept as data, separate from the specs, so every assertion in the suite is
 * checked against the SAME declared expectation rather than against a literal
 * retyped per test.
 *
 * Roles are not free choice: `family_members.role` carries a CHECK constraint
 * from migration 00001 —
 *   ('dad','son','daughter','housekeeper','other_adult','other_child')
 * — so the husband is `dad` and a boy is `son`. (The server-side zod schema in
 * onboarding/serverSchemas.ts is looser, `z.string().min(2).max(30)`; the
 * database is the binding contract.)
 */

import { PRICING_TIERS, type Cadence, type Tier } from "./pricingConfig.js";

export const PLAN_TIER: Tier = "family";
export const PLAN_CADENCE: Cadence = "monthly";

/** Resolved from the app's own pricing config — never retyped as a literal. */
export const PLAN = PRICING_TIERS[PLAN_TIER];
export const PLAN_VARIANT_ID = PLAN.lemonsqueezy_variant_id_monthly;
export const PLAN_PRICE_SAR = PLAN.price_monthly_sar;

/** Mom + husband + child. The housekeeper below is deliberately NOT one of them. */
export const EXPECTED_BENEFICIARIES = 3;

export interface MemberSpec {
  name: string;
  role: "dad" | "son" | "daughter" | "housekeeper" | "other_adult" | "other_child";
  member_type: "adult" | "child" | "pregnant" | "lactating" | "housekeeper";
  sex: "male" | "female" | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  primary_goal: string | null;
  preferred_language: string;
  meal_mode: "shared" | "independent";
  /** Counts against the tier's max_people. False only for the housekeeper. */
  beneficiary: boolean;
}

/** The account owner — stored on `profiles`, not `family_members`. */
export const MOM = {
  display_name: "نورة",
  sex: "female" as const,
  member_type: "adult" as const,
  birth_year: 1990,
  height_cm: 162,
  weight_kg: 74,
  activity_level: "light" as const,
  // saveMomProfile maps the UI goal "lose_weight" through mapUserGoalToSara;
  // with no medical conditions that resolves to "fat_loss".
  primary_goal: "fat_loss",
  preferred_language: "ar",
};

export const HUSBAND: MemberSpec = {
  name: "خالد",
  role: "dad",
  member_type: "adult",
  sex: "male",
  birth_year: 1987,
  height_cm: 178,
  weight_kg: 92,
  activity_level: "moderate",
  primary_goal: "fat_loss",
  preferred_language: "ar",
  meal_mode: "shared",
  beneficiary: true,
};

export const CHILD: MemberSpec = {
  name: "سعود",
  role: "son",
  member_type: "child",
  sex: "male",
  birth_year: new Date().getFullYear() - 9,
  height_cm: 133,
  weight_kg: 29,
  // buildMemberRow leaves children without a derived activity level or goal:
  // they are planned on food-pyramid portions, not goal-based calories.
  activity_level: null,
  primary_goal: null,
  preferred_language: "ar",
  meal_mode: "shared",
  beneficiary: true,
};

/**
 * The cook. Present on purpose: she is the single clearest test of the tier
 * accounting rule, since `countBeneficiaries` filters on `role <> 'housekeeper'`.
 * Her language differs from the family's so the multi-language contract is
 * visible in the data too.
 */
export const HOUSEKEEPER: MemberSpec = {
  name: "Maria",
  role: "housekeeper",
  member_type: "housekeeper",
  sex: null,
  birth_year: null,
  height_cm: null,
  weight_kg: null,
  activity_level: null,
  primary_goal: null,
  preferred_language: "tl",
  meal_mode: "shared",
  beneficiary: false,
};

export const FAMILY_MEMBERS: MemberSpec[] = [HUSBAND, CHILD, HOUSEKEEPER];

/** What an activated «العائلة» monthly subscription must look like in our DB. */
export const EXPECTED_SUBSCRIPTION = {
  status: "active",
  tier: PLAN_TIER,
  cadence: PLAN_CADENCE,
  variant_id: PLAN_VARIANT_ID,
  price_sar: PLAN_PRICE_SAR,
  max_people: PLAN.max_people,
  cancel_at_period_end: false,
} as const;
