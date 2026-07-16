"use server";

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { canonicalRecipeKey } from "@fitlife/plan-engine";
import { riyadhTodayISO } from "@/lib/plans/dayMapping";
import { createClient } from "@/lib/supabase/server";
import { closeDayInputSchema, type CloseDayInput } from "./serverSchemas";

const VALIDATION_ERROR_AR = "بيانات غير صالحة";

/** How many days back a day may still be closed («retroactive-first», 48h). */
const GRACE_DAYS = 2;

/** YYYY-MM-DD + n days → YYYY-MM-DD (pure calendar math, no TZ). */
function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * ختام اليوم — persist one day's household check-in in a single submit:
 * per-slot answers, per-member dish verdicts (canonical_key minted HERE,
 * never client-side), and dish-directed member exceptions.
 *
 * The day's calendar identity is DERIVED server-side (plan.week_start_date +
 * day_index) and gated to a 48-hour grace window — the client never supplies
 * a date. Resubmitting the same day upserts: answers are corrections, not
 * duplicates. Unanswered slots are simply absent (unknown ≠ skipped).
 */
export async function closeDay(rawInput: CloseDayInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = closeDayInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: VALIDATION_ERROR_AR };
  const input = parsed.data;

  // Ownership + week anchor in one RLS-scoped read. Archived plans are valid
  // targets on purpose: a mid-week regen must not orphan yesterday's close.
  const { data: planRow, error: planError } = await supabase
    .from("meal_plans")
    .select("week_start:plan_data->>week_start_date")
    .eq("id", input.meal_plan_id)
    .eq("user_id", user.id)
    .single();
  const weekStart = (planRow as { week_start?: string } | null)?.week_start;
  if (planError || !weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  const localDate = addDaysISO(weekStart, input.day_index);
  const today = riyadhTodayISO();
  const oldestAllowed = addDaysISO(today, -GRACE_DAYS);
  if (localDate > today || localDate < oldestAllowed) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  // 00017 tables aren't in the generated Database types until db:types re-runs
  // post-apply — writes go through the untyped client (see lib/engagement/types.ts).
  const db = supabase as unknown as SupabaseClient;

  const { error: checkinError } = await db.from("meal_checkins").upsert(
    input.slots.map((s) => ({
      user_id: user.id,
      meal_plan_id: input.meal_plan_id,
      day_index: input.day_index,
      local_date: localDate,
      slot: s.slot,
      status: s.status,
      reason: s.status === "cooked" ? null : (s.reason ?? null),
    })),
    { onConflict: "meal_plan_id,day_index,slot" },
  );
  if (checkinError) {
    Sentry.captureException(checkinError, {
      tags: { area: "engagement", step: "checkin-upsert", userId: user.id },
    });
    return { ok: false as const, error: "تعذر حفظ يومك، حاولي مرة أخرى" };
  }

  if (input.verdicts.length > 0) {
    const rows = input.verdicts
      .map((v) => ({
        user_id: user.id,
        meal_plan_id: input.meal_plan_id,
        member_id: v.member_id,
        day_index: input.day_index,
        slot: v.slot,
        recipe_name_ar: v.recipe_name_ar,
        canonical_key: canonicalRecipeKey(v.recipe_name_ar),
        verdict: v.verdict,
      }))
      // A name that normalizes to nothing has no aggregatable identity — skip.
      .filter((r) => r.canonical_key.length > 0);
    if (rows.length > 0) {
      const { error: verdictError } = await db
        .from("meal_verdicts")
        .upsert(rows, { onConflict: "meal_plan_id,member_id,day_index,slot" });
      if (verdictError) {
        Sentry.captureException(verdictError, {
          tags: { area: "engagement", step: "verdict-upsert", userId: user.id },
        });
        return { ok: false as const, error: "تعذر حفظ الآراء، حاولي مرة أخرى" };
      }
    }
  }

  // Exceptions: resubmission REPLACES the day's exceptions (delete-then-insert
  // under the day's checkin ids), so removing a mistaken tap works naturally.
  const { data: checkinRows } = await db
    .from("meal_checkins")
    .select("id,slot")
    .eq("meal_plan_id", input.meal_plan_id)
    .eq("day_index", input.day_index);
  const checkinIdBySlot = new Map(
    ((checkinRows ?? []) as Array<{ id: string; slot: string }>).map((r) => [
      r.slot,
      r.id,
    ]),
  );
  const checkinIds = [...checkinIdBySlot.values()];
  if (checkinIds.length > 0) {
    await db.from("member_exceptions").delete().in("checkin_id", checkinIds);
    const exceptionRows = input.exceptions
      .map((e) => ({
        user_id: user.id,
        checkin_id: checkinIdBySlot.get(e.slot),
        member_id: e.member_id,
        kind: "dish_not_suited",
      }))
      .filter((r): r is typeof r & { checkin_id: string } => !!r.checkin_id);
    if (exceptionRows.length > 0) {
      const { error: exceptionError } = await db
        .from("member_exceptions")
        .insert(exceptionRows);
      if (exceptionError) {
        Sentry.captureException(exceptionError, {
          tags: { area: "engagement", step: "exception-insert", userId: user.id },
        });
        // Non-fatal: the day itself is saved; exceptions are a refinement.
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/plan");
  return { ok: true as const, local_date: localDate };
}
