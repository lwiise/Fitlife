"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
import { triggerPlanGeneration, triggerPlanTranslation } from "@/lib/plans/dispatch";
import { isLocaleCode } from "@/lib/plans/locales";
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
type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

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
  const gen = await runFamilyGeneration(supabase, user.id);
  if (gen.ok) return { ok: true, plan_generation_id: gen.plan_generation_id };
  // A lone mom can't exceed any tier; treat upgrade as a generic error fallback.
  return {
    ok: false,
    error: gen.kind === "upgrade" ? "باقتك لا تكفي. جددي باقتك للمتابعة" : gen.error,
  };
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
type FamilyGenResult =
  | { ok: true; plan_generation_id: string }
  | { ok: false; kind: "upgrade"; current: number; max: number }
  | { ok: false; kind: "error"; error: string };

async function runFamilyGeneration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  opts: { regenerateMemberId?: string; fullRegen?: boolean } = {},
): Promise<FamilyGenResult> {
  const result = await triggerPlanGeneration({
    supabase,
    userId,
    bypassRateLimit: true,
    // Family changes are incremental: keep already-generated members and
    // generate only the new/edited one (aligned to the family's dishes).
    // A full regen (fullRegen) is needed when the change affects EVERY meal —
    // e.g. adding a housekeeper, which requires translating all recipes.
    carryOver: !opts.fullRegen,
    regenerateMemberId: opts.regenerateMemberId,
  });

  if (result.ok) return { ok: true, plan_generation_id: result.mealPlanId };

  switch (result.kind) {
    case "medical":
      return {
        ok: false,
        kind: "error",
        error: "يجب استشارة الطبيب قبل إنشاء الخطة بسبب حالة صحية مذكورة",
      };
    case "access": {
      if (result.access.reason === "person_count_exceeded") {
        return {
          ok: false,
          kind: "upgrade",
          current: result.access.details?.current_people ?? 0,
          max: result.access.details?.max_people ?? 0,
        };
      }
      return {
        ok: false,
        kind: "error",
        error: "اشتراكك غير نشط. جددي الاشتراك للمتابعة",
      };
    }
    case "onboarding":
      return { ok: false, kind: "error", error: "أكملي بياناتك أولاً قبل إنشاء الخطة" };
    default:
      return { ok: false, kind: "error", error: "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية" };
  }
}

export type MemberType = "adult" | "child" | "pregnant" | "lactating";

export interface FamilyMemberInput {
  member_type: MemberType;
  role: string; // dad | other_adult | son | daughter | other_child
  name: string;
  birth_year: number;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level?: string | null;
  user_goal?: UserGoal; // adult only
  preferred_language?: string;
  allergies: string[];
  dislikes: string[];
  conditions: string[];
  other_condition?: string;
  consulted_doctor: boolean;
  // child
  school_meal_handling?: string | null;
  picky_eater?: boolean;
  // pregnant
  trimester?: number | null;
  high_risk_pregnancy?: boolean;
  // lactating
  months_postpartum?: number | null;
}

type AddMemberResult =
  | { ok: true; member_id: string; plan_generation_id: string | null }
  | { ok: false; upgrade_required: true; member_id: string; current: number; max: number }
  | { ok: false; error: string };

/** Build the family_members row payload from a wizard input (shared add/update). */
function buildMemberRow(input: FamilyMemberInput, userId: string) {
  const conditions = [...input.conditions];
  const other = input.other_condition?.trim();
  if (other) conditions.push(other);
  const hasMedical = conditions.length > 0;

  let primaryGoal: string | null;
  if (input.member_type === "pregnant" || input.member_type === "lactating") {
    primaryGoal = "pregnancy_lactation";
  } else if (input.member_type === "child") {
    primaryGoal = null; // children: food-pyramid portions, no goal-based calories
  } else {
    primaryGoal = mapUserGoalToSara(input.user_goal ?? "maintain_health", {
      hasMedical,
      isPregnantOrLactating: false,
      conditions,
    });
  }

  return {
    user_id: userId,
    name: input.name,
    role: input.role,
    member_type: input.member_type,
    sex: input.sex ?? null,
    birth_year: input.birth_year,
    height_cm: input.height_cm ?? null,
    weight_kg: input.weight_kg ?? null,
    activity_level: input.activity_level ?? null,
    primary_goal: primaryGoal,
    preferred_language: input.preferred_language ?? "ar",
    medical_conditions: conditions,
    allergies: input.allergies,
    dislikes: input.dislikes,
    consulted_doctor: input.consulted_doctor,
    trimester: input.member_type === "pregnant" ? (input.trimester ?? null) : null,
    months_postpartum:
      input.member_type === "lactating" ? (input.months_postpartum ?? null) : null,
    high_risk_pregnancy:
      input.member_type === "pregnant" ? !!input.high_risk_pregnancy : false,
    school_meal_handling:
      input.member_type === "child" ? (input.school_meal_handling ?? null) : null,
    picky_eater: input.member_type === "child" ? !!input.picky_eater : false,
  };
}

/** Phase 2 — add a family member, then regenerate the whole-family plan (free). */
export async function addFamilyMember(
  input: FamilyMemberInput,
): Promise<AddMemberResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "يجب تسجيل الدخول" };

  // Next display_order = current max + 1.
  const { data: existingRows } = await supabase
    .from("family_members")
    .select("display_order")
    .eq("user_id", user.id)
    .order("display_order", { ascending: false })
    .limit(1);
  const existing = existingRows as { display_order: number | null }[] | null;
  const nextOrder =
    existing && existing.length > 0 ? (existing[0]!.display_order ?? 0) + 1 : 0;

  const memberId = crypto.randomUUID();
  const row = {
    ...buildMemberRow(input, user.id),
    id: memberId,
    display_order: nextOrder,
  };

  const { error: insertError } = await supabase
    .from("family_members")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .insert(row);
  if (insertError) {
    Sentry.captureException(insertError, {
      tags: { area: "family", step: "addFamilyMember.insert", userId: user.id },
    });
    return { ok: false, error: insertError.message };
  }

  // Append to member_addition_order (best-effort; not load-bearing).
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("member_addition_order")
    .eq("id", user.id)
    .single();
  const additionOrder = (profileRow as { member_addition_order: unknown } | null)
    ?.member_addition_order;
  const order = Array.isArray(additionOrder) ? (additionOrder as string[]) : [];
  await supabase
    .from("profiles")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update({ member_addition_order: [...order, memberId] })
    .eq("id", user.id);

  revalidatePath("/family");
  const gen = await runFamilyGeneration(supabase, user.id);
  if (gen.ok)
    return { ok: true, member_id: memberId, plan_generation_id: gen.plan_generation_id };
  if (gen.kind === "upgrade")
    return { ok: false, upgrade_required: true, member_id: memberId, current: gen.current, max: gen.max };
  return { ok: false, error: gen.error };
}

/**
 * Add a housekeeper (the cook — not a plan beneficiary, so no tier gating, no
 * physical/medical fields). Triggers a FULL regen so every recipe gets
 * translated into her language. Can be added post-onboarding from /family.
 */
export async function addHousekeeper(input: {
  name: string;
  preferred_language: string;
}): Promise<{ ok: true; plan_generation_id: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "يجب تسجيل الدخول" };

  // One housekeeper per household — reuse the existing row if present.
  const { data: existingHk } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "housekeeper")
    .maybeSingle();

  const { data: orderRows } = await supabase
    .from("family_members")
    .select("display_order")
    .eq("user_id", user.id)
    .order("display_order", { ascending: false })
    .limit(1);
  const ord = orderRows as { display_order: number | null }[] | null;
  const nextOrder = ord && ord.length > 0 ? (ord[0]!.display_order ?? 0) + 1 : 0;

  const existingId = (existingHk as { id: string } | null)?.id;
  const hkName = input.name || "الخدامة";
  if (existingId) {
    const updateRow = {
      name: hkName,
      preferred_language: input.preferred_language,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("family_members")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update(updateRow)
      .eq("id", existingId)
      .eq("user_id", user.id);
    if (error) {
      Sentry.captureException(error, {
        tags: { area: "family", step: "addHousekeeper.update", userId: user.id },
      });
      return { ok: false, error: error.message };
    }
  } else {
    const insertRow = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: hkName,
      role: "housekeeper",
      member_type: "housekeeper",
      preferred_language: input.preferred_language,
      consulted_doctor: false,
      display_order: nextOrder,
    };
    const { error } = await supabase
      .from("family_members")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .insert(insertRow);
    if (error) {
      Sentry.captureException(error, {
        tags: { area: "family", step: "addHousekeeper.insert", userId: user.id },
      });
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/family");
  // Do NOT regenerate the family's meals — just translate the EXISTING plan into
  // her language in place (fire-and-forget). The wife's plan is untouched.
  if (isLocaleCode(input.preferred_language) && input.preferred_language !== "ar") {
    await triggerPlanTranslation({
      supabase,
      userId: user.id,
      locale: input.preferred_language,
    });
  }
  return { ok: true, plan_generation_id: null };
}

/** Phase 2 — remove a member, then regenerate (or skip if only Mom remains). */
export async function removeFamilyMember(
  memberId: string,
): Promise<{ ok: true; plan_generation_id: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "يجب تسجيل الدخول" };

  const { error } = await supabase
    .from("family_members")
    .delete()
    .eq("id", memberId)
    .eq("user_id", user.id);
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "family", step: "removeFamilyMember", userId: user.id },
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/family");

  const { count } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("role", "housekeeper");

  if ((count ?? 0) === 0) {
    return { ok: true, plan_generation_id: null };
  }
  const gen = await runFamilyGeneration(supabase, user.id);
  // Removing a member can't push over a tier limit, so 'upgrade' won't occur here.
  if (gen.ok) return { ok: true, plan_generation_id: gen.plan_generation_id };
  return { ok: false, error: gen.kind === "upgrade" ? "باقتك لا تكفي." : gen.error };
}

/** Phase 2 — edit a member; regenerate only when a substantive field changed. */
export async function updateFamilyMember(
  memberId: string,
  input: FamilyMemberInput,
): Promise<AddMemberResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "يجب تسجيل الدخول" };

  const { data: beforeRow } = await supabase
    .from("family_members")
    .select("*")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .single();
  const before = beforeRow as FamilyMemberRow | null;

  const row = buildMemberRow(input, user.id);
  const { error } = await supabase
    .from("family_members")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update(row)
    .eq("id", memberId)
    .eq("user_id", user.id);
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "family", step: "updateFamilyMember", userId: user.id },
    });
    return { ok: false, error: error.message };
  }

  revalidatePath("/family");

  // Substantive change → regenerate; cosmetic (name only) → skip.
  const substantive =
    !before ||
    before.birth_year !== input.birth_year ||
    Number(before.weight_kg) !== Number(input.weight_kg ?? before.weight_kg) ||
    before.primary_goal !== row.primary_goal ||
    before.member_type !== row.member_type ||
    JSON.stringify(before.medical_conditions ?? []) !==
      JSON.stringify(row.medical_conditions);

  if (!substantive) {
    return { ok: true, member_id: memberId, plan_generation_id: null };
  }
  const gen = await runFamilyGeneration(supabase, user.id, {
    regenerateMemberId: memberId,
  });
  if (gen.ok)
    return { ok: true, member_id: memberId, plan_generation_id: gen.plan_generation_id };
  if (gen.kind === "upgrade")
    return { ok: false, upgrade_required: true, member_id: memberId, current: gen.current, max: gen.max };
  return { ok: false, error: gen.error };
}

/**
 * One-click family-plan generation (e.g. the post-upgrade dashboard banner).
 * Rate-limit-bypassed like other family changes; surfaces the upgrade gate.
 */
export async function generateFamilyPlan(): Promise<
  | { ok: true; plan_generation_id: string }
  | { ok: false; upgrade_required: true }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "يجب تسجيل الدخول" };

  const gen = await runFamilyGeneration(supabase, user.id);
  if (gen.ok) return { ok: true, plan_generation_id: gen.plan_generation_id };
  if (gen.kind === "upgrade") return { ok: false, upgrade_required: true };
  return { ok: false, error: gen.error };
}
