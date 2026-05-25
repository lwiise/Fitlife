import "server-only";

import * as Sentry from "@sentry/nextjs";
import {
  buildPlanContext,
  createPlanRows,
  runMealPlanGeneration,
  OnboardingIncompleteError,
  MedicalGateError,
  PlanValidationError,
} from "@fitlife/plan-engine";
import type { createClient } from "@/lib/supabase/server";
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
  | { ok: false; kind: "dispatch" };

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
}): Promise<DispatchResult> {
  const { supabase, userId, bypassRateLimit = false } = params;

  const access = bypassRateLimit
    ? await canGenerateForFamilyChange(userId)
    : await canGenerateNewPlan(userId);
  if (!access.allowed) return { ok: false, kind: "access", access };

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
        body: JSON.stringify({ userId, mealPlanId }),
      },
    );
    if (!res.ok && res.status !== 202) {
      throw new Error(`background fn returned ${res.status}`);
    }
  } catch (err) {
    console.error("[triggerPlanGeneration] failed to start background generation", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "dispatch-bg", userId },
    });
    await supabase
      .from("meal_plans")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update({ status: "failed", error_message: "failed to start generation" })
      .eq("id", mealPlanId);
    return { ok: false, kind: "dispatch" };
  }

  return { ok: true, mealPlanId, status: "generating" };
}
