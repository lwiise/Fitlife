// SCHEMA ALIGNED WITH SARA'S METHODOLOGY (Prompt 1.8b)
// New fields are optional so plans generated under the earlier stub still parse
// and render at /plan.

import { z } from "zod";

// ─── Macros ────────────────────────────────────────────────────────────
export const MacrosSchema = z.object({
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});
export type Macros = z.infer<typeof MacrosSchema>;

// ─── Ingredient ────────────────────────────────────────────────────────
// `amount` is the canonical figure (upper bound when a range is given).
// `amount_min`/`amount_max` capture Sara's ranges ("100-120g", "220-250g").
// `unit: "unlimited"` encodes Sara's "سلطة حرة" (unrestricted) rather than
// smuggling it into notes.
export const IngredientSchema = z.object({
  name_ar: z.string().min(1),
  amount: z.number(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
  unit: z.enum([
    "g",
    "kg",
    "ml",
    "l",
    "tbsp",
    "tsp",
    "cup",
    "piece",
    "serving",
    "unlimited",
  ]),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

// ─── Per-member portion (family-as-unit shared recipes) ──────────────────
export const PerMemberPortionSchema = z.object({
  member_id: z.string().min(1),
  ingredients: z.array(IngredientSchema),
  notes_ar: z.string().optional(),
});
export type PerMemberPortion = z.infer<typeof PerMemberPortionSchema>;

// ─── Meal ──────────────────────────────────────────────────────────────
export const MealSchema = z.object({
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  slot_name_ar: z.string().min(1),
  recipe_name_ar: z.string().min(1),
  ingredients: z.array(IngredientSchema),
  prep_steps_ar: z.array(z.string()), // for the cook (الخدامة) to execute
  calories: z.number(),
  macros: MacrosSchema,
  // Sara's required recipe fields (optional in schema for old-plan compat):
  prep_time_minutes: z.number().int().nonnegative().optional(),
  cook_time_minutes: z.number().int().nonnegative().optional(),
  servings_count: z.number().int().positive().optional(),
  substitutions_ar: z.array(z.string()).optional(),
  notes_ar: z.string().optional(), // storage / make-ahead / allergy warnings
  // Family-as-unit: when true, top-level `ingredients` is the base recipe and
  // `per_member_portions` overrides amounts per member. When false/absent, the
  // meal is individual.
  shared_recipe: z.boolean().optional(),
  per_member_portions: z.array(PerMemberPortionSchema).optional(),
});
export type Meal = z.infer<typeof MealSchema>;

// ─── Day ───────────────────────────────────────────────────────────────
export const DaySchema = z.object({
  day_index: z.number().int().min(0).max(6),
  day_name_ar: z.string().min(1), // "السبت" .. "الجمعة"
  meals: z.array(MealSchema),
  day_total: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
});
export type Day = z.infer<typeof DaySchema>;

// ─── Member plan ───────────────────────────────────────────────────────
// `member_id` is either "mom" (the profile owner) or a family_members.id.
export const PRIMARY_GOALS = [
  "fat_loss",
  "muscle_gain",
  "body_recomposition",
  "athletic_performance",
  "metabolic_health",
  "digestive_health",
  "pregnancy_lactation",
  "posture_recovery",
] as const;

export const MemberPlanSchema = z.object({
  member_id: z.string().min(1),
  member_name_ar: z.string().min(1),
  primary_goal: z.enum(PRIMARY_GOALS).optional(),
  daily_calories_target: z.number(),
  macros_target: MacrosSchema,
  days: z.array(DaySchema).length(7),
});
export type MemberPlan = z.infer<typeof MemberPlanSchema>;

// ─── Full meal plan ────────────────────────────────────────────────────
export const MealPlanSchema = z.object({
  week_start_date: z.string(), // ISO date — the server may override post-validation
  members: z.array(MemberPlanSchema).min(1),
  methodology_notes_ar: z.string().optional(), // Sara-style coaching note (tone via Email 2)
  // Always produced by the prompt; optional in schema so older plans parse.
  safety_disclaimer_ar: z.string().optional(),
});
export type MealPlan = z.infer<typeof MealPlanSchema>;
