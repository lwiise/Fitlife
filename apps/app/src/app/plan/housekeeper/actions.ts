"use server";

import { createClient } from "@/lib/supabase/server";
import { triggerPlanTranslation } from "@/lib/plans/dispatch";
import { isLocaleCode } from "@/lib/plans/locales";

/**
 * Ensure the user's current plan is translated into the housekeeper's language.
 * Called by the maid view when it detects untranslated meals. Idempotent —
 * translateMealPlan skips meals/names already done, so polling won't duplicate
 * work or spawn a regeneration.
 */
export async function requestHousekeeperTranslation(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: hk } = await supabase
    .from("family_members")
    .select("preferred_language")
    .eq("user_id", user.id)
    .eq("role", "housekeeper")
    .maybeSingle();

  const locale = (hk as { preferred_language: string } | null)?.preferred_language;
  if (!isLocaleCode(locale) || locale === "ar") return { ok: false };

  await triggerPlanTranslation({ supabase, userId: user.id, locale });
  return { ok: true };
}
