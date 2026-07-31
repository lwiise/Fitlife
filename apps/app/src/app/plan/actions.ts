"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { ownerRequiresDoctorSignOff } from "@fitlife/plan-engine";

type ConfirmResult = { ok: true } | { ok: false; error: string };

/**
 * Record the account owner's doctor confirmation from the plan page.
 *
 * The generation gate refuses a plan while `consulted_doctor` is false for
 * anyone with a condition or a pregnancy. Before this, the only place to set
 * it was a wizard step that older profiles never saw, so a blocked owner had
 * no way out of the empty plan page. This is that way out.
 *
 * Deliberately narrow: it flips exactly one boolean on the caller's OWN
 * profile, and only when the gate actually applies to her — it can't be used
 * to pre-confirm a profile that was never gated.
 */
export async function confirmDoctorConsult(): Promise<ConfirmResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "يجب تسجيل الدخول" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("medical_conditions, has_medical_conditions, is_pregnant")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "تعذّر قراءة ملفك" };

  if (
    !ownerRequiresDoctorSignOff({
      medical_conditions: profile.medical_conditions,
      has_medical_conditions: profile.has_medical_conditions,
      is_pregnant: profile.is_pregnant,
    })
  ) {
    // Nothing to confirm — treat as done so a stale tab doesn't show an error.
    return { ok: true };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ consulted_doctor: true })
    .eq("id", user.id);
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "plan", step: "confirmDoctorConsult", userId: user.id },
    });
    return { ok: false, error: "فشل الحفظ — يمكنك المحاولة مرة أخرى" };
  }

  revalidatePath("/plan");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}
