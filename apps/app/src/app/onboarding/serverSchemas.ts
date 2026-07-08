import { z } from "zod";

// Server-side validation for the onboarding actions. These actions previously
// trusted the client-typed inputs entirely; every mutation now safeParses
// before touching the database. Bounds mirror the DB CHECK constraints
// (00001/00013) and the client-side checks, so a passing client never trips
// these — they exist for hand-crafted requests.

const CURRENT_YEAR = new Date().getFullYear();

const chipArray = z.array(z.string().trim().min(1).max(80)).max(30);

const conditionsArray = z.array(z.string().trim().min(1).max(100)).max(20);

export const USER_GOALS = [
  "lose_weight",
  "build_muscle",
  "recomposition",
  "maintain_weight",
  "athletic",
  "improve_health",
] as const;

const exerciseFields = {
  day_nature: z.enum(["desk", "moderate_movement", "physical_work"]).optional(),
  exercise_days: z.enum(["none", "d1_2", "d3_5", "d6_plus"]).optional(),
  exercise_type: z.enum(["resistance", "cardio", "mixed"]).nullish(),
} as const;

const lifestyleFields = {
  target_weight_kg: z.number().min(20).max(300).nullish(),
  water_liters: z.enum(["lt1", "l1_2", "l2_3", "gt3"]).nullish(),
  sleep_hours: z.number().min(2).max(16).nullish(),
  medications: chipArray.optional(),
  supplements: chipArray.optional(),
  nausea_foods: chipArray.optional(),
} as const;

export const momProfileInputSchema = z
  .object({
    display_name: z.string().trim().min(2).max(60),
    birth_year: z.number().int().min(1940).max(CURRENT_YEAR),
    height_cm: z.number().min(80).max(250),
    weight_kg: z.number().min(20).max(300),
    // Legacy direct level (pre-exercise-step clients). The server prefers
    // deriving from day_nature × exercise_days when both are present.
    activity_level: z
      .enum(["sedentary", "light", "moderate", "active", "very_active"])
      .optional(),
    ...exerciseFields,
    ...lifestyleFields,
    notes: z.string().trim().max(500).nullish(),
    user_goal: z.enum(USER_GOALS),
    pregnancy_status: z.enum(["none", "pregnant", "lactating"]),
    trimester: z.number().int().min(1).max(3).optional(),
    high_risk_pregnancy: z.boolean(),
    months_postpartum: z.number().int().min(0).max(24).optional(),
    allergies: chipArray,
    dislikes: chipArray,
    conditions: conditionsArray,
    other_condition: z.string().trim().max(200).optional(),
    consulted_doctor: z.boolean(),
  })
  .refine((v) => v.activity_level || (v.day_nature && v.exercise_days), {
    message: "مستوى النشاط مطلوب",
  });

export const familyMemberInputSchema = z.object({
  member_type: z.enum(["adult", "child", "pregnant", "lactating"]),
  role: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(60),
  birth_year: z.number().int().min(1940).max(CURRENT_YEAR),
  sex: z.string().max(10).nullish(),
  height_cm: z.number().min(80).max(250).nullish(),
  weight_kg: z.number().min(20).max(300).nullish(),
  activity_level: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .nullish(),
  ...exerciseFields,
  ...lifestyleFields,
  user_goal: z.enum(USER_GOALS).optional(),
  preferred_language: z.string().max(10).optional(),
  allergies: chipArray,
  dislikes: chipArray,
  conditions: conditionsArray,
  other_condition: z.string().trim().max(200).optional(),
  consulted_doctor: z.boolean(),
  meal_mode: z.enum(["shared", "independent"]).optional(),
  school_meal_handling: z.string().max(30).nullish(),
  picky_eater: z.boolean().optional(),
  trimester: z.number().int().min(1).max(3).nullish(),
  high_risk_pregnancy: z.boolean().optional(),
  months_postpartum: z.number().int().min(0).max(24).nullish(),
  feeding_mode: z.enum(["exclusive", "mixed", "formula"]).nullish(),
});

export const familyWideInputSchema = z.object({
  cuisine_preference: z.enum(["khaleeji", "mediterranean", "mixed", "international"]),
  family_dietary_restrictions: z.array(z.string().trim().min(1).max(60)).max(15),
  family_dislikes: chipArray,
  cooking_methods: z.array(z.string().trim().min(1).max(40)).max(10),
  meal_out_frequency: z.enum(["never", "rarely", "sometimes", "often"]),
});

// Whitelist for the progressive per-step save — the raw update object goes
// straight into a profiles UPDATE, so every key must be explicitly allowed.
export const profileStepSchema = z
  .object({
    display_name: z.string().trim().min(2).max(60),
    birth_year: z.number().int().min(1940).max(CURRENT_YEAR),
    height_cm: z.number().min(80).max(250),
    weight_kg: z.number().min(20).max(300),
    activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
    ...exerciseFields,
    target_weight_kg: z.number().min(20).max(300).nullable(),
    primary_goal: z.string().max(40),
    cuisine_preference: z.string().max(20),
    dietary_restrictions: z.array(z.string().max(60)).max(15),
    has_medical_conditions: z.boolean(),
    medical_conditions: conditionsArray,
    is_pregnant: z.boolean(),
    pregnancy_trimester: z.number().int().min(1).max(3).nullable(),
    consulted_doctor: z.boolean(),
  })
  .partial()
  .strict();

export const VALIDATION_ERROR_AR = "بيانات غير صالحة. تحققي من الحقول وأعيدي المحاولة";
