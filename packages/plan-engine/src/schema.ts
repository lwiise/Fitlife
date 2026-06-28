// SCHEMA ALIGNED WITH SARA'S METHODOLOGY (Prompt 1.8b)
// New fields are optional so plans generated under the earlier stub still parse
// and render at /plan.

import { z } from "zod";
import { WorkoutPlanSchema } from "./exercise/schema";

// ─── Locales ───────────────────────────────────────────────────────────
// The 7 languages a household's housekeeper may read recipes in. Source of
// truth for the locale CODE type (frontend metadata lives in apps/app locales.ts).
export const LOCALE_CODES = ["ar", "en", "tl", "id", "bn", "am", "ur"] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

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
  // This member's share of the cooked batch: weight in grams AND as a percentage
  // of the total finished batch (the sharers' percentages sum to ~100). This is
  // how different members hit different targets from the same pot.
  portion_grams: z.number().optional(),
  portion_percentage: z.number().optional(),
  // Optional genuine add-ons/swaps for this member (e.g. an extra healthy-fat
  // side) — NOT a re-listing of the shared recipe.
  ingredients: z.array(IngredientSchema).optional(),
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
  // Housekeeper translations — present only when the household has a housekeeper
  // whose language is not Arabic. Arabic stays the source of truth.
  prep_steps_translated: z.array(z.string()).optional(),
  prep_steps_translated_locale: z.enum(LOCALE_CODES).optional(),
  recipe_name_translated: z.string().optional(),
  ingredients_translated: z.array(IngredientSchema).optional(),
  calories: z.number(),
  macros: MacrosSchema,
  // Sara's required recipe fields (optional in schema for old-plan compat):
  prep_time_minutes: z.number().int().nonnegative().optional(),
  cook_time_minutes: z.number().int().nonnegative().optional(),
  servings_count: z.number().int().positive().optional(),
  substitutions_ar: z.array(z.string()).optional(),
  notes_ar: z.string().optional(), // storage / make-ahead / allergy warnings
  // Family-as-unit: when true, top-level `ingredients` is the ONE recipe scaled to
  // the combined batch, `batch_finished_weight_g` is its total finished weight, and
  // `per_member_portions` splits that batch per person (grams + %). When
  // false/absent, the meal is individual.
  shared_recipe: z.boolean().optional(),
  batch_finished_weight_g: z.number().optional(),
  per_member_portions: z.array(PerMemberPortionSchema).optional(),
  // Shared meals only: this member's OWN single portion (the pre-merge recipe),
  // retained so the family batch can be re-derived when ONE member is later edited
  // without regenerating the others. `ingredients` here is the single portion, NOT
  // the batch (top-level `ingredients` holds the batch when shared). Absent on
  // individual meals and on plans generated before this field existed — those fall
  // back to scaling the batch by the member's share on the first re-sync, then it
  // is stored correctly thereafter.
  own_portion: z
    .object({
      recipe_name_ar: z.string(),
      ingredients: z.array(IngredientSchema),
      prep_steps_ar: z.array(z.string()),
    })
    .optional(),
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
  // Housekeeper view: the member's name rendered in her language/script.
  member_name_translated: z.string().optional(),
  member_name_translated_locale: z.enum(LOCALE_CODES).optional(),
  // Children have no weight goal — the model returns null (not just omits it),
  // so accept null/undefined as well as a goal. .optional() alone rejects null.
  primary_goal: z.enum(PRIMARY_GOALS).nullish(),
  daily_calories_target: z.number(),
  macros_target: MacrosSchema,
  // Prompt asks for exactly 7; tolerate an occasional short week (the UI fills
  // 7 day-tabs with fallbacks) rather than failing the whole plan.
  days: z.array(DaySchema).min(1).max(7),
});
export type MemberPlan = z.infer<typeof MemberPlanSchema>;

// ─── Full meal plan ────────────────────────────────────────────────────
export const MealPlanSchema = z.object({
  week_start_date: z.string(), // ISO date — the server may override post-validation
  members: z.array(MemberPlanSchema).min(1),
  methodology_notes_ar: z.string().optional(), // Sara-style coaching note (tone via Email 2)
  // Always produced by the prompt; optional in schema so older plans parse.
  safety_disclaimer_ar: z.string().optional(),
  // Progressive (day-by-day) rendering: `generating` is true while later days
  // are still being expanded; `days_total` is the target day count so the UI
  // knows which day tabs are still pending. Both absent on older plans (=done).
  days_total: z.number().int().optional(),
  generating: z.boolean().optional(),
  // While generating, the single member this run is filling in (one-at-a-time
  // adds). The UI scopes its loading spinners to this member so a different
  // member's empty/failed day never renders as "loading". Undefined when not
  // generating, on the final plan, or on an initial multi-member run.
  generating_member_id: z.string().optional(),
  // Per-member count of generation runs that TARGETED that member, so the drain
  // can cap completion-retries (a deterministically-failing day shows "failed"
  // and the drain advances instead of looping). Absent on older plans.
  gen_attempts: z.record(z.string(), z.number()).optional(),
  // Per-member history de-list: member_ids for whom this plan is hidden from
  // their Previous Plans view. Does NOT affect other members' access or the
  // active plan. Absent on older plans.
  hidden_for_member_ids: z.array(z.string()).optional(),
  // member_id this plan was a MANUAL per-member regenerate of (the regenerate
  // button) — persisted so the weekly per-member regen quota can be counted from
  // plan_data. Absent on new plans, member-adds, and drains.
  regenerated_for: z.string().optional(),
  // Phase 2: per-member workout plans, present only when ≥1 member opted into
  // exercise. Rides in the plan_data jsonb (no migration); meals-only plans omit it.
  workouts: z.array(WorkoutPlanSchema).optional(),
  // TEMP diagnostic breadcrumb (remove after 2e is verified) — records why workouts
  // did/didn't attach: the gate, whether the skeleton emitted `training`, the count.
  exercise_debug: z.unknown().optional(),
});
export type MealPlan = z.infer<typeof MealPlanSchema>;

/**
 * True iff the plan has at least one member with at least one day that actually
 * contains meals. A plan can be persisted as `status='ready'` with empty day
 * shells (the progressive renderer flips ready on the first emit), so callers
 * deciding "show the plan vs. show a loader" must gate on real content, not just
 * status. Display-only check — does not mutate.
 */
export function planHasContent(plan: MealPlan): boolean {
  return plan.members.some((m) => m.days.some((d) => d.meals.length > 0));
}

// ─── Parallel-by-day generation (phase 1 skeleton + phase 2 day slices) ──────
// Phase 1: targets + a week of dish NAMES only (fast, small output). The model
// sees the whole week here, so variety + shared-recipe coordination are decided
// once. Phase 2 expands each day's named meals into full recipes, in parallel.
export const SkeletonMealSchema = z.object({
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  slot_name_ar: z.string().min(1),
  recipe_name_ar: z.string().min(1),
});
export const SkeletonDaySchema = z.object({
  day_index: z.number().int().min(0).max(6),
  day_name_ar: z.string().min(1),
  meals: z.array(SkeletonMealSchema).min(1),
});
// Phase 2 (2c): the sparse weekly training schedule the skeleton emits per opted-in
// member. Optional + lenient → meal-only skeletons (no `training`) parse unchanged.
// Only training days are listed (rest = absent). The model proposes the sessions;
// code computes the energy (2d/2e). `withheld` = clearance unmet → no program emitted.
export const SkeletonTrainingSchema = z.object({
  withheld: z.boolean().optional(),
  sessions: z
    .array(
      z.object({
        day_index: z.number().int().min(0).max(6),
        modality: z.string(),
        band: z.enum(["light", "moderate", "vigorous"]),
        duration_min: z.number().int().positive(),
      }),
    )
    .optional(),
});
export type SkeletonTraining = z.infer<typeof SkeletonTrainingSchema>;

export const SkeletonMemberSchema = z.object({
  member_id: z.string().min(1),
  member_name_ar: z.string().optional(),
  // Children have no weight goal — the model returns null. .optional() rejects an
  // explicit null, which fails the whole skeleton for any family with a child.
  primary_goal: z.enum(PRIMARY_GOALS).nullish(),
  daily_calories_target: z.number(),
  macros_target: MacrosSchema,
  days: z.array(SkeletonDaySchema).min(1).max(7),
  // Phase 2: present only for opted-in members; absent for meals-only.
  training: SkeletonTrainingSchema.optional(),
});
export const PlanSkeletonSchema = z.object({
  members: z.array(SkeletonMemberSchema).min(1),
  methodology_notes_ar: z.string().optional(),
  safety_disclaimer_ar: z.string().optional(),
});
export type PlanSkeleton = z.infer<typeof PlanSkeletonSchema>;

// Phase 2 output: one day expanded for all members (day_total is summed in code,
// so the model doesn't return it here).
export const DaySliceMemberSchema = z.object({
  member_id: z.string().min(1),
  meals: z.array(MealSchema).min(1),
});
export const DaySliceSchema = z.object({
  day_index: z.number().int().min(0).max(6),
  day_name_ar: z.string().optional(),
  members: z.array(DaySliceMemberSchema).min(1),
});
export type DaySlice = z.infer<typeof DaySliceSchema>;
