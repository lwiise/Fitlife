"use server";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Optional post-onboarding lifestyle answers (Coach Sara's full questionnaire,
// Phase B). Everything nullable — the user saves whatever she filled. Enum-like
// values are Zod-enforced (00013 stores plain text per the house convention).
const DeepDiveSchema = z.object({
  waist_cm: z.number().min(30).max(250).nullable(),
  steps_daily: z.number().int().min(0).max(60000).nullable(),
  exercise_duration: z.enum(["lt30", "m30_60", "gt60"]).nullable(),
  liked_foods: z.array(z.string().trim().min(1).max(80)).max(30),
  meals_per_day: z.number().int().min(1).max(8).nullable(),
  snacks_habit: z.enum(["yes", "no"]).nullable(),
  breakfast_habit: z.enum(["regular", "sometimes", "never"]).nullable(),
  intermittent_fasting: z.enum(["yes", "no"]).nullable(),
  food_recall_24h: z.string().trim().max(1000).nullable(),
  sleep_quality: z.enum(["excellent", "good", "fair", "poor"]).nullable(),
  stress_level: z.enum(["low", "medium", "high"]).nullable(),
  who_cooks: z.enum(["me", "family_member", "cook", "delivery"]).nullable(),
  cooking_time: z.enum(["lt20", "m20_40", "gt40"]).nullable(),
  previous_diets: z.string().trim().max(1000).nullable(),
  food_budget: z.string().trim().max(200).nullable(),
});

export type DeepDiveInput = z.infer<typeof DeepDiveSchema>;

type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Save the deep-dive answers and stamp deep_dive_completed_at (hides the
 * dashboard nudge). No regeneration is triggered — like the other profile
 * edits, the answers apply at the next plan generation.
 */
export async function saveDeepDive(input: DeepDiveInput): Promise<SaveResult> {
  const parsed = DeepDiveSchema.safeParse(input);
  if (!parsed.success) {
    // Server-side error → gender-neutral فصحى (verbal nouns, no gendered
    // imperative) so it reads right for a male owner too.
    return { ok: false, error: "بيانات غير صالحة. الرجاء مراجعة الحقول وإعادة المحاولة" };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const { error } = await supabase
    .from("profiles")
    .update({
      waist_cm: data.waist_cm,
      steps_daily: data.steps_daily,
      exercise_duration: data.exercise_duration,
      liked_foods: data.liked_foods,
      meals_per_day: data.meals_per_day,
      snacks_habit: data.snacks_habit,
      breakfast_habit: data.breakfast_habit,
      intermittent_fasting: data.intermittent_fasting,
      food_recall_24h: data.food_recall_24h,
      sleep_quality: data.sleep_quality,
      stress_level: data.stress_level,
      who_cooks: data.who_cooks,
      cooking_time: data.cooking_time,
      previous_diets: data.previous_diets,
      food_budget: data.food_budget,
      deep_dive_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "profile-deep-dive", userId: user.id },
    });
    return { ok: false, error: "فشل الحفظ. حاولي مرة أخرى" };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
