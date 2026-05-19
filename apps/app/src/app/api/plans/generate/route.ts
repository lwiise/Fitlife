import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateMealPlan,
  OnboardingIncompleteError,
  MedicalGateError,
  RateLimitError,
  AnthropicCallError,
  PlanValidationError,
} from "@/lib/plans";
import { canGenerateNewPlan } from "@/lib/subscription/access";
import {
  buildPersonLimitMessage,
  TIER_DISPLAY_NAMES_AR,
} from "@/lib/subscription/strings";
import { getCurrentSubscription } from "@/lib/subscription/state";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/plans/generate
 *
 * Auth-required. Subscription-gated (trial-aware, tier-limited, rate-limited).
 * Generates a full-week meal plan for the user's whole family.
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

  try {
    const { mealPlanId } = await generateMealPlan(user.id);
    return NextResponse.json(
      { plan_id: mealPlanId, status: "ready" },
      { status: 200 },
    );
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "Unknown";
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[plan-generate]", {
      userId: user.id,
      errorName,
      error: errorMessage,
    });

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
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: `وصلتي للحد الأقصى من الخطط هذا الأسبوع. حاولي مرة ثانية بعد ${err.daysUntilReset} أيام`,
        },
        { status: 429 },
      );
    }
    if (err instanceof AnthropicCallError) {
      return NextResponse.json(
        { error: "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية" },
        { status: 502 },
      );
    }
    if (err instanceof PlanValidationError) {
      console.error(
        "[plan-generate] raw response (truncated):",
        (err.rawResponse ?? "").slice(0, 2000),
      );
      return NextResponse.json(
        { error: "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "حدث خطأ غير متوقع" },
      { status: 500 },
    );
  }
}

