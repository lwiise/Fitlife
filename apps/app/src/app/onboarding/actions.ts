"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
import { triggerPlanGeneration } from "@/lib/plans/dispatch";
import { mapUserGoalToSara, type UserGoal } from "@/lib/plans/goalMapping";
import type { Database } from "@/lib/supabase/database.types";

type ProfileUpdates = Partial<{
  display_name: string;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  primary_goal: string;
  cuisine_preference: string;
  dietary_restrictions: string[];
  has_medical_conditions: boolean;
  medical_conditions: string[];
  is_pregnant: boolean;
  pregnancy_trimester: number | null;
  consulted_doctor: boolean;
}>;

// The __InternalSupabase wrapper in generated types breaks the <Database> generic
// flow through postgrest-js@2.106. .update()/.insert() parameters resolve to
// `never`. Runtime behavior is fine — these types just need a ts-expect-error
// escape hatch at each call site. When postgrest-js fixes the generic, remove
// the expect-error pragmas (TS will tell us — they become unused).
type FamilyMemberInsertRow =
  Database["public"]["Tables"]["family_members"]["Insert"];

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Save partial onboarding state to the caller's profile row.
 * Called after each step for progressive save (resilient to refresh).
 */
export async function saveProfileStep(updates: ProfileUpdates): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update(updates)
    .eq("id", user.id);

  if (error) {
    console.error("[saveProfileStep] error:", error);
    Sentry.captureException(error, {
      tags: { area: "onboarding", step: "saveProfileStep", userId: user.id },
    });
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Save the family members (Step 5). Replaces the existing set.
 *
 * Note: delete-then-insert is NOT transactional. Acceptable during onboarding
 * (user can re-run Step 5). Tighten later via a Postgres RPC if it becomes a problem.
 */
export async function saveFamilyMembers(
  members: Array<{
    name: string;
    role: string;
    birth_year?: number;
    preferred_language: string;
  }>,
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error: deleteError } = await supabase
    .from("family_members")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    Sentry.captureException(deleteError, {
      tags: { area: "onboarding", step: "saveFamilyMembers.delete", userId: user.id },
    });
    return { ok: false, error: deleteError.message };
  }

  if (members.length > 0) {
    const rows: FamilyMemberInsertRow[] = members.map((m, idx) => ({
      ...m,
      user_id: user.id,
      display_order: idx,
    }));
    const { error: insertError } = await supabase
      .from("family_members")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .insert(rows);

    if (insertError) {
      Sentry.captureException(insertError, {
        tags: { area: "onboarding", step: "saveFamilyMembers.insert", userId: user.id },
      });
      return { ok: false, error: insertError.message };
    }
  }

  return { ok: true };
}

/**
 * Complete onboarding: mark profile, then redirect. If the user arrived from a
 * landing-page tier CTA, send them to /pricing with that tier preselected;
 * otherwise to the dashboard.
 */
export async function completeOnboarding(
  tier?: string,
  cadence?: string,
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("profiles")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[completeOnboarding] error:", error);
    Sentry.captureException(error, {
      tags: { area: "onboarding", step: "completeOnboarding", userId: user.id },
    });
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");

  if (isValidTier(tier) && isValidCadence(cadence)) {
    redirect(`/pricing?tier=${tier}&cadence=${cadence}`);
  }
  redirect("/dashboard");
}

// ─── Prompt 1.8c: restructured onboarding ──────────────────────────────────

export interface FamilyWideInput {
  cuisine_preference: string;
  family_dietary_restrictions: string[];
  family_dislikes: string[];
  cooking_methods: string[];
  meal_out_frequency: string;
}

/** Phase 1 — the shared 5-question family-wide screen. */
export async function saveFamilyWidePreferences(
  input: FamilyWideInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update({
      cuisine_preference: input.cuisine_preference,
      family_dietary_restrictions: input.family_dietary_restrictions,
      family_dislikes: input.family_dislikes,
      cooking_methods: input.cooking_methods,
      meal_out_frequency: input.meal_out_frequency,
      family_wide_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "onboarding", step: "saveFamilyWidePreferences", userId: user.id },
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface MomProfileInput {
  display_name: string;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  user_goal: UserGoal;
  pregnancy_status: "none" | "pregnant" | "lactating";
  trimester?: number;
  high_risk_pregnancy: boolean;
  months_postpartum?: number;
  allergies: string[];
  dislikes: string[];
  conditions: string[];
  other_condition?: string;
  consulted_doctor: boolean;
}

type GenerateActionResult =
  | { ok: true; plan_generation_id: string }
  | { ok: false; error: string };

/**
 * Phase 2 — Mom's 8 questions. Maps the friendly goal to a Sara goal, writes
 * her full profile, marks her profile (and overall onboarding) complete, then
 * fires a solo plan generation (rate-limit bypassed).
 */
export async function saveMomProfile(
  input: MomProfileInput,
): Promise<GenerateActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "يجب تسجيل الدخول" };

  const isPregnant = input.pregnancy_status === "pregnant";
  const isLactating = input.pregnancy_status === "lactating";
  const memberType = isPregnant ? "pregnant" : isLactating ? "lactating" : "adult";

  const conditions = [...input.conditions];
  const other = input.other_condition?.trim();
  if (other) conditions.push(other);
  const hasMedical = conditions.length > 0;

  const primaryGoal = mapUserGoalToSara(input.user_goal, {
    hasMedical,
    isPregnantOrLactating: isPregnant || isLactating,
    conditions,
  });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update({
      display_name: input.display_name,
      birth_year: input.birth_year,
      height_cm: input.height_cm,
      weight_kg: input.weight_kg,
      activity_level: input.activity_level,
      sex: "female",
      member_type: memberType,
      primary_goal: primaryGoal,
      allergies: input.allergies,
      dislikes: input.dislikes,
      has_medical_conditions: hasMedical,
      medical_conditions: conditions,
      is_pregnant: isPregnant,
      pregnancy_trimester: isPregnant ? (input.trimester ?? null) : null,
      high_risk_pregnancy: isPregnant ? input.high_risk_pregnancy : false,
      months_postpartum: isLactating ? (input.months_postpartum ?? null) : null,
      consulted_doctor: input.consulted_doctor,
      mom_profile_completed_at: now,
      onboarding_completed_at: now,
    })
    .eq("id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "onboarding", step: "saveMomProfile", userId: user.id },
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return runFamilyGeneration(supabase, user.id);
}

export async function finalizeOnboarding(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  await supabase
    .from("profiles")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Trigger generation for onboarding / family changes (rate limit bypassed) and
 * map the dispatch result to a user-facing Arabic message. Shared by
 * saveMomProfile and the Phase 2 family actions.
 */
async function runFamilyGeneration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<GenerateActionResult> {
  const result = await triggerPlanGeneration({
    supabase,
    userId,
    bypassRateLimit: true,
  });

  if (result.ok) return { ok: true, plan_generation_id: result.mealPlanId };

  switch (result.kind) {
    case "medical":
      return {
        ok: false,
        error: "يجب استشارة الطبيب قبل إنشاء الخطة بسبب حالة صحية مذكورة",
      };
    case "access": {
      const reason = result.access.reason;
      if (reason === "person_count_exceeded") {
        return {
          ok: false,
          error: "عدد أفراد العائلة تجاوز حد باقتك. رقّي باقتك لإضافة المزيد",
        };
      }
      return { ok: false, error: "اشتراكك غير نشط. جددي الاشتراك للمتابعة" };
    }
    case "onboarding":
      return { ok: false, error: "أكملي بياناتك أولاً قبل إنشاء الخطة" };
    default:
      return { ok: false, error: "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية" };
  }
}
