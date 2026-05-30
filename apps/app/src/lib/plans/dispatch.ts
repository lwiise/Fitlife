import "server-only";

import * as Sentry from "@sentry/nextjs";
import {
  buildPlanContext,
  createPlanRows,
  runMealPlanGeneration,
  runMealPlanTranslation,
  OnboardingIncompleteError,
  MedicalGateError,
  PlanValidationError,
  type MealPlan,
  type LocaleCode,
} from "@fitlife/plan-engine";
import type { createClient } from "@/lib/supabase/server";
import { getLatestPlan, STALE_GENERATION_MIN } from "@/lib/plans/getLatestPlan";
import {
  canGenerateNewPlan,
  canGenerateForFamilyChange,
  type AccessResult,
} from "@/lib/subscription/access";
import { env, getAnthropicKey, getSupabaseServiceRoleKey } from "@/lib/env";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type DispatchResult =
  | { ok: true; mealPlanId: string; status: "ready" | "generating" }
  | { ok: false; kind: "access"; access: Extract<AccessResult, { allowed: false }> }
  | { ok: false; kind: "onboarding" }
  | { ok: false; kind: "medical" }
  | { ok: false; kind: "server" }
  | { ok: false; kind: "dispatch" }
  // A generation is already running — don't start a second one (it would restart
  // everyone from scratch since the in-progress plan isn't "ready" to carry over).
  | { ok: false; kind: "busy" };

/**
 * Shared plan-generation dispatch used by both the public route (full rate
 * limit) and trusted server actions (`bypassRateLimit` for onboarding + family
 * changes). Runs the access gate, builds context (onboarding/medical gates),
 * inserts the placeholder rows, then runs generation inline (dev) or fires the
 * Netlify background function (prod). Returns a discriminated result the caller
 * maps to its own HTTP/redirect behavior — never throws on expected gates.
 */
export async function triggerPlanGeneration(params: {
  supabase: ServerClient;
  userId: string;
  bypassRateLimit?: boolean;
  // Family changes carry completed members over from the prior plan and
  // generate only the new/changed member. Manual "new plan" leaves these off.
  carryOver?: boolean;
  regenerateMemberId?: string;
  // Per-member "new plan": the regenerated member gets fresh independent dishes
  // (not aligned to the family's shared dish grid).
  independentRegen?: boolean;
  // Manual regeneration: the user's "what's wrong / what to improve" feedback,
  // layered into the generation prompt (methodology/cookbook still take precedence).
  feedback?: string;
}): Promise<DispatchResult> {
  const {
    supabase,
    userId,
    bypassRateLimit = false,
    carryOver = false,
    regenerateMemberId,
    independentRegen,
    feedback,
  } = params;

  const access = bypassRateLimit
    ? await canGenerateForFamilyChange(userId)
    : await canGenerateNewPlan(userId);
  if (!access.allowed) return { ok: false, kind: "access", access };

  // Don't start a new generation while one is still running. A second run can't
  // carry the in-progress plan over (its members aren't complete yet), so it
  // would restart every member from scratch — and two background functions would
  // race. We CAN'T key this off meal_plans.status: the shell flips to 'ready' on
  // the first emit and stays 'ready' for the whole run. The durable signal is the
  // plan_generations 'started' row, created at dispatch (createPlanRows) and
  // cleared only at terminal completion — the shell flip can't fake it.
  const { data: liveGens } = await supabase
    .from("plan_generations")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("status", "started")
    .order("started_at", { ascending: false })
    .limit(1)
    .returns<{ id: string; started_at: string }[]>();
  const live = liveGens?.[0];
  if (live) {
    const startedMs = Date.parse(live.started_at);
    const ageMin = Number.isNaN(startedMs)
      ? Infinity
      : (Date.now() - startedMs) / 60_000;
    if (ageMin < STALE_GENERATION_MIN) return { ok: false, kind: "busy" };
    // Stale 'started' (the bg worker was hard-killed at its budget and its catch
    // never ran) → reclassify so the guard can't deadlock 'busy' forever.
    await supabase
      .from("plan_generations")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update({
        status: "failed",
        error_message: "stale generation reclassified",
        completed_at: new Date().toISOString(),
      })
      .eq("id", live.id);
  }

  let context;
  try {
    context = await buildPlanContext(supabase, userId);
  } catch (err) {
    if (err instanceof OnboardingIncompleteError) return { ok: false, kind: "onboarding" };
    if (err instanceof MedicalGateError) return { ok: false, kind: "medical" };
    console.error("[triggerPlanGeneration] context build failed", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "build-context", userId },
    });
    return { ok: false, kind: "server" };
  }

  // Layer the user's regeneration feedback into the prompt context.
  if (feedback) context.user_feedback = feedback;

  // Carry over the prior plan's completed members (minus the edited member, so
  // it regenerates). Fetched BEFORE createPlanRows so it's the previous plan.
  let existingPlan: MealPlan | null = null;
  if (carryOver) {
    const prior = await getLatestPlan(userId);
    if (prior?.status === "ready" && prior.plan_data) {
      existingPlan = regenerateMemberId
        ? {
            ...prior.plan_data,
            members: prior.plan_data.members.filter(
              (m) => m.member_id !== regenerateMemberId,
            ),
          }
        : prior.plan_data;
    }
  }

  let mealPlanId: string;
  try {
    mealPlanId = await createPlanRows(supabase, userId);
  } catch (err) {
    console.error("[triggerPlanGeneration] createPlanRows failed", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "create-rows", userId },
    });
    return { ok: false, kind: "dispatch" };
  }

  // Development: no serverless timeout — run generation inline.
  if (process.env.NODE_ENV === "development") {
    try {
      await runMealPlanGeneration({
        supabase,
        anthropicApiKey: getAnthropicKey(),
        mealPlanId,
        context,
        existingPlan,
        independentRegen,
      });
      return { ok: true, mealPlanId, status: "ready" };
    } catch (err) {
      console.error("[triggerPlanGeneration] inline generation failed", {
        userId,
        errorName: err instanceof Error ? err.name : "Unknown",
      });
      Sentry.captureException(err, {
        tags: { area: "plan-generation", step: "inline-generate", userId },
      });
      if (err instanceof PlanValidationError) {
        console.error(
          "[triggerPlanGeneration] raw response (truncated):",
          (err.rawResponse ?? "").slice(0, 2000),
        );
      }
      return { ok: false, kind: "dispatch" };
    }
  }

  // Production: fire the background function (15-min budget) and return.
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_APP_URL}/.netlify/functions/generate-plan-background`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": getSupabaseServiceRoleKey(),
        },
        body: JSON.stringify({ userId, mealPlanId, existingPlan, feedback, independentRegen }),
      },
    );
    if (!res.ok && res.status !== 202) {
      // Include the status + a body snippet so a misconfig (e.g. missing
      // ANTHROPIC_API_KEY → 500 "Server misconfigured") is diagnosable.
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(
        `background fn returned ${res.status}${snippet ? `: ${snippet}` : ""}`,
      );
    }
  } catch (err) {
    console.error("[triggerPlanGeneration] failed to start background generation", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "dispatch-bg", userId },
    });
    const errorMessage =
      err instanceof Error ? err.message : "failed to start generation";
    await supabase
      .from("meal_plans")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", mealPlanId);
    return { ok: false, kind: "dispatch" };
  }

  return { ok: true, mealPlanId, status: "generating" };
}

/**
 * Translate the user's current plan IN PLACE into `locale` (no regeneration, no
 * new row, status stays "ready"). Fire-and-forget: used when a housekeeper is
 * added or her language changes. No-op if there's no ready plan.
 */
export async function triggerPlanTranslation(params: {
  supabase: ServerClient;
  userId: string;
  locale: LocaleCode;
}): Promise<void> {
  const { supabase, userId, locale } = params;
  if (locale === "ar") return; // Arabic is the source — nothing to translate.

  const latest = await getLatestPlan(userId);
  if (!latest || latest.status !== "ready" || !latest.plan_data) return;
  const mealPlanId = latest.id;
  const plan = latest.plan_data;

  // Development: run inline.
  if (process.env.NODE_ENV === "development") {
    try {
      await runMealPlanTranslation({
        supabase,
        anthropicApiKey: getAnthropicKey(),
        userId,
        mealPlanId,
        plan,
        locale,
      });
    } catch (err) {
      console.error("[triggerPlanTranslation] inline translation failed", err);
      Sentry.captureException(err, {
        tags: { area: "plan-translation", step: "inline", userId },
      });
    }
    return;
  }

  // Production: fire the background function (translate mode) and return.
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_APP_URL}/.netlify/functions/generate-plan-background`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": getSupabaseServiceRoleKey(),
        },
        body: JSON.stringify({ mode: "translate", userId, mealPlanId, plan, locale }),
      },
    );
    if (!res.ok && res.status !== 202) {
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`translate bg fn returned ${res.status}${snippet ? `: ${snippet}` : ""}`);
    }
  } catch (err) {
    // Non-fatal: the maid view falls back to Arabic until a successful translate.
    console.error("[triggerPlanTranslation] failed to start translation", err);
    Sentry.captureException(err, {
      tags: { area: "plan-translation", step: "dispatch-bg", userId },
    });
  }
}
