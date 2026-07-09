"use server";
import "server-only";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapUserGoalToSara } from "@/lib/plans/goalMapping";
import { activityLevelFrom } from "@/lib/plans/activityLevel";
import { hasGateCondition } from "@/lib/plans/medicalConditions";
import { triggerPlanTranslation } from "@/lib/plans/dispatch";

export type SaveResult = { ok: true } | { ok: false; error: string };

const currentYear = new Date().getFullYear();

// ── Section 1: Personal info ──────────────────────────────────────────────
const PersonalSchema = z.object({
  display_name: z.string().min(2, "الاسم لازم يكون حرفين أو أكثر").max(50),
  birth_year: z
    .number()
    .int()
    .min(1940, "السنة لازم تكون بعد 1940")
    .max(currentYear - 13, "لازم تكوني فوق 13 سنة"),
  sex: z.enum(["female", "male"]),
  height_cm: z.number().min(120, "الطول قليل").max(220, "الطول مرتفع"),
  weight_kg: z.number().min(30, "الوزن قليل").max(250, "الوزن مرتفع"),
});

export async function saveMomPersonalInfo(
  input: z.infer<typeof PersonalSchema>,
): Promise<SaveResult> {
  const parsed = PersonalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "profile-edit-personal", userId: user.id },
    });
    return { ok: false, error: "فشل الحفظ. حاولي مرة ثانية" };
  }
  revalidatePath("/profile");
  return { ok: true };
}

// ── Section 2: Health & goals ─────────────────────────────────────────────
const HealthSchema = z.object({
  // Legacy direct level; when day_nature + exercise_days are present the level
  // is DERIVED server-side (legacy rows keep their stored level until the
  // exercise questions are answered).
  activity_level: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .optional(),
  day_nature: z.enum(["desk", "moderate_movement", "physical_work"]).optional(),
  exercise_days: z.enum(["none", "d1_2", "d3_5", "d6_plus"]).optional(),
  exercise_type: z.enum(["resistance", "cardio", "mixed"]).nullish(),
  target_weight_kg: z.number().min(20).max(300).nullish(),
  water_liters: z.enum(["lt1", "l1_2", "l2_3", "gt3"]).nullish(),
  sleep_hours: z.number().min(2).max(16).nullish(),
  medications: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  supplements: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  nausea_foods: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  notes: z.string().trim().max(500).nullish(),
  user_goal: z.enum([
    "lose_weight",
    "build_muscle",
    "recomposition",
    "maintain_weight",
    "athletic",
    "improve_health",
  ]),
  pregnancy_status: z.enum(["none", "pregnant", "lactating"]),
  trimester: z.number().int().min(1).max(3).nullable(),
  high_risk_pregnancy: z.boolean(),
  months_postpartum: z.number().int().min(0).max(24).nullable(),
  allergies: z.array(z.string()),
  dislikes: z.array(z.string()),
  conditions: z.array(z.string()),
  other_condition: z.string().optional(),
  consulted_doctor: z.boolean(),
  // Shared family meals (default) vs your own independent dishes. Applied at the
  // next plan generation (like the rest of this form), not regenerated in place.
  meal_mode: z.enum(["shared", "independent"]),
}).refine((v) => v.activity_level || (v.day_nature && v.exercise_days), {
  message: "مستوى النشاط مطلوب",
});

export async function saveMomHealthInfo(
  input: z.infer<typeof HealthSchema>,
): Promise<SaveResult> {
  const parsed = HealthSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  // Male owners can never be pregnant/lactating — mirror the onboarding
  // hard-guard (the health form also hides the section, but never trust it).
  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("sex")
    .eq("id", user.id)
    .maybeSingle();
  const isMale = ownProfile?.sex === "male";
  const isPregnant = !isMale && data.pregnancy_status === "pregnant";
  const isLactating = !isMale && data.pregnancy_status === "lactating";
  const memberType = isPregnant ? "pregnant" : isLactating ? "lactating" : "adult";

  const conditions = [...data.conditions];
  const other = data.other_condition?.trim();
  if (other) conditions.push(other);
  const hasMedical = conditions.length > 0;

  // Save-time medical gate — mirrors the real plan-generation gate: a high-risk
  // condition (or high-risk pregnancy) requires confirming a doctor consult.
  const gateBlocked =
    (hasGateCondition(conditions) || (isPregnant && data.high_risk_pregnancy)) &&
    !data.consulted_doctor;
  if (gateBlocked) {
    return { ok: false, error: "يجب تأكيد استشارة الطبيب قبل الحفظ" };
  }

  const primaryGoal = mapUserGoalToSara(data.user_goal, {
    hasMedical,
    isPregnantOrLactating: isPregnant || isLactating,
    conditions,
  });

  const derivedActivity =
    data.day_nature && data.exercise_days
      ? activityLevelFrom(data.day_nature, data.exercise_days)
      : (data.activity_level ?? null);

  const { error } = await supabase
    .from("profiles")
    .update({
      activity_level: derivedActivity,
      day_nature: data.day_nature ?? null,
      exercise_days: data.exercise_days ?? null,
      exercise_type: data.exercise_type ?? null,
      target_weight_kg: data.target_weight_kg ?? null,
      water_liters: data.water_liters ?? null,
      sleep_hours: data.sleep_hours ?? null,
      // This form edits hours, not the 00016 band — clear the band or the
      // prompt (band takes precedence) would silently ignore the edit.
      sleep_band: null,
      medications: data.medications ?? [],
      supplements: data.supplements ?? [],
      nausea_foods: isPregnant ? (data.nausea_foods ?? []) : [],
      notes: data.notes?.trim() || null,
      primary_goal: primaryGoal,
      member_type: memberType,
      is_pregnant: isPregnant,
      pregnancy_trimester: isPregnant ? (data.trimester ?? null) : null,
      // The form edits the trimester only; a stale onboarding month would
      // contradict it in the prompt (month renders with precedence) — clear it.
      pregnancy_month: null,
      high_risk_pregnancy: isPregnant ? data.high_risk_pregnancy : false,
      months_postpartum: isLactating ? (data.months_postpartum ?? null) : null,
      feeding_mode: isLactating ? undefined : null,
      allergies: data.allergies,
      dislikes: data.dislikes,
      has_medical_conditions: hasMedical,
      medical_conditions: conditions,
      consulted_doctor: data.consulted_doctor,
      meal_mode: data.meal_mode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "profile-edit-health", userId: user.id },
    });
    return { ok: false, error: "فشل الحفظ. حاولي مرة ثانية" };
  }
  revalidatePath("/profile");
  return { ok: true };
}

// ── Section 3: Family preferences ─────────────────────────────────────────
const FamilyPreferencesSchema = z.object({
  // Spec's five cuisines (00016 remapped the legacy stored values).
  cuisine_preference: z.enum(["khaleeji", "arabic", "asian", "western", "varied"]),
  family_dietary_restrictions: z.array(z.string()),
  family_dislikes: z.array(z.string()),
  cooking_methods: z.array(z.string()),
  meal_out_frequency: z.enum(["never", "rarely", "sometimes", "often"]),
});

export async function saveMomFamilyPreferences(
  input: z.infer<typeof FamilyPreferencesSchema>,
): Promise<SaveResult> {
  const parsed = FamilyPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  // حلال دائماً ضمن القيود (matches onboarding's family-wide save).
  const dietary = data.family_dietary_restrictions.filter((d) => d !== "halal");

  const { error } = await supabase
    .from("profiles")
    .update({
      cuisine_preference: data.cuisine_preference,
      family_dietary_restrictions: ["halal", ...dietary],
      family_dislikes: data.family_dislikes,
      cooking_methods: data.cooking_methods,
      meal_out_frequency: data.meal_out_frequency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "profile-edit-family-prefs", userId: user.id },
    });
    return { ok: false, error: "فشل الحفظ. حاولي مرة ثانية" };
  }
  revalidatePath("/profile");
  return { ok: true };
}

// ── Housekeeper reading language ──────────────────────────────────────────
const HousekeeperLanguageSchema = z.object({
  housekeeper_id: z.string().uuid(),
  preferred_language: z.enum(["ar", "en", "tl", "id", "bn", "am", "ur"]),
});

export async function saveHousekeeperLanguage(
  input: z.infer<typeof HousekeeperLanguageSchema>,
): Promise<SaveResult> {
  const parsed = HousekeeperLanguageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const { error } = await supabase
    .from("family_members")
    .update({
      preferred_language: parsed.data.preferred_language,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.housekeeper_id)
    .eq("user_id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "profile-edit-housekeeper-lang", userId: user.id },
    });
    return { ok: false, error: "فشل الحفظ. حاولي مرة ثانية" };
  }

  // Re-translate the existing plan into the new language (in place, no regen).
  if (parsed.data.preferred_language !== "ar") {
    await triggerPlanTranslation({
      supabase,
      userId: user.id,
      locale: parsed.data.preferred_language,
    });
  }

  revalidatePath("/profile");
  revalidatePath("/plan");
  return { ok: true };
}
