"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { MealPlanSchema, type MealPlan } from "@fitlife/plan-engine";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayNameFromWeekStart } from "@/lib/plans/dayMapping";

export type RestoreResult = { ok: true } | { ok: false; error: string };

/**
 * Per-member restore: copy ONLY `memberId`'s meals from a past plan into the
 * CURRENT plan's slot for that member, re-anchored to the current plan's week.
 * Every other member's current plan is left untouched — members are independent
 * (a shared meal may end up with mixed-origin portions, which is acceptable).
 * No AI cost — a merge via the admin client (RLS blocks user writes).
 */
export async function restorePlan(
  planId: string,
  memberId: string,
): Promise<RestoreResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const admin = createAdminClient();

  // Source = the past plan being restored from.
  const { data: sourceRow } = await admin
    .from("meal_plans")
    .select("plan_data, status")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  const source = sourceRow as { plan_data: unknown; status: string } | null;
  if (!source || source.status !== "ready") {
    return { ok: false, error: "الخطة غير موجودة" };
  }
  const sourceParsed = MealPlanSchema.safeParse(source.plan_data);
  if (!sourceParsed.success) {
    return { ok: false, error: "تعذّر استعادة هذه الخطة" };
  }
  const sourceMember = sourceParsed.data.members.find(
    (m) => m.member_id === memberId,
  );
  if (!sourceMember) {
    return { ok: false, error: "هذا الفرد غير موجود في هذه الخطة" };
  }

  // Current plan = newest non-archived row. We merge into it in place so only
  // this member's slot changes.
  const { data: currentRow } = await admin
    .from("meal_plans")
    .select("id, plan_data, status")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const current = currentRow as
    | { id: string; plan_data: unknown; status: string }
    | null;
  const currentParsed = current
    ? MealPlanSchema.safeParse(current.plan_data)
    : null;
  if (!current || current.status !== "ready" || !currentParsed?.success) {
    return { ok: false, error: "ما فيه خطة حالية لاستعادة الفرد فيها" };
  }
  if (current.id === planId) {
    return { ok: false, error: "هذي خطة الفرد الحالية بالفعل" };
  }

  // Re-anchor the restored member's day names to the CURRENT plan's week so this
  // member lines up with the rest of the family; meals + targets come from the
  // source plan unchanged.
  const weekStart = currentParsed.data.week_start_date;
  const restoredMember = {
    ...sourceMember,
    days: sourceMember.days.map((d) => ({
      ...d,
      day_name_ar: dayNameFromWeekStart(weekStart, d.day_index),
    })),
  };

  const exists = currentParsed.data.members.some(
    (m) => m.member_id === memberId,
  );
  const mergedMembers = exists
    ? currentParsed.data.members.map((m) =>
        m.member_id === memberId ? restoredMember : m,
      )
    : [...currentParsed.data.members, restoredMember];

  const mergedPlan: MealPlan = {
    ...currentParsed.data,
    members: mergedMembers,
  };

  const { error } = await admin
    .from("meal_plans")
    .update({ plan_data: mergedPlan, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("user_id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "plan-restore", userId: user.id },
    });
    return { ok: false, error: "فشلت الاستعادة. حاولي مرة ثانية" };
  }

  revalidatePath("/plan");
  revalidatePath("/plan/history");
  return { ok: true };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Per-member de-list: hide this plan from member `memberId`'s Previous Plans
 * view only — other members keep their access, and the active plan is
 * unaffected. Tracked in plan_data.hidden_for_member_ids (no row archived, so we
 * never destroy another member's history). Admin client (RLS blocks user writes).
 */
export async function deletePlan(
  planId: string,
  memberId: string,
): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "يجب تسجيل الدخول" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("meal_plans")
    .select("plan_data")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  const parsed = row
    ? MealPlanSchema.safeParse((row as { plan_data: unknown }).plan_data)
    : null;
  if (!parsed?.success) {
    return { ok: false, error: "الخطة غير موجودة" };
  }

  const hidden = new Set(parsed.data.hidden_for_member_ids ?? []);
  hidden.add(memberId);
  const nextPlan: MealPlan = {
    ...parsed.data,
    hidden_for_member_ids: [...hidden],
  };

  const { error } = await admin
    .from("meal_plans")
    .update({ plan_data: nextPlan, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", user.id);

  if (error) {
    Sentry.captureException(error, {
      tags: { area: "plan-delete", userId: user.id },
    });
    return { ok: false, error: "فشل الحذف. حاولي مرة ثانية" };
  }

  revalidatePath("/plan/history");
  return { ok: true };
}
