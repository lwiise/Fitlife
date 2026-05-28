"use server";
import "server-only";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { MealPlanSchema } from "@fitlife/plan-engine";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { riyadhTodayISO, dayNameFromWeekStart } from "@/lib/plans/dayMapping";

export type RestoreResult = { ok: true } | { ok: false; error: string };

/**
 * Restore a past plan: copy its meals into a NEW current plan, re-anchored to
 * today (same meals, current week). No AI cost. Auth + ownership checked; the
 * INSERT uses the service-role client because RLS forbids user inserts.
 */
export async function restorePlan(planId: string): Promise<RestoreResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const admin = createAdminClient();
  const { data: source } = await admin
    .from("meal_plans")
    .select("plan_data, status, ai_model")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();

  const row = source as
    | { plan_data: unknown; status: string; ai_model: string | null }
    | null;
  if (!row || row.status !== "ready") {
    return { ok: false, error: "الخطة غير موجودة" };
  }

  const parsed = MealPlanSchema.safeParse(row.plan_data);
  if (!parsed.success) return { ok: false, error: "تعذّر استعادة هذه الخطة" };

  // Re-anchor to today: same meals/targets, current week dates + day names.
  const today = riyadhTodayISO();
  const reAnchored = {
    ...parsed.data,
    week_start_date: today,
    members: parsed.data.members.map((m) => ({
      ...m,
      days: m.days.map((d) => ({
        ...d,
        day_name_ar: dayNameFromWeekStart(today, d.day_index),
      })),
    })),
  };

  const { error } = await admin.from("meal_plans").insert({
    id: randomUUID(),
    user_id: user.id,
    status: "ready",
    plan_data: reAnchored,
    generated_at: new Date().toISOString(),
    ai_model: row.ai_model ?? null,
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "plan-restore", userId: user.id },
    });
    return { ok: false, error: "فشلت الاستعادة. حاولي مرة ثانية" };
  }

  revalidatePath("/plan");
  return { ok: true };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Delete a plan the user no longer needs (soft-delete → status "archived").
 * Hidden everywhere: history lists only "ready" plans, and getLatestPlan skips
 * archived (so deleting the current plan falls back to the next). Avoids
 * orphaning plan_generations audit rows. Admin client (RLS blocks user writes).
 */
export async function deletePlan(planId: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("meal_plans")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "plan-delete", userId: user.id },
    });
    return { ok: false, error: "فشل الحذف. حاولي مرة ثانية" };
  }

  revalidatePath("/plan/history");
  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true };
}
