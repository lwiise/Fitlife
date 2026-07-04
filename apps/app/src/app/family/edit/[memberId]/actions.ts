"use server";
import "server-only";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { mapUserGoalToSara } from "@/lib/plans/goalMapping";
import { activityLevelFrom } from "@/lib/plans/activityLevel";
import { hasGateCondition } from "@/lib/plans/medicalConditions";

type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

export type SaveResult = { ok: true } | { ok: false; error: string };

const currentYear = new Date().getFullYear();

// Member edits mirror the mom profile sections: each sub-page saves only its own
// slice of the family_members row (no full-row rebuild, so untouched fields are
// preserved) and does NOT regenerate the plan — changes apply at the next
// generation, exactly like the mom profile edits.

async function loadMember(
  memberId: string,
): Promise<
  | { ok: true; userId: string; member: FamilyMemberRow }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const { data } = await supabase
    .from("family_members")
    .select("*")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .single();
  const member = data as FamilyMemberRow | null;
  if (!member) return { ok: false, error: "العضو غير موجود" };
  return { ok: true, userId: user.id, member };
}

// ── Section 1: Personal info ──────────────────────────────────────────────
const PersonalSchema = z.object({
  name: z.string().min(2, "الاسم لازم يكون حرفين أو أكثر").max(50),
  birth_year: z
    .number({ invalid_type_error: "اكتبي سنة الميلاد" })
    .int()
    .min(1940, "السنة لازم تكون بعد 1940")
    .max(currentYear, `سنة الميلاد لازم تكون قبل ${currentYear + 1}`),
  sex: z.enum(["female", "male"]).nullable(),
  height_cm: z
    .number()
    .min(40, "الطول لازم يكون بين 40 و250 سم")
    .max(250, "الطول لازم يكون بين 40 و250 سم")
    .nullable(),
  weight_kg: z
    .number()
    .min(5, "الوزن لازم يكون بين 5 و300 كجم")
    .max(300, "الوزن لازم يكون بين 5 و300 كجم")
    .nullable(),
});

export async function updateMemberPersonal(
  memberId: string,
  input: z.infer<typeof PersonalSchema>,
): Promise<SaveResult> {
  const parsed = PersonalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const data = parsed.data;

  const loaded = await loadMember(memberId);
  if (!loaded.ok) return loaded;
  const { userId, member } = loaded;

  // A child's role tracks its sex (son/daughter); other roles are fixed.
  const role =
    member.member_type === "child"
      ? data.sex === "male"
        ? "son"
        : "daughter"
      : member.role;

  const supabase = await createClient();
  const { error } = await supabase
    .from("family_members")
    .update({
      name: data.name,
      birth_year: data.birth_year,
      sex: data.sex,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("user_id", userId);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "member-edit-personal", userId },
    });
    return { ok: false, error: "فشل الحفظ. حاولي مرة أخرى" };
  }
  revalidatePath("/family");
  revalidatePath(`/family/edit/${memberId}`);
  return { ok: true };
}

// ── Section 2: Health & goals ─────────────────────────────────────────────
const HealthSchema = z.object({
  activity_level: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .nullable(),
  user_goal: z
    .enum([
      "lose_weight",
      "build_muscle",
      "recomposition",
      "maintain_weight",
      "athletic",
      "improve_health",
    ])
    .optional(),
  allergies: z.array(z.string()),
  dislikes: z.array(z.string()),
  conditions: z.array(z.string()),
  other_condition: z.string().optional(),
  consulted_doctor: z.boolean(),
  meal_mode: z.enum(["shared", "independent"]),
  trimester: z.number().int().min(1).max(3).nullable(),
  high_risk_pregnancy: z.boolean(),
  months_postpartum: z.number().int().min(0).max(24).nullable(),
  school_meal_handling: z
    .enum(["home_packed", "school_provided", "mixed"])
    .nullable(),
  picky_eater: z.boolean(),
  // Coach questionnaire (00013) — per-type gating happens against the DB
  // member_type below, never the client.
  day_nature: z.enum(["desk", "moderate_movement", "physical_work"]).optional(),
  exercise_days: z.enum(["none", "d1_2", "d3_5", "d6_plus"]).optional(),
  exercise_type: z.enum(["resistance", "cardio", "mixed"]).nullish(),
  target_weight_kg: z.number().min(20).max(300).nullish(),
  water_cups: z.number().int().min(0).max(40).nullish(),
  sleep_hours: z.number().min(2).max(16).nullish(),
  medications: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  supplements: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  nausea_foods: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  feeding_mode: z.enum(["exclusive", "mixed", "formula"]).nullish(),
});

export async function updateMemberHealth(
  memberId: string,
  input: z.infer<typeof HealthSchema>,
): Promise<SaveResult> {
  const parsed = HealthSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const data = parsed.data;

  const loaded = await loadMember(memberId);
  if (!loaded.ok) return loaded;
  const { userId, member } = loaded;

  // The member's type is fixed at add time; trust the DB, never the client.
  const type = (member.member_type ?? "adult") as
    | "adult"
    | "child"
    | "pregnant"
    | "lactating";
  const isPreg = type === "pregnant";
  const isLact = type === "lactating";
  const isChild = type === "child";
  const isAdult = type === "adult";

  const conditions = [...data.conditions];
  const other = data.other_condition?.trim();
  if (other) conditions.push(other);
  const hasMedical = conditions.length > 0;

  // Same gate as the add wizard: pregnant/lactating always; adults when a gate
  // condition or free-text note is present; children when a chronic note exists.
  const doctorNeeded =
    isPreg ||
    isLact ||
    (isAdult && (hasGateCondition(data.conditions) || !!other)) ||
    (isChild && !!other);
  if (doctorNeeded && !data.consulted_doctor) {
    return { ok: false, error: "يلزم تأكيد استشارة الطبيب أولاً" };
  }

  let primaryGoal: string | null;
  if (isPreg || isLact) {
    primaryGoal = "pregnancy_lactation";
  } else if (isChild) {
    primaryGoal = null; // children: food-pyramid portions, no goal-based calories
  } else {
    primaryGoal = mapUserGoalToSara(data.user_goal ?? "maintain_weight", {
      hasMedical,
      isPregnantOrLactating: false,
      conditions,
    });
  }

  const derivedActivity =
    isAdult && data.day_nature && data.exercise_days
      ? activityLevelFrom(data.day_nature, data.exercise_days)
      : data.activity_level;

  const supabase = await createClient();
  const { error } = await supabase
    .from("family_members")
    .update({
      activity_level: derivedActivity,
      day_nature: isAdult ? (data.day_nature ?? null) : null,
      exercise_days: isAdult ? (data.exercise_days ?? null) : null,
      exercise_type: isAdult ? (data.exercise_type ?? null) : null,
      target_weight_kg: isAdult ? (data.target_weight_kg ?? null) : null,
      sleep_hours: isAdult ? (data.sleep_hours ?? null) : null,
      water_cups: isChild ? null : (data.water_cups ?? null),
      medications: isChild ? [] : (data.medications ?? []),
      supplements: isChild ? [] : (data.supplements ?? []),
      nausea_foods: isPreg ? (data.nausea_foods ?? []) : [],
      feeding_mode: isLact ? (data.feeding_mode ?? null) : null,
      primary_goal: primaryGoal,
      medical_conditions: conditions,
      allergies: data.allergies,
      dislikes: data.dislikes,
      consulted_doctor: doctorNeeded ? data.consulted_doctor : false,
      meal_mode: data.meal_mode,
      trimester: isPreg ? (data.trimester ?? null) : null,
      high_risk_pregnancy: isPreg ? data.high_risk_pregnancy : false,
      months_postpartum: isLact ? (data.months_postpartum ?? null) : null,
      school_meal_handling: isChild ? (data.school_meal_handling ?? null) : null,
      picky_eater: isChild ? data.picky_eater : false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("user_id", userId);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "member-edit-health", userId },
    });
    return { ok: false, error: "فشل الحفظ. حاولي مرة أخرى" };
  }
  revalidatePath("/family");
  revalidatePath(`/family/edit/${memberId}`);
  return { ok: true };
}
