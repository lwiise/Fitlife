import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canGeneratePlan } from "@/lib/supabase/queries";
import {
  generateMealPlan,
  OnboardingIncompleteError,
  MedicalGateError,
  RateLimitError,
  AnthropicCallError,
  PlanValidationError,
} from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * POST /api/plans/generate
 *
 * Auth-required. Rate-limited to 3 successful generations per user per 7-day
 * rolling window. Generates a full-week meal plan for the user's whole family.
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

  // Rate limit
  const canGenerate = await canGeneratePlan(user.id);
  if (!canGenerate) {
    // Approximate days until reset: the oldest of the user's 3 most-recent
    // completed generations rolls off 7 days after it was created. Without
    // querying again we'll fall back to a conservative 7-day message.
    const daysUntilReset = 7;
    return NextResponse.json(
      {
        error: `وصلتي للحد الأقصى من الخطط هذا الأسبوع. حاولي مرة ثانية بعد ${daysUntilReset} أيام`,
      },
      { status: 429 },
    );
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

// Suppress unused-var TS in some build configs — MS_PER_DAY may be unused
// today but kept for the per-user days-until-reset refinement later.
void MS_PER_DAY;
