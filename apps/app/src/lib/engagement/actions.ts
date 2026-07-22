"use server";

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { canonicalRecipeKey } from "@fitlife/plan-engine";
import { riyadhTodayISO } from "@/lib/plans/dayMapping";
import { createClient } from "@/lib/supabase/server";
import {
  isChildWeighInMember,
  isWeighInEligibleMember,
  isWeighInEligibleMom,
} from "./eligibility";
import { BODY_PHOTOS_BUCKET, HOUSEHOLD_CHECKIN_MEMBER } from "./types";
import {
  closeDayInputSchema,
  logBodyWeightSchema,
  setMealAbsenceSchema,
  setMealCheckinSchema,
  setMealVerdictSchema,
  setSharedMealCheckinSchema,
  setWorkoutCheckinSchema,
  type CloseDayInput,
  type LogBodyWeightInput,
  type SetMealAbsenceInput,
  type SetMealCheckinInput,
  type SetMealVerdictInput,
  type SetSharedMealCheckinInput,
  type SetWorkoutCheckinInput,
} from "./serverSchemas";

const VALIDATION_ERROR_AR = "تعذر حفظ البيانات، يرجى المحاولة مرة أخرى";
const AUTH_ERROR_AR = "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى";

/**
 * The floor of the retroactive marking window, in days. Meal marks now stay
 * open for the WHOLE plan week — any elapsed day, never the future (owner
 * directive 07/2026), so a mom can complete or correct earlier days anytime
 * before the week rolls over into history. Weekday-anchored workout sessions
 * stay markable for the whole current week too, with this as the floor so the
 * last couple days of the previous week keep their grace.
 */
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
 * day_index) and gated to the plan week — any elapsed day is markable, never a
 * future one; the client never supplies a date. Resubmitting the same day
 * upserts: answers are corrections, not duplicates. Unanswered slots are simply
 * absent (unknown ≠ skipped).
 */
export async function closeDay(rawInput: CloseDayInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: AUTH_ERROR_AR };

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

  // Markable = any elapsed day of the plan week, never a future day (adherence
  // can't be pre-marked). day_index ∈ [0,6] ⇒ localDate ∈ [weekStart,
  // weekStart+6], so the whole week stays open until it rolls over into history.
  const localDate = addDaysISO(weekStart, input.day_index);
  const today = riyadhTodayISO();
  if (localDate > today) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  const db = supabase;

  // The sheet is the kitchen's attestation → rows carry the 'household'
  // member sentinel on purpose (per-person marks live on the plan page).
  // member_id is a 00019 column not yet in the generated types → untyped
  // cast (house pattern); on a pre-00019 prod the write degrades to the
  // legacy household-level shape so the day still saves.
  const checkinRowsInput = input.slots.map((s) => ({
    user_id: user.id,
    meal_plan_id: input.meal_plan_id,
    day_index: input.day_index,
    local_date: localDate,
    slot: s.slot,
    status: s.status,
    reason: s.status === "cooked" ? null : (s.reason ?? null),
  }));
  const { error: checkinError } = await (db as unknown as SupabaseClient)
    .from("meal_checkins")
    .upsert(
      checkinRowsInput.map((r) => ({
        ...r,
        member_id: HOUSEHOLD_CHECKIN_MEMBER,
      })),
      { onConflict: "meal_plan_id,day_index,slot,member_id" },
    );
  if (checkinError) {
    const { error: legacyError } = await db
      .from("meal_checkins")
      .upsert(checkinRowsInput, { onConflict: "meal_plan_id,day_index,slot" });
    if (legacyError) {
      Sentry.captureException(checkinError, {
        tags: { area: "engagement", step: "checkin-upsert", userId: user.id },
      });
      return { ok: false as const, error: "تعذر حفظ يومك، يرجى المحاولة مرة أخرى" };
    }
    Sentry.captureMessage(
      "meal_checkins write fell back to pre-00019 shape — apply migration 00019",
      { level: "warning", tags: { area: "engagement", step: "checkin-upsert" } },
    );
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
        return { ok: false as const, error: "تعذر حفظ الآراء، يرجى المحاولة مرة أخرى" };
      }
    }
  }

  // Exceptions: resubmission REPLACES the day's exceptions (delete-then-insert
  // under the day's checkin ids), so removing a mistaken tap works naturally.
  // select("*") tolerates a pre-00019 prod (rows without member_id); with
  // 00019 applied, a slot can carry per-member rows next to the whole-kitchen
  // row — exceptions ride the household row (the one this sheet just wrote).
  const { data: checkinRows } = await db
    .from("meal_checkins")
    .select("*")
    .eq("meal_plan_id", input.meal_plan_id)
    .eq("day_index", input.day_index);
  const dayRows = (checkinRows ?? []) as Array<{
    id: string;
    slot: string;
    member_id?: string | null;
  }>;
  const checkinIdBySlot = new Map<string, string>();
  for (const r of dayRows) {
    const isHousehold =
      (r.member_id ?? HOUSEHOLD_CHECKIN_MEMBER) === HOUSEHOLD_CHECKIN_MEMBER;
    if (isHousehold || !checkinIdBySlot.has(r.slot)) {
      checkinIdBySlot.set(r.slot, r.id);
    }
  }
  const checkinIds = dayRows.map((r) => r.id);
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

/** Weekday (0=Sunday, matches JS getDay) of a Riyadh-local YYYY-MM-DD date. */
function weekdayOfISO(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

/**
 * Inline workout-session marking from the plan page (?view=workout) — «هل
 * أنجزت حصة اليوم؟» done/moved/skipped. The exercise pillar's honest signal:
 * feeds «موسم بيتنا» and any future workout streaks. Same no-fabrication rules
 * as meals — a session can't be marked before its day, and clearing (status
 * null) removes the mark.
 *
 * Workout day_index is WEEKDAY-anchored (0=Sunday), so the session's calendar
 * date is derived from its weekday within the current week (Sunday-anchored,
 * with a 48h floor for the previous week's tail): the most recent past-or-today
 * date whose weekday matches. No such date → the session is in the future this
 * week → rejected. This mirrors the meal window (the whole plan week).
 */
export async function setWorkoutCheckin(rawInput: SetWorkoutCheckinInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: AUTH_ERROR_AR };

  const parsed = setWorkoutCheckinSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: VALIDATION_ERROR_AR };
  const input = parsed.data;

  // Ownership (RLS-scoped): the workout plan must belong to the caller.
  const { data: planRow, error: planError } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("id", input.workout_plan_id)
    .eq("user_id", user.id)
    .single();
  if (planError || !planRow) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  // Derive the session's calendar date from its weekday, scanning back over the
  // whole current week (Sunday-anchored), with GRACE_DAYS as a floor so the tail
  // of the previous week keeps its grace. Never the future: within any ≤7-day
  // span a given weekday occurs at most once, so this resolves uniquely or not
  // at all, and a future session this week has no past date to resolve to.
  const today = riyadhTodayISO();
  const maxBack = Math.max(weekdayOfISO(today), GRACE_DAYS);
  let localDate: string | null = null;
  for (let off = 0; off <= maxBack; off++) {
    const candidate = addDaysISO(today, -off);
    if (weekdayOfISO(candidate) === input.day_index) {
      localDate = candidate;
      break;
    }
  }
  if (!localDate) return { ok: false as const, error: VALIDATION_ERROR_AR };

  const db = supabase as unknown as SupabaseClient;

  if (input.status === null) {
    const { error } = await db
      .from("workout_checkins")
      .delete()
      .eq("user_id", user.id)
      .eq("workout_plan_id", input.workout_plan_id)
      .eq("member_id", input.member_id)
      .eq("day_index", input.day_index);
    if (error) {
      Sentry.captureException(error, {
        tags: { area: "engagement", step: "workout-checkin-clear", userId: user.id },
      });
      return { ok: false as const, error: "تعذر حفظ التسجيل، يرجى المحاولة مرة أخرى" };
    }
    // Workout marks feed the «موسم بيتنا» leaderboard (on the dashboard), so
    // refresh both surfaces — the board must change as exercise state changes.
    revalidatePath("/plan");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }

  const { error } = await db.from("workout_checkins").upsert(
    {
      user_id: user.id,
      workout_plan_id: input.workout_plan_id,
      member_id: input.member_id,
      day_index: input.day_index,
      local_date: localDate,
      status: input.status,
    },
    { onConflict: "workout_plan_id,member_id,day_index" },
  );
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "engagement", step: "workout-checkin-upsert", userId: user.id },
    });
    return { ok: false as const, error: "تعذر حفظ التسجيل، يرجى المحاولة مرة أخرى" };
  }
  // Workout marks feed the «موسم بيتنا» leaderboard (on the dashboard).
  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Inline per-dish verdict from the plan page — «كيف كانت؟» on a dish the
 * household actually cooked. Same table and calendar-honesty rules as the
 * ختام اليوم sheet: server-derived date, any elapsed day of the plan week,
 * never a future day. Feeds the engagement digest's golden dishes (loved) and
 * vetoes (not_again), which drive «سارة عدّلت خطتك» and the weekly letter's
 * dish of the week.
 *
 * PER PERSON: member_id is whose verdict this is — keyed (plan, member, day,
 * slot), so a shared dish accrues one loved-vote per participant. The
 * canonical_key is minted HERE (never client-side). verdict null clears a tap.
 */
export async function setMealVerdict(rawInput: SetMealVerdictInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: AUTH_ERROR_AR };

  const parsed = setMealVerdictSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: VALIDATION_ERROR_AR };
  const input = parsed.data;

  // Ownership + week anchor (RLS-scoped). Archived plans stay valid targets so
  // a mid-week regen never orphans yesterday's verdict.
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

  // A verdict cannot be cast on a day that hasn't happened yet — the same
  // honesty gate as the check-in write (never the future). The whole plan week
  // stays open, so a cooked dish can be judged any elapsed day before the week
  // rolls over. meal_verdicts carries no date column, so the window is checked
  // from the derived date here.
  const localDate = addDaysISO(weekStart, input.day_index);
  const today = riyadhTodayISO();
  if (localDate > today) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  const db = supabase as unknown as SupabaseClient;

  if (input.verdict === null) {
    const { error } = await db
      .from("meal_verdicts")
      .delete()
      .eq("user_id", user.id)
      .eq("meal_plan_id", input.meal_plan_id)
      .eq("member_id", input.member_id)
      .eq("day_index", input.day_index)
      .eq("slot", input.slot);
    if (error) {
      Sentry.captureException(error, {
        tags: { area: "engagement", step: "verdict-clear", userId: user.id },
      });
      return { ok: false as const, error: "تعذر حفظ رأيك، يرجى المحاولة مرة أخرى" };
    }
    // A verdict counts toward the «موسم بيتنا» leaderboard (on the dashboard),
    // so refresh both surfaces — otherwise the board stays stale until an
    // unrelated refresh.
    revalidatePath("/plan");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }

  // A name that normalizes to nothing has no aggregatable identity (matches
  // closeDay). Real plan dishes always canonicalize — this only guards a
  // hand-crafted request; the optimistic UI reverts.
  const canonicalKey = canonicalRecipeKey(input.recipe_name_ar);
  if (canonicalKey.length === 0) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }
  const { error } = await db.from("meal_verdicts").upsert(
    {
      user_id: user.id,
      meal_plan_id: input.meal_plan_id,
      member_id: input.member_id,
      day_index: input.day_index,
      slot: input.slot,
      recipe_name_ar: input.recipe_name_ar,
      canonical_key: canonicalKey,
      verdict: input.verdict,
    },
    { onConflict: "meal_plan_id,member_id,day_index,slot" },
  );
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "engagement", step: "verdict-upsert", userId: user.id },
    });
    return { ok: false as const, error: "تعذر حفظ رأيك، يرجى المحاولة مرة أخرى" };
  }
  // A verdict counts toward the «موسم بيتنا» leaderboard (on the dashboard).
  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Inline per-meal marking from the plan page — one slot at a time, same
 * table and same rules as the «ختام اليوم» sheet: server-derived calendar
 * date, the whole plan week stays markable — any elapsed day, never a future
 * day (adherence cannot be fabricated ahead of time). status null clears an
 * accidental mark.
 *
 * PER-PERSON (00019): member_id says whose status this is — on a shared meal
 * each participant is marked separately (Louis can skip the dish anas ate).
 * A whole-house row ('household': legacy, or ختام اليوم) is NEVER destroyed
 * by a per-member write — it is the kitchen's attestation and stays as the
 * read-time fallback for members without their own row (member_exceptions
 * also cascade off it). Clearing deletes the member's own row; un-tapping a
 * chip lit only by the fallback retracts the household row itself. On a
 * pre-00019 prod the write degrades to the legacy household-level shape
 * (marking keeps working; per-person separation waits for the migration).
 */
export async function setMealCheckin(rawInput: SetMealCheckinInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: AUTH_ERROR_AR };

  const parsed = setMealCheckinSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: VALIDATION_ERROR_AR };
  const input = parsed.data;
  const memberId = input.member_id;

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

  // The whole plan week stays markable until it rolls over — any elapsed day,
  // never a future one (adherence can't be pre-marked). day_index ∈ [0,6] keeps
  // localDate inside the plan week.
  const localDate = addDaysISO(weekStart, input.day_index);
  const today = riyadhTodayISO();
  if (localDate > today) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  // Ownership gate: a family_members id must belong to the caller (the
  // RLS-scoped read returns no row otherwise) — same posture as logBodyWeight.
  if (memberId !== "mom" && memberId !== HOUSEHOLD_CHECKIN_MEMBER) {
    const { data: member } = await supabase
      .from("family_members")
      .select("id")
      .eq("id", memberId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  // member_id is a 00019 column not yet in the generated types — untyped
  // client cast (house pattern; see logBodyWeight).
  const db = supabase as unknown as SupabaseClient;

  if (input.status === null) {
    // Clear the member's OWN row. select("id") reports what was deleted: if
    // nothing was (the chip the user un-tapped was lit by the whole-house
    // fallback), retract the household row itself — that is the mark they
    // are pointing at, and leaving it would make the tap look ignored.
    const { data: cleared, error: deleteError } = await db
      .from("meal_checkins")
      .delete()
      .eq("meal_plan_id", input.meal_plan_id)
      .eq("day_index", input.day_index)
      .eq("slot", input.slot)
      .eq("user_id", user.id)
      .eq("member_id", memberId)
      .select("id");
    if (deleteError) {
      // Pre-00019 prod (no member_id column): legacy household-level clear.
      const { error: legacyError } = await supabase
        .from("meal_checkins")
        .delete()
        .eq("meal_plan_id", input.meal_plan_id)
        .eq("day_index", input.day_index)
        .eq("slot", input.slot)
        .eq("user_id", user.id);
      if (legacyError) {
        Sentry.captureException(deleteError, {
          tags: { area: "engagement", step: "checkin-clear", userId: user.id },
        });
        return { ok: false as const, error: "تعذر مسح التسجيل، يرجى المحاولة مرة أخرى" };
      }
    } else if (
      ((cleared ?? []) as unknown[]).length === 0 &&
      memberId !== HOUSEHOLD_CHECKIN_MEMBER
    ) {
      const { error: fallbackClearError } = await db
        .from("meal_checkins")
        .delete()
        .eq("meal_plan_id", input.meal_plan_id)
        .eq("day_index", input.day_index)
        .eq("slot", input.slot)
        .eq("user_id", user.id)
        .eq("member_id", HOUSEHOLD_CHECKIN_MEMBER);
      if (fallbackClearError) {
        Sentry.captureException(fallbackClearError, {
          tags: { area: "engagement", step: "checkin-clear", userId: user.id },
        });
        return { ok: false as const, error: "تعذر مسح التسجيل، يرجى المحاولة مرة أخرى" };
      }
    }
  } else {
    const row = {
      user_id: user.id,
      meal_plan_id: input.meal_plan_id,
      day_index: input.day_index,
      local_date: localDate,
      slot: input.slot,
      status: input.status,
      reason: input.status === "cooked" ? null : (input.reason ?? null),
    };
    const { error: upsertError } = await db.from("meal_checkins").upsert(
      { ...row, member_id: memberId },
      { onConflict: "meal_plan_id,day_index,slot,member_id" },
    );
    if (upsertError) {
      // Pre-00019 prod: degrade to the legacy household-level write so the
      // mark still saves, and flag ops to apply the migration.
      const { error: legacyError } = await supabase
        .from("meal_checkins")
        .upsert(row, { onConflict: "meal_plan_id,day_index,slot" });
      if (legacyError) {
        Sentry.captureException(upsertError, {
          tags: { area: "engagement", step: "checkin-inline", userId: user.id },
        });
        return { ok: false as const, error: "تعذر حفظ التسجيل، يرجى المحاولة مرة أخرى" };
      }
      Sentry.captureMessage(
        "meal_checkins write fell back to pre-00019 shape — apply migration 00019",
        { level: "warning", tags: { area: "engagement", step: "checkin-inline" } },
      );
    }
    // A whole-house row for this meal, if any, is deliberately left in place:
    // it keeps answering for members without their own row, and deleting it
    // would cascade-destroy the day's member_exceptions and erase the
    // kitchen's attestation from the digest.
  }

  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true as const, local_date: localDate };
}

/**
 * Single-status marking for a SHARED meal (owner directive 07/2026): the dish
 * has ONE status — «طبختها كما هي / بدّلتها / تجاوزتها» — not a separate
 * answer per participant. One tap writes the same status for every PRESENT
 * participant in one fan-out (per-member rows, so the «موسم بيتنا» ranking
 * keeps its per-member credit and the digest keeps collapsing rows into one
 * MEAL by (local_date, slot)). Absent members (meal_absences) are simply not
 * in member_ids — they get no row, so their week stays honest.
 *
 * Same calendar rules as setMealCheckin: server-derived date, any elapsed day
 * of the plan week, never a future day. status null clears every present
 * participant's row; when nothing was cleared (the chip was lit only by a
 * legacy whole-house row), the household row itself is retracted — that is
 * the mark the user is pointing at. On a pre-00019 prod the write degrades to
 * the legacy household-level shape.
 */
export async function setSharedMealCheckin(rawInput: SetSharedMealCheckinInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: AUTH_ERROR_AR };

  const parsed = setSharedMealCheckinSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: VALIDATION_ERROR_AR };
  const input = parsed.data;
  const memberIds = [...new Set(input.member_ids)];

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

  // Adherence honesty gate — identical to setMealCheckin.
  const localDate = addDaysISO(weekStart, input.day_index);
  const today = riyadhTodayISO();
  if (localDate > today) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  // Ownership gate: every concrete family-member id must belong to the caller
  // (the RLS-scoped read returns fewer rows otherwise).
  const memberUuids = memberIds.filter((id) => id !== "mom");
  if (memberUuids.length > 0) {
    const { data: owned } = await supabase
      .from("family_members")
      .select("id")
      .in("id", memberUuids)
      .eq("user_id", user.id);
    if ((owned ?? []).length !== memberUuids.length) {
      return { ok: false as const, error: VALIDATION_ERROR_AR };
    }
  }

  // member_id is a 00019 column not yet in the generated types — untyped
  // client cast (house pattern).
  const db = supabase as unknown as SupabaseClient;

  if (input.status === null) {
    const { data: cleared, error: deleteError } = await db
      .from("meal_checkins")
      .delete()
      .eq("meal_plan_id", input.meal_plan_id)
      .eq("day_index", input.day_index)
      .eq("slot", input.slot)
      .eq("user_id", user.id)
      .in("member_id", memberIds)
      .select("id");
    if (deleteError) {
      // Pre-00019 prod (no member_id column): legacy household-level clear.
      const { error: legacyError } = await supabase
        .from("meal_checkins")
        .delete()
        .eq("meal_plan_id", input.meal_plan_id)
        .eq("day_index", input.day_index)
        .eq("slot", input.slot)
        .eq("user_id", user.id);
      if (legacyError) {
        Sentry.captureException(deleteError, {
          tags: { area: "engagement", step: "shared-checkin-clear", userId: user.id },
        });
        return { ok: false as const, error: "تعذر مسح التسجيل، يرجى المحاولة مرة أخرى" };
      }
    } else if (((cleared ?? []) as unknown[]).length === 0) {
      // The chip was lit only by a whole-house row (legacy / ختام اليوم) —
      // retract it, exactly as the per-member clear does.
      const { error: fallbackClearError } = await db
        .from("meal_checkins")
        .delete()
        .eq("meal_plan_id", input.meal_plan_id)
        .eq("day_index", input.day_index)
        .eq("slot", input.slot)
        .eq("user_id", user.id)
        .eq("member_id", HOUSEHOLD_CHECKIN_MEMBER);
      if (fallbackClearError) {
        Sentry.captureException(fallbackClearError, {
          tags: { area: "engagement", step: "shared-checkin-clear", userId: user.id },
        });
        return { ok: false as const, error: "تعذر مسح التسجيل، يرجى المحاولة مرة أخرى" };
      }
    }
  } else {
    const base = {
      user_id: user.id,
      meal_plan_id: input.meal_plan_id,
      day_index: input.day_index,
      local_date: localDate,
      slot: input.slot,
      status: input.status,
      reason: input.status === "cooked" ? null : (input.reason ?? null),
    };
    const { error: upsertError } = await db.from("meal_checkins").upsert(
      memberIds.map((memberId) => ({ ...base, member_id: memberId })),
      { onConflict: "meal_plan_id,day_index,slot,member_id" },
    );
    if (upsertError) {
      // Pre-00019 prod: one legacy household-level row so the mark still saves.
      const { error: legacyError } = await supabase
        .from("meal_checkins")
        .upsert(base, { onConflict: "meal_plan_id,day_index,slot" });
      if (legacyError) {
        Sentry.captureException(upsertError, {
          tags: { area: "engagement", step: "shared-checkin", userId: user.id },
        });
        return { ok: false as const, error: "تعذر حفظ التسجيل، يرجى المحاولة مرة أخرى" };
      }
      Sentry.captureMessage(
        "meal_checkins write fell back to pre-00019 shape — apply migration 00019",
        { level: "warning", tags: { area: "engagement", step: "shared-checkin" } },
      );
    }
  }

  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true as const, local_date: localDate };
}

/**
 * Shared-meal absence toggle (00021) — «إزالة من الوجبة / إعادة إلى الوجبة».
 * One tap records that a member is not part of this meal occurrence; the plan
 * surface then ADJUSTS the batch quantities for the remaining sharers (pure
 * display math — the dish is never changed or regenerated).
 *
 * Deliberately NOT gated to elapsed days: absence is a planning fact («تسافر
 * الخميس»), not adherence, so future days of the plan week are legitimate
 * targets. local_date is the MEAL's date, derived server-side.
 *
 * Marking absent also clears the member's own status row for that meal (a
 * person outside the meal has no serving to attest, and keeps no leaderboard
 * credit for it). Their dish VERDICTS are left alone — an opinion about the
 * dish is theirs regardless. Restoring deletes only the absence row; the meal
 * can then be re-marked to give them a status again.
 */
export async function setMealAbsence(rawInput: SetMealAbsenceInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: AUTH_ERROR_AR };

  const parsed = setMealAbsenceSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: VALIDATION_ERROR_AR };
  const input = parsed.data;

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

  // Ownership gate — same posture as setMealCheckin.
  if (input.member_id !== "mom") {
    const { data: member } = await supabase
      .from("family_members")
      .select("id")
      .eq("id", input.member_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  // meal_absences (00021) is not in the generated types yet — untyped client
  // cast (house pattern).
  const db = supabase as unknown as SupabaseClient;

  if (input.absent) {
    const { error: upsertError } = await db.from("meal_absences").upsert(
      {
        user_id: user.id,
        meal_plan_id: input.meal_plan_id,
        day_index: input.day_index,
        local_date: localDate,
        slot: input.slot,
        member_id: input.member_id,
      },
      { onConflict: "meal_plan_id,day_index,slot,member_id" },
    );
    if (upsertError) {
      Sentry.captureMessage(
        "meal_absences write failed — apply migration 00021",
        { level: "warning", tags: { area: "engagement", step: "absence-upsert" } },
      );
      return { ok: false as const, error: "تعذر حفظ التعديل، يرجى المحاولة مرة أخرى" };
    }
    // Outside the meal ⇒ no status for it. Best-effort (pre-00019 prod has no
    // member_id column — the shared status there is household-level anyway).
    const { error: clearError } = await db
      .from("meal_checkins")
      .delete()
      .eq("meal_plan_id", input.meal_plan_id)
      .eq("day_index", input.day_index)
      .eq("slot", input.slot)
      .eq("user_id", user.id)
      .eq("member_id", input.member_id);
    if (clearError) {
      Sentry.captureMessage(
        "meal_checkins member clear on absence failed (pre-00019 prod?)",
        { level: "warning", tags: { area: "engagement", step: "absence-clear-checkin" } },
      );
    }
  } else {
    const { error: deleteError } = await db
      .from("meal_absences")
      .delete()
      .eq("meal_plan_id", input.meal_plan_id)
      .eq("day_index", input.day_index)
      .eq("slot", input.slot)
      .eq("user_id", user.id)
      .eq("member_id", input.member_id);
    if (deleteError) {
      Sentry.captureMessage(
        "meal_absences delete failed — apply migration 00021",
        { level: "warning", tags: { area: "engagement", step: "absence-delete" } },
      );
      return { ok: false as const, error: "تعذر حفظ التعديل، يرجى المحاولة مرة أخرى" };
    }
  }

  revalidatePath("/plan");
  revalidatePath("/dashboard");
  return { ok: true as const, local_date: localDate };
}

/**
 * رحلتك الخاصة — the private weigh-in, per eligible adult.
 *
 * member_id is "mom" (the account owner) or a family_members.id; eligibility
 * is the ONE shared rule in engagement/eligibility.ts — children never, the
 * housekeeper never, under-18 by birth_year never. Cadence is weekly PER
 * MEMBER by design — ED-safety, not a technical limit: a second weigh-in in
 * the same week is refused gently, while re-submitting TODAY's value upserts
 * as a correction. The latest value also refreshes the member's weight_kg
 * scalar (profiles or family_members) so next week's generation uses the
 * freshest number.
 *
 * photo_path (optional) is an object the client already uploaded to the
 * PRIVATE body-photos bucket. Ownership is enforced twice: storage RLS at
 * upload time, and HERE by requiring the path to sit inside the caller's own
 * folder — a crafted request cannot attach someone else's object. Replacing
 * today's photo best-effort-deletes the previous object (no orphans).
 */
export async function logBodyWeight(rawInput: LogBodyWeightInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: AUTH_ERROR_AR };

  const parsed = logBodyWeightSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: VALIDATION_ERROR_AR };
  const input = parsed.data;

  // Ownership gate for the photo: inside the caller's own folder, nowhere else.
  if (input.photo_path && !input.photo_path.startsWith(`${user.id}/`)) {
    return { ok: false as const, error: VALIDATION_ERROR_AR };
  }

  // Body photos are ADULTS-ONLY. A minor's log never carries a photo — even a
  // crafted request has it stripped here (the client also hides the control).
  let memberIsChild = false;
  if (input.member_id === "mom") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("birth_year")
      .eq("id", user.id)
      .single();
    const birthYear = (profile as { birth_year?: number | null } | null)
      ?.birth_year;
    if (!isWeighInEligibleMom(birthYear ?? null)) {
      return { ok: false as const, error: VALIDATION_ERROR_AR };
    }
  } else {
    // RLS-scoped read doubles as the ownership check (someone else's member
    // id returns no row).
    const { data: member } = await supabase
      .from("family_members")
      .select("member_type, role, birth_year")
      .eq("id", input.member_id)
      .eq("user_id", user.id)
      .single();
    const memberFields = member as {
      member_type: string | null;
      role: string | null;
      birth_year: number | null;
    } | null;
    if (!memberFields || !isWeighInEligibleMember(memberFields)) {
      return { ok: false as const, error: VALIDATION_ERROR_AR };
    }
    memberIsChild = isChildWeighInMember(memberFields);
  }
  // The effective photo path: null for a child, so nothing below stores it.
  const photoPath = memberIsChild ? null : (input.photo_path ?? null);

  const today = riyadhTodayISO();
  const db = supabase;

  // select("*") on purpose: photo_path is a 00018 column — naming it here
  // would fail the whole read on a pre-apply prod, while * degrades to
  // rows-without-the-column (house tolerance pattern).
  const { data: recent } = await db
    .from("body_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("member_id", input.member_id)
    .gte("recorded_on", addDaysISO(today, -6))
    .limit(7);
  const recentRows = (recent ?? []) as Array<{
    recorded_on: string;
    photo_path?: string | null;
  }>;
  const hasOtherThisWeek = recentRows.some((r) => r.recorded_on !== today);
  if (hasOtherThisWeek) {
    return {
      ok: false as const,
      error:
        input.member_id === "mom"
          ? "سجّلتِ وزنك هذا الأسبوع — مرة واحدة في الأسبوع تكفي"
          : "سُجّل وزن هذا الفرد هذا الأسبوع — مرة واحدة في الأسبوع تكفي",
    };
  }

  // Correcting today's entry with a NEW photo: drop the old object so the
  // bucket never accumulates unreachable photos. Best-effort — a stale object
  // must not block the save.
  const todaysPrevPhoto = recentRows.find((r) => r.recorded_on === today)
    ?.photo_path;
  if (
    photoPath &&
    todaysPrevPhoto &&
    todaysPrevPhoto !== photoPath
  ) {
    await supabase.storage
      .from(BODY_PHOTOS_BUCKET)
      .remove([todaysPrevPhoto])
      .catch(() => undefined);
  }

  // photo_path joins the GENERATED types once 00018 is applied and db:types
  // re-runs — until then this write goes through an untyped client cast (house
  // pattern; see the export route). A weight-only save omits the key entirely,
  // so it still works on a pre-00018 prod.
  const { error: logError } = await (db as unknown as SupabaseClient)
    .from("body_logs")
    .upsert(
      {
        user_id: user.id,
        member_id: input.member_id,
        recorded_on: today,
        weight_kg: input.weight_kg,
        waist_cm: input.waist_cm ?? null,
        // Absent photo on a correction keeps today's existing photo (a photo
        // is an addition, never silently discarded by a number-only resubmit).
        ...(photoPath ? { photo_path: photoPath } : {}),
      },
      { onConflict: "user_id,member_id,recorded_on" },
    );
  if (logError) {
    Sentry.captureException(logError, {
      tags: { area: "engagement", step: "body-log-upsert", userId: user.id },
    });
    return { ok: false as const, error: "تعذر حفظ الوزن، يرجى المحاولة مرة أخرى" };
  }

  // Best-effort scalar mirror — generation reads the member's weight_kg.
  if (input.member_id === "mom") {
    await supabase
      .from("profiles")
      .update({ weight_kg: input.weight_kg })
      .eq("id", user.id);
  } else {
    await supabase
      .from("family_members")
      .update({ weight_kg: input.weight_kg })
      .eq("id", input.member_id)
      .eq("user_id", user.id);
  }

  // A weigh-in can trip a goal-milestone badge on the «موسم بيتنا» leaderboard
  // (goalReached is derived from body_logs in seasonProps), so refresh the
  // dashboard too — the board should reflect a reached goal without waiting for
  // an unrelated refresh.
  revalidatePath("/journey");
  revalidatePath("/dashboard");
  return { ok: true as const, recorded_on: today };
}
