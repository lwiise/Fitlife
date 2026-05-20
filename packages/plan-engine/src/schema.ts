// SCHEMA IS PROVISIONAL — REVISE WHEN SARA'S METHODOLOGY ARRIVES (Prompt 1.8b)

import { z } from "zod";

// ─── Macros ────────────────────────────────────────────────────────────
export const MacrosSchema = z.object({
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});
export type Macros = z.infer<typeof MacrosSchema>;

// ─── Ingredient ────────────────────────────────────────────────────────
// `unit` is intentionally a loose enum until Sara confirms allowed values.
export const IngredientSchema = z.object({
  name_ar: z.string().min(1),
  amount: z.number(),
  unit: z.enum(["g", "ml", "cup", "tbsp", "piece"]),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

// ─── Meal ──────────────────────────────────────────────────────────────
export const MealSchema = z.object({
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  slot_name_ar: z.string().min(1),
  recipe_name_ar: z.string().min(1),
  ingredients: z.array(IngredientSchema),
  prep_steps_ar: z.array(z.string()), // for the maid to execute
  calories: z.number(),
  macros: MacrosSchema,
  // TODO_SARA: prep_time, difficulty, swap_options, equipment, etc.
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
// `member_id` is either "mom" (the profile owner) or a family_members.id (uuid string).
export const MemberPlanSchema = z.object({
  member_id: z.string().min(1),
  member_name_ar: z.string().min(1),
  daily_calories_target: z.number(),
  macros_target: MacrosSchema,
  days: z.array(DaySchema).length(7),
});
export type MemberPlan = z.infer<typeof MemberPlanSchema>;

// ─── Full meal plan ────────────────────────────────────────────────────
export const MealPlanSchema = z.object({
  week_start_date: z.string(), // ISO date — the server may override post-validation
  members: z.array(MemberPlanSchema).min(1),
  // TODO_SARA: shopping_list (family-wide), plan_notes, doctor_disclaimer_ar
});
export type MealPlan = z.infer<typeof MealPlanSchema>;
