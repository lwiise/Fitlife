"use server";
import "server-only";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { mapUserGoalToSara } from "@/lib/plans/goalMapping";
import { hasGateCondition } from "@/lib/plans/medicalConditions";
import { triggerPlanTranslation } from "@/lib/plans/dispatch";
import { rescreenExerciseProfile } from "@/lib/exercise/rescreen";
import type { ExerciseProfile } from "@/lib/exercise/types";

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

  // A birth-year change shifts age, which can flip the HR-zones vs RPE prescription —
  // re-derive screening from the new age + the stored health inputs (not on this form).
  const { data: prof } = await supabase
    .from("profiles")
    .select("member_type, activity_level, medical_conditions, exercise_profile")
    .eq("id", user.id)
    .single();
  const rescreened = prof?.exercise_profile
    ? rescreenExerciseProfile(prof.exercise_profile as ExerciseProfile | null, {
        member_type: (prof.member_type ?? "adult") as
          | "adult"
          | "child"
          | "pregnant"
          | "lactating",
        age: parsed.data.birth_year ? currentYear - parsed.data.birth_year : 0,
        activity_level: prof.activity_level,
        conditions: prof.medical_conditions ?? [],
      })
    : undefined;

  const { error } = await supabase
    .from("profiles")
    .update({
      ...parsed.data,
      ...(rescreened !== undefined
        ? { exercise_profile: rescreened as unknown as Json }
        : {}),
      updated_at: new Date().toISOString(),
    })
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
  activity_level: z.enum([
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ]),
  user_goal: z.enum([
    "lose_weight",
    "maintain_health",
    "build_muscle",
    "athletic",
    "manage_condition",
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

  const isPregnant = data.pregnancy_status === "pregnant";
  const isLactating = data.pregnancy_status === "lactating";
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

  // Re-derive the stored exercise screening from the new health inputs (a new gating
  // condition, changed activity, or a pregnancy change must withhold/cap the workout
  // at the next generation). birth_year isn't on this form, so read it for age.
  const { data: prof } = await supabase
    .from("profiles")
    .select("birth_year, exercise_profile")
    .eq("id", user.id)
    .single();
  const rescreened = prof?.exercise_profile
    ? rescreenExerciseProfile(prof.exercise_profile as ExerciseProfile | null, {
        member_type: memberType,
        age: prof.birth_year ? currentYear - prof.birth_year : 0,
        activity_level: data.activity_level,
        conditions,
      })
    : undefined;

  const { error } = await supabase
    .from("profiles")
    .update({
      activity_level: data.activity_level,
      primary_goal: primaryGoal,
      member_type: memberType,
      is_pregnant: isPregnant,
      pregnancy_trimester: isPregnant ? (data.trimester ?? null) : null,
      high_risk_pregnancy: isPregnant ? data.high_risk_pregnancy : false,
      months_postpartum: isLactating ? (data.months_postpartum ?? null) : null,
      allergies: data.allergies,
      dislikes: data.dislikes,
      has_medical_conditions: hasMedical,
      medical_conditions: conditions,
      consulted_doctor: data.consulted_doctor,
      meal_mode: data.meal_mode,
      ...(rescreened !== undefined
        ? { exercise_profile: rescreened as unknown as Json }
        : {}),
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
  cuisine_preference: z.enum(["khaleeji", "mediterranean", "mixed", "international"]),
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
