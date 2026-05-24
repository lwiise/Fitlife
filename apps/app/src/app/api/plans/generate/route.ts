import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlanContext,
  createPlanRows,
  runMealPlanGeneration,
  OnboardingIncompleteError,
  MedicalGateError,
  AnthropicCallError,
  PlanValidationError,
} from "@fitlife/plan-engine";
import { canGenerateNewPlan } from "@/lib/subscription/access";
import {
  buildPersonLimitMessage,
  TIER_DISPLAY_NAMES_AR,
} from "@/lib/subscription/strings";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { env, getAnthropicKey, getSupabaseServiceRoleKey } from "@/lib/env";

export const runtime = "nodejs";
// The route only gates, inserts rows, and fires the background function — fast.
export const maxDuration = 30;

const GENERIC_502 = "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية";

/**
 * POST /api/plans/generate
 *
 * Auth + subscription gating + onboarding/medical gates run synchronously so
 * the user gets immediate feedback. Then the heavy Anthropic generation runs
 * in a Netlify background function (production) or inline (development, where
 * there's no 26s serverless cap). The /plan page polls /api/plans/status.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  // Subscription + person-count + rate-limit gating
  const access = await canGenerateNewPlan(user.id);
  if (!access.allowed) {
    switch (access.reason) {
      case "trial_expired":
        return NextResponse.json(
          { error: "انتهت فترتك التجريبية. اشتركي للاستمرار" },
          { status: 402 },
        );
      case "subscription_inactive":
        return NextResponse.json(
          { error: "اشتراكك غير نشط. حدّثي طريقة الدفع" },
          { status: 402 },
        );
      case "past_due":
        return NextResponse.json(
          { error: "فيه مشكلة في الدفع. حدّثي بطاقتك للاستمرار" },
          { status: 402 },
        );
      case "person_count_exceeded": {
        const sub = await getCurrentSubscription(user.id);
        const tierName = sub
          ? TIER_DISPLAY_NAMES_AR[sub.tier]
          : TIER_DISPLAY_NAMES_AR.starter;
        const current = access.details?.current_people ?? 0;
        const max = access.details?.max_people ?? 0;
        return NextResponse.json(
          { error: buildPersonLimitMessage(current, max, tierName) },
          { status: 403 },
        );
      }
      case "rate_limit": {
        const days = access.details?.days_until_reset ?? 7;
        return NextResponse.json(
          {
            error: `وصلتي للحد الأقصى من الخطط هذا الأسبوع. حاولي مرة ثانية بعد ${days} أيام`,
          },
          { status: 429 },
        );
      }
    }
  }

  // Onboarding / medical gates — synchronous, immediate feedback
  let context;
  try {
    context = await buildPlanContext(supabase, user.id);
  } catch (err) {
    if (err instanceof OnboardingIncompleteError) {
      return NextResponse.json(
        { error: "أكملي بياناتك أولاً قبل إنشاء الخطة" },
        { status: 400 },
      );
    }
    if (err instanceof MedicalGateError) {
      return NextResponse.json(
        { error: "يجب استشارة الطبيب قبل إنشاء الخطة بسبب حالتك الصحية" },
        { status: 403 },
      );
    }
    console.error("[plan-generate] context build failed", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "build-context", userId: user.id },
    });
    return NextResponse.json({ error: "حدث خطأ غير متوقع" }, { status: 500 });
  }

  // Create the placeholder rows so the polling UI has something to watch.
  let mealPlanId: string;
  try {
    mealPlanId = await createPlanRows(supabase, user.id);
  } catch (err) {
    console.error("[plan-generate] createPlanRows failed", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "create-rows", userId: user.id },
    });
    return NextResponse.json({ error: GENERIC_502 }, { status: 502 });
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
      return NextResponse.json(
        { plan_id: mealPlanId, status: "ready" },
        { status: 200 },
      );
    } catch (err) {
      const errorName = err instanceof Error ? err.name : "Unknown";
      console.error("[plan-generate] inline generation failed", {
        userId: user.id,
        errorName,
      });
      Sentry.captureException(err, {
        tags: { area: "plan-generation", step: "inline-generate", userId: user.id },
      });
      if (err instanceof PlanValidationError) {
        console.error(
          "[plan-generate] raw response (truncated):",
          (err.rawResponse ?? "").slice(0, 2000),
        );
      }
      if (err instanceof AnthropicCallError || err instanceof PlanValidationError) {
        return NextResponse.json({ error: GENERIC_502 }, { status: 502 });
      }
      return NextResponse.json({ error: "حدث خطأ غير متوقع" }, { status: 500 });
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
        body: JSON.stringify({ userId: user.id, mealPlanId }),
      },
    );
    if (!res.ok && res.status !== 202) {
      throw new Error(`background fn returned ${res.status}`);
    }
  } catch (err) {
    console.error("[plan-generate] failed to start background generation", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "dispatch-bg", userId: user.id },
    });
    await supabase
      .from("meal_plans")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update({ status: "failed", error_message: "failed to start generation" })
      .eq("id", mealPlanId);
    return NextResponse.json({ error: GENERIC_502 }, { status: 502 });
  }

  return NextResponse.json(
    { plan_id: mealPlanId, status: "generating" },
    { status: 200 },
  );
}
