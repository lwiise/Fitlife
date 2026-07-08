"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
import { triggerPlanGeneration, triggerPlanTranslation ,
  triggerWorkoutGeneration,
} from "@/lib/plans/dispatch";
import { getLatestPlan } from "@/lib/plans/getLatestPlan";
import {
  getCurrentSubscription,
  isSubscriptionActive,
  getTierLimit,
} from "@/lib/subscription/state";
import { shouldRegenerateFamilyOnActivation } from "@/lib/plans/familyCoverage";
import { planHasContent, MEMBER_GEN_MAX_ATTEMPTS, type MealPlan } from "@fitlife/plan-engine";
import { isLocaleCode } from "@/lib/plans/locales";
import { mapUserGoalToSara, type UserGoal } from "@/lib/plans/goalMapping";
import {
  activityLevelFrom,
  type DayNature,
  type ExerciseDays,
  type ExerciseType,
} from "@/lib/plans/activityLevel";
import {
  momProfileInputSchema,
  familyMemberInputSchema,
  familyWideInputSchema,
  profileStepSchema,
  VALIDATION_ERROR_AR,
} from "./serverSchemas";
import type { Database } from "@/lib/supabase/database.types";

type ProfileUpdates = Partial<{
  display_name: string;
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  day_nature: string;
  exercise_days: string;
  exercise_type: string | null;
  target_weight_kg: number | null;
  primary_goal: string;
  cuisine_preference: string;
  dietary_restrictions: string[];
  has_medical_conditions: boolean;
  medical_conditions: string[];
  is_pregnant: boolean;
  pregnancy_trimester: number | null;
  consulted_doctor: boolean;
}>;

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

  // The update object goes straight into a profiles UPDATE — strict whitelist.
  const parsed = profileStepSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: VALIDATION_ERROR_AR };

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
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

  if (!familyWideInputSchema.safeParse(input).success) {
    return { ok: false, error: VALIDATION_ERROR_AR };
  }

  const { error } = await supabase
    .from("profiles")
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
  // Legacy direct level; when day_nature + exercise_days are present the
  // server derives activity_level from them instead (never trusts a client-
  // computed level).
  activity_level?: string;
  day_nature?: DayNature;
  exercise_days?: ExerciseDays;
  exercise_type?: ExerciseType | null;
  target_weight_kg?: number | null;
  water_cups?: number | null;
  sleep_hours?: number | null;
  medications?: string[];
  supplements?: string[];
  nausea_foods?: string[];
  notes?: string | null;
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
  | { ok: true; plan_generation_id: string | null }
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

  if (!momProfileInputSchema.safeParse(input).success) {
    return { ok: false, error: VALIDATION_ERROR_AR };
  }

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

  // Derive the canonical level from the concrete answers when available
  // (never trust a client-computed level); legacy clients still send the
  // level directly.
  const derivedActivity =
    input.day_nature && input.exercise_days
      ? activityLevelFrom(input.day_nature, input.exercise_days)
      : (input.activity_level ?? null);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.display_name,
      birth_year: input.birth_year,
      height_cm: input.height_cm,
      weight_kg: input.weight_kg,
      activity_level: derivedActivity,
      day_nature: input.day_nature ?? null,
      exercise_days: input.exercise_days ?? null,
      exercise_type: input.exercise_type ?? null,
      target_weight_kg: input.target_weight_kg ?? null,
      water_cups: input.water_cups ?? null,
      sleep_hours: input.sleep_hours ?? null,
      medications: input.medications ?? [],
      supplements: input.supplements ?? [],
      nausea_foods: isPregnant ? (input.nausea_foods ?? []) : [],
      notes: input.notes?.trim() || null,
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
    })
    .eq("id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "onboarding", step: "saveMomProfile", userId: user.id },
    });
    return { ok: false, error: error.message };
  }

  // Do NOT generate or mark onboarding complete here. The mom wizard now hands off
  // to the add-a-member loop (/onboarding/members); generation for the WHOLE family
  // (mom + everyone she adds) runs after the subscription screen — either the
  // whole family on subscribe (webhook) or mom-only via generateSoloAndContinue.
  revalidatePath("/dashboard");
  return { ok: true, plan_generation_id: null };
}

/**
 * End of the onboarding add-a-member loop: mark onboarding complete and route the
 * user onward. The destination depends on whether they've ALREADY paid:
 *   • PAID active subscription (e.g. they purchased from the dashboard before
 *     finishing the quiz) → skip the pricing screen entirely. Trigger the
 *     whole-family generation (now that onboarding is complete) and send them to
 *     /plan, exactly as the post-checkout handler does.
 *   • Trial / no paid subscription → show the subscription screen, where:
 *       - subscribe → the LemonSqueezy webhook generates the WHOLE family together
 *         on activation (so shared meals group across the full roster), or
 *       - "continue with just my plan" → generateSoloAndContinue() makes the
 *         primary user's plan only.
 */
export async function finishOnboardingToSubscription(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/dashboard");

  // If the user already paid (e.g. via the dashboard link before taking the quiz),
  // do NOT bounce them back to the pricing page. A PAID active subscription has a
  // lemonsqueezy_subscription_id — trial rows never do. Mirror the post-checkout
  // path: kick off the whole-family generation and land them on /plan.
  const sub = await getCurrentSubscription(user.id);
  if (sub && isSubscriptionActive(sub) && sub.lemonsqueezy_subscription_id) {
    // Always land on /plan: it renders every state correctly (progress while
    // generating, the plan when ready, the retry UI on failure) — bouncing to
    // the dashboard on a declined sync left users staring at "no plan yet".
    await syncFamilyPlanAfterSubscribe().catch(() => ({ triggered: false }));
    redirect("/plan");
  }

  redirect("/pricing?from=onboarding");
}

/**
 * "Continue with just my plan" from the post-onboarding subscription screen. Runs a
 * normal family generation; on the free trial's starter tier (max 1 person) it caps
 * to the primary user (mom) and defers the rest behind the subscription notice.
 * Subscribing later regenerates the whole family together (see the LemonSqueezy
 * webhook). Onboarding is already completed by finishOnboardingToSubscription.
 */
export async function generateSoloAndContinue(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Full run → tier cap (trial starter = 1) yields a mom-only plan; any extra
  // members defer until a covering subscription unlocks the whole-family regen.
  await runFamilyGeneration(supabase, user.id);
  // Combined generation: fire the workout companion too (no-op unless opted in).
  await maybeTriggerWorkoutGeneration(supabase, user.id);
  redirect("/plan");
}

/**
 * Whole-family (re)generation when a PAID subscription now covers more
 * beneficiaries than the current plan contains — the synchronized path that keeps
 * shared meals grouped across everyone (carryOver:false). Idempotent: a no-op when
 * the plan already covers the tier's capacity, mid-generation, or for trial-only
 * rows. Called right after checkout activates (CheckoutSuccessHandler). Returns
 * whether a run was started so the caller can route to /plan.
 */
export async function syncFamilyPlanAfterSubscribe(): Promise<{ triggered: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { triggered: false };

  const { data: prof } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .returns<{ onboarding_completed_at: string | null }[]>()
    .maybeSingle();
  if (!prof?.onboarding_completed_at) return { triggered: false };

  const sub = await getCurrentSubscription(user.id);
  // Only a PAID active subscription unlocks the family — trial rows (no LS id)
  // never auto-generate beyond the explicit mom-only path.
  if (!sub || !isSubscriptionActive(sub) || !sub.lemonsqueezy_subscription_id) {
    return { triggered: false };
  }

  // Combined generation: the workout companion fires regardless of what the
  // meal decision below concludes (it is often a legitimate no-op re-poll).
  await maybeTriggerWorkoutGeneration(supabase, user.id);

  const latest = await getLatestPlan(user.id);
  if (latest?.in_progress) return { triggered: false }; // already generating

  const { count } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("role", "housekeeper");
  const beneficiaryCount = (count ?? 0) + 1; // + mom

  if (
    !shouldRegenerateFamilyOnActivation({
      isPaidActive: true,
      planMemberCount: latest?.member_count ?? 0,
      beneficiaryCount,
      tierMaxPeople: getTierLimit(sub.tier),
    })
  ) {
    return { triggered: false };
  }

  const gen = await runFamilyGeneration(supabase, user.id, { fullRegen: true });
  return { triggered: gen.ok };
}

/**
 * Combined-generation companion: after a meal generation hand-off, fire the
 * workout generation too — iff anyone opted in (a non-null workout_profile
 * exists on the mom or an eligible member) AND no workout plan is already
 * ready or freshly in flight. Fired regardless of the meal result: the meal
 * call is often a legitimate no-op on re-poll (already generating / roster
 * covered), and tying workout to it would strand opted-in users. Idempotent:
 * the 00014 per-kind unique index makes a double-fire lose cleanly (busy).
 */
async function maybeTriggerWorkoutGeneration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  try {
    const [{ data: prof }, { data: optedMembers }] = await Promise.all([
      supabase
        .from("profiles")
        .select("workout_profile")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("family_members")
        .select("id")
        .eq("user_id", userId)
        .not("workout_profile", "is", null)
        .limit(1),
    ]);
    const anyOptIn =
      prof?.workout_profile != null || (optedMembers?.length ?? 0) > 0;
    if (!anyOptIn) return;

    const { data: existing } = await supabase
      .from("workout_plans")
      .select("id, status, updated_at")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<{ id: string; status: string; updated_at: string }[]>();
    const row = existing?.[0];
    if (row) {
      if (row.status === "ready") return;
      const ageMin = (Date.now() - Date.parse(row.updated_at)) / 60_000;
      if (row.status === "generating" && ageMin < 15) return;
    }

    await triggerWorkoutGeneration({ supabase, userId });
  } catch (err) {
    // Never let the workout companion break the meal flow.
    console.error("[maybeTriggerWorkoutGeneration] failed", err);
    Sentry.captureException(err, {
      tags: { area: "workout-generation", step: "companion-trigger", userId },
    });
  }
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
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * First-run auto-drain, evaluated LAZILY on a post-onboarding read (called from a
 * client effect on /plan and the dashboard). A member added while mom's solo
 * generation was still in flight gets deferred by the dispatch busy guard (saved
 * to family_members but not in plan_data.members). Rather than leave a brand-new
 * user on a "only mom + manual banner" first view, generate the deferred members
 * onto the existing family grid (carry-over) once mom's plan is ready.
 *
 * Fires only when ALL hold: onboarding complete (prevents a mid-wizard partial
 * drain), the latest plan is "ready" (so it's not generating/failed — and so the
 * carry-over has a base to seed from), and at least one beneficiary is pending.
 * Busy/upgrade/error → fired:false; the manual banner stays as the fallback.
 * Terminates: a fired drain flips status to "generating" (blocks re-fire) and
 * seeds the pending members (pending → empty).
 */
/**
 * Returns { fired } when a generation was dispatched, and { busy } when one is
 * already in flight — either way the caller (DeferredMemberDrain) should stop
 * dispatching and just keep refreshing until the server state advances.
 */
export async function drainDeferredMembers(): Promise<{
  fired: boolean;
  busy: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fired: false, busy: false };

  const [profileRes, latest, membersRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("onboarding_completed_at, member_addition_order")
      .eq("id", user.id)
      .returns<
        { onboarding_completed_at: string | null; member_addition_order: unknown }[]
      >()
      .maybeSingle(),
    getLatestPlan(user.id),
    supabase
      .from("family_members")
      .select("id, role, display_order, meal_mode")
      .eq("user_id", user.id)
      .returns<
        { id: string; role: string; display_order: number; meal_mode: string }[]
      >(),
  ]);

  if (!profileRes.data?.onboarding_completed_at) return { fired: false, busy: false };
  // Need a ready plan WITH real content — never seed the carry-over off an empty
  // shell (status flips to 'ready' on the first emit while still generating).
  if (
    latest?.status !== "ready" ||
    !latest.plan_data ||
    !planHasContent(latest.plan_data)
  )
    return { fired: false, busy: false };

  const additionOrder = Array.isArray(profileRes.data?.member_addition_order)
    ? (profileRes.data.member_addition_order as string[])
    : [];
  const nextId = pickNextMemberId({
    plan: latest.plan_data,
    members: membersRes.data ?? [],
    additionOrder,
  });
  if (!nextId) return { fired: false, busy: false };

  // An already-in-plan member only missing a failed day is finished alone (no
  // shared-meal impact). An ABSENT (new) member that SHARES the family menu rebuilds
  // the whole shared group together so shared meals merge across everyone (the
  // one-at-a-time path can't merge a newcomer into the others' existing shared
  // meals); an INDEPENDENT newcomer has private dishes — generate only them, carry
  // the rest.
  const inPlan = latest.plan_data.members.some((m) => m.member_id === nextId);
  let gen: FamilyGenResult;
  if (inPlan) {
    gen = await runFamilyGeneration(supabase, user.id, { onlyMemberId: nextId });
  } else {
    const nextMode = (membersRes.data ?? []).find((m) => m.id === nextId)?.meal_mode;
    gen =
      nextMode === "independent"
        ? await runFamilyGeneration(supabase, user.id, { onlyMemberId: nextId })
        : await runFamilyGeneration(supabase, user.id, { regenerateSharedGroup: true });
  }
  return { fired: gen.ok, busy: !gen.ok && gen.kind === "busy" };
}

/**
 * The single member a generation run should target next, in STRICT order — shared
 * by the deferred drain and addFamilyMember so adds never jump the queue:
 *  1. an in-plan member still missing a mealed day (a day that failed after in-run
 *     retries), under the retry cap → finish it before starting anyone new;
 *  2. else the first ABSENT pending member by member_addition_order (then
 *     display_order);
 *  3. else null (nothing to do).
 * Pure: callers pass the already-loaded plan + members + order.
 */
function pickNextMemberId(params: {
  plan: MealPlan;
  members: { id: string; role: string; display_order: number }[];
  additionOrder: string[];
}): string | null {
  const { plan, members, additionOrder } = params;
  const daysTotal = plan.days_total ?? 7;
  const genAttempts = plan.gen_attempts ?? {};
  const incomplete = plan.members.find(
    (m) =>
      m.days.filter((d) => d.meals.length > 0).length < daysTotal &&
      (genAttempts[m.member_id] ?? 0) < MEMBER_GEN_MAX_ATTEMPTS,
  );
  if (incomplete) return incomplete.member_id;

  const planMemberIds = plan.members.map((m) => m.member_id);
  const pending = members.filter(
    (m) => m.role !== "housekeeper" && !planMemberIds.includes(m.id),
  );
  if (pending.length === 0) return null;

  const orderIndex = (id: string) => {
    const i = additionOrder.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...pending].sort(
    (a, b) =>
      orderIndex(a.id) - orderIndex(b.id) || a.display_order - b.display_order,
  )[0]!.id;
}

/**
 * Trigger generation for onboarding / family changes (rate limit bypassed) and
 * map the dispatch result to a user-facing Arabic message. Shared by
 * saveMomProfile and the Phase 2 family actions.
 */
type FamilyGenResult =
  | { ok: true; plan_generation_id: string }
  | { ok: false; kind: "upgrade"; current: number; max: number }
  | { ok: false; kind: "busy" }
  | { ok: false; kind: "error"; error: string };

async function runFamilyGeneration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  opts: {
    regenerateMemberId?: string;
    onlyMemberId?: string;
    regenerateSharedGroup?: boolean;
    fullRegen?: boolean;
  } = {},
): Promise<FamilyGenResult> {
  const result = await triggerPlanGeneration({
    supabase,
    userId,
    bypassRateLimit: true,
    // Family changes are incremental: keep already-generated members and
    // generate only the new/edited one (aligned to the family's dishes).
    // regenerateSharedGroup rebuilds the WHOLE shared group together (carry-over
    // ON — independent members are kept) when a new shared member is added.
    // A full regen (fullRegen) is the only one with carry-over OFF — it's needed
    // when the change affects EVERY meal (e.g. adding a housekeeper, which
    // requires translating all recipes).
    carryOver: !opts.fullRegen,
    regenerateMemberId: opts.regenerateMemberId,
    onlyMemberId: opts.onlyMemberId,
    regenerateSharedGroup: opts.regenerateSharedGroup,
  });

  if (result.ok) return { ok: true, plan_generation_id: result.mealPlanId };

  switch (result.kind) {
    case "busy":
      return { ok: false, kind: "busy" };
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
  // Shared family meals (default) vs the member's own independent dishes.
  meal_mode?: "shared" | "independent";
  // Coach questionnaire (00013) — adults; pregnant/lactating get the safe
  // subset (meds/supplements/water); children none.
  day_nature?: DayNature;
  exercise_days?: ExerciseDays;
  exercise_type?: ExerciseType | null;
  target_weight_kg?: number | null;
  water_cups?: number | null;
  sleep_hours?: number | null;
  medications?: string[];
  supplements?: string[];
  // child
  school_meal_handling?: string | null;
  picky_eater?: boolean;
  // pregnant
  trimester?: number | null;
  high_risk_pregnancy?: boolean;
  nausea_foods?: string[];
  // lactating
  months_postpartum?: number | null;
  feeding_mode?: "exclusive" | "mixed" | "formula" | null;
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
    primaryGoal = mapUserGoalToSara(input.user_goal ?? "maintain_weight", {
      hasMedical,
      isPregnantOrLactating: false,
      conditions,
    });
  }

  const isAdult = input.member_type === "adult";
  // Derive the canonical level from the concrete answers when available.
  const activityLevel =
    isAdult && input.day_nature && input.exercise_days
      ? activityLevelFrom(input.day_nature, input.exercise_days)
      : (input.activity_level ?? null);

  return {
    user_id: userId,
    name: input.name,
    role: input.role,
    member_type: input.member_type,
    sex: input.sex ?? null,
    birth_year: input.birth_year,
    height_cm: input.height_cm ?? null,
    weight_kg: input.weight_kg ?? null,
    activity_level: activityLevel,
    primary_goal: primaryGoal,
    preferred_language: input.preferred_language ?? "ar",
    meal_mode: input.meal_mode ?? "shared",
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
    // Coach questionnaire (00013). Supplements now land in their OWN column —
    // the old lactating wizard folded them into medical_conditions via
    // other_condition (data corruption, fixed with the wizard in the same
    // release). Children get none of these.
    target_weight_kg: isAdult ? (input.target_weight_kg ?? null) : null,
    day_nature: isAdult ? (input.day_nature ?? null) : null,
    exercise_days: isAdult ? (input.exercise_days ?? null) : null,
    exercise_type: isAdult ? (input.exercise_type ?? null) : null,
    sleep_hours: isAdult ? (input.sleep_hours ?? null) : null,
    water_cups: input.member_type === "child" ? null : (input.water_cups ?? null),
    medications: input.member_type === "child" ? [] : (input.medications ?? []),
    supplements: input.member_type === "child" ? [] : (input.supplements ?? []),
    nausea_foods:
      input.member_type === "pregnant" ? (input.nausea_foods ?? []) : [],
    feeding_mode:
      input.member_type === "lactating" ? (input.feeding_mode ?? null) : null,
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

  if (!familyMemberInputSchema.safeParse(input).success) {
    return { ok: false, error: VALIDATION_ERROR_AR };
  }

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
    .select("member_addition_order, onboarding_completed_at")
    .eq("id", user.id)
    .single();
  const typedProfile = profileRow as
    | { member_addition_order: unknown; onboarding_completed_at: string | null }
    | null;
  const additionOrder = typedProfile?.member_addition_order;
  const order = Array.isArray(additionOrder) ? (additionOrder as string[]) : [];
  const updatedOrder = [...order, memberId];
  await supabase
    .from("profiles")
    .update({ member_addition_order: updatedOrder })
    .eq("id", user.id);

  revalidatePath("/family");

  // Onboarding add-a-member loop (onboarding not finalized yet): just SAVE the
  // member — no generation. The whole family is generated once at the end of the
  // loop via finishOnboardingAndGenerate. (There's no plan to carry over yet
  // anyway.) Post-onboarding adds (below) generate incrementally.
  if (!typedProfile?.onboarding_completed_at) {
    return { ok: true, member_id: memberId, plan_generation_id: null };
  }

  // Post-onboarding generation. A SHARED add rebuilds the whole shared group
  // together so the existing shared members stream in day-by-day alongside the
  // newcomer; an INDEPENDENT add (or no base plan) keeps the one-at-a-time drain.
  const latest = await getLatestPlan(user.id);
  const basePlan =
    latest?.status === "ready" && latest.plan_data && planHasContent(latest.plan_data)
      ? latest.plan_data
      : null;
  const isSharedAdd = (input.meal_mode ?? "shared") === "shared";

  let gen: FamilyGenResult;
  if (isSharedAdd && basePlan) {
    // Shared add: rebuild the WHOLE shared group together (mom + every shared member
    // + the newcomer) so the new menu is genuinely shared and the existing shared
    // members stream in day-by-day alongside the new one. Independent members + the
    // housekeeper are carried over verbatim. (A lone shared member — no one else
    // shares — just generates itself, handled downstream.)
    gen = await runFamilyGeneration(supabase, user.id, { regenerateSharedGroup: true });
  } else {
    // Independent add (or no base plan to carry): one-at-a-time drain. Generate the
    // NEXT member in order — NOT necessarily the just-added one. If an earlier-added
    // member is still pending (or an in-plan member is incomplete), it goes first;
    // the just-added member waits its turn. Others are carried; never two members
    // generating at once.
    let target = memberId;
    if (basePlan) {
      const { data: famRows } = await supabase
        .from("family_members")
        .select("id, role, display_order")
        .eq("user_id", user.id)
        .returns<{ id: string; role: string; display_order: number }[]>();
      target =
        pickNextMemberId({
          plan: basePlan,
          members: famRows ?? [],
          additionOrder: updatedOrder,
        }) ?? memberId;
    }
    gen = await runFamilyGeneration(supabase, user.id, { onlyMemberId: target });
  }
  if (gen.ok)
    return { ok: true, member_id: memberId, plan_generation_id: gen.plan_generation_id };
  if (gen.kind === "upgrade")
    return { ok: false, upgrade_required: true, member_id: memberId, current: gen.current, max: gen.max };
  // Current plan still generating → member is saved; defer their generation (the
  // dashboard "generate plan" banner picks it up once the current plan is ready).
  if (gen.kind === "busy")
    return { ok: true, member_id: memberId, plan_generation_id: null };
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
  // Current plan still generating → removal is saved; defer the regen.
  if (gen.kind === "busy") return { ok: true, plan_generation_id: null };
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

  if (!familyMemberInputSchema.safeParse(input).success) {
    return { ok: false, error: VALIDATION_ERROR_AR };
  }

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
    before.meal_mode !== row.meal_mode ||
    before.activity_level !== row.activity_level ||
    Number(before.target_weight_kg ?? 0) !== Number(row.target_weight_kg ?? 0) ||
    before.feeding_mode !== row.feeding_mode ||
    JSON.stringify(before.medications ?? []) !== JSON.stringify(row.medications) ||
    JSON.stringify(before.supplements ?? []) !== JSON.stringify(row.supplements) ||
    JSON.stringify(before.nausea_foods ?? []) !== JSON.stringify(row.nausea_foods) ||
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
  // Current plan still generating → edit is saved; defer the regen.
  if (gen.kind === "busy")
    return { ok: true, member_id: memberId, plan_generation_id: null };
  return { ok: false, error: gen.error };
}
