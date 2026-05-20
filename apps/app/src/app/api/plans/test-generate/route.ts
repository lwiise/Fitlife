import { NextResponse } from "next/server";
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
import { getAnthropicKey } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Dev-only stub methodology. Verifies the pipeline before Sara's real
 * methodology arrives (Prompt 1.8b). Returns 404 in production. Runs inline
 * (no background function) since `next dev` has no serverless timeout.
 */
const STUB_METHODOLOGY = `استخدمي معادلة Mifflin-St Jeor لحساب BMR، ثم اضربي في معامل النشاط.
لنزول الوزن: عجز 500 سعرة يومياً.
توزيع الماكروز لنزول الوزن: 30٪ بروتين، 40٪ كارب، 30٪ دهون.
ركزي على الأطباق الخليجية التقليدية المعدلة بمقادير صحية: كبسة دجاج بأرز بسمتي، مجبوس سمك، شوربة عدس، سلطة فتوش، بيض مسلوق مع خبز شراك.
3 وجبات رئيسية + سناك واحد. وزعي السعرات: فطور 25٪، غداء 40٪، عشاء 25٪، سناك 10٪.`;

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
    const context = await buildPlanContext(supabase, user.id);
    const mealPlanId = await createPlanRows(supabase, user.id);
    await runMealPlanGeneration({
      supabase,
      anthropicApiKey: getAnthropicKey(),
      mealPlanId,
      context,
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
    if (err instanceof PlanValidationError) {
      console.error(
        "[plan-test-generate] raw response (truncated):",
        (err.rawResponse ?? "").slice(0, 2000),
      );
    }
    if (err instanceof AnthropicCallError || err instanceof PlanValidationError) {
      return NextResponse.json(
        { error: "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية" },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
