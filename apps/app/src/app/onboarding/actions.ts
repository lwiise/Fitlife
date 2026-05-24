"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
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
