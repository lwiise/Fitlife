import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateMealPlan,
  OnboardingIncompleteError,
  MedicalGateError,
  AnthropicCallError,
  PlanValidationError,
} from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Dev-only stub methodology. Used to verify the whole pipeline works before
 * Sara's real methodology arrives in Prompt 1.8b. This route returns 404 in
 * production and is DELETED in 1.8b along with the methodologyOverride option.
 */
const STUB_METHODOLOGY = `استخدمي معادلة Mifflin-St Jeor لحساب BMR، ثم اضربي في معامل النشاط.
لنزول الوزن: عجز 500 سعرة يومياً.
توزيع الماكروز لنزول الوزن: 30٪ بروتين، 40٪ كارب، 30٪ دهون.
ركزي على الأطباق الخليجية التقليدية المعدلة بمقادير صحية: كبسة دجاج بأرز بسمتي، مجبوس سمك، شوربة عدس، سلطة فتوش، بيض مسلوق مع خبز شراك.
3 وجبات رئيسية + سناك واحد. وزعي السعرات: فطور 25٪، غداء 40٪، عشاء 25٪، سناك 10٪.`;

/**
 * POST /api/plans/test-generate
 *
 * Development-only. Skips the rate-limit check and injects the stub methodology
 * so the pipeline can be exercised end-to-end without Sara's real prompt.
 *
 * In production (NODE_ENV=production) this route returns 404 — it's not
 * reachable to anyone hitting the live URL.
 */
export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  try {
    const { mealPlanId } = await generateMealPlan(user.id, {
      methodologyOverride: STUB_METHODOLOGY,
    });
    return NextResponse.json(
      { plan_id: mealPlanId, status: "ready" },
      { status: 200 },
    );
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "Unknown";
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[plan-test-generate]", {
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
    if (err instanceof AnthropicCallError) {
      return NextResponse.json(
        { error: "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية" },
        { status: 502 },
      );
    }
    if (err instanceof PlanValidationError) {
      console.error(
        "[plan-test-generate] raw response (truncated):",
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
