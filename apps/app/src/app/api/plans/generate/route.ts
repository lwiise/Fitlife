import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { triggerPlanGeneration } from "@/lib/plans/dispatch";
import {
  buildPersonLimitMessage,
  TIER_DISPLAY_NAMES_AR,
} from "@/lib/subscription/strings";
import { getCurrentSubscription } from "@/lib/subscription/state";

export const runtime = "nodejs";
// The route only gates, inserts rows, and fires the background function — fast.
export const maxDuration = 30;

const GENERIC_502 = "حدث خطأ في إنشاء الخطة. حاولي مرة ثانية";

/**
 * POST /api/plans/generate — manual generation (the "إنشاء خطة جديدة" button).
 * Always enforces the full rate limit. Onboarding + family-change generation
 * runs through server actions that call triggerPlanGeneration with the bypass.
 */
export async function POST(req: Request) {
  // Safety net: any UNEXPECTED throw (transient DB latency, a serverless cold
  // start, etc.) must return a clean JSON error — not a bare 500 with no body,
  // which surfaced to the user as the generic "حدث خطأ. حاولي مرة ثانية" fallback
  // with nothing logged. Capture the real cause so a recurrence is diagnosable.
  try {
    return await handleGenerate(req);
  } catch (err) {
    console.error("[/api/plans/generate] unhandled error", err);
    Sentry.captureException(err, {
      tags: { area: "plan-generation", step: "generate-route" },
    });
    return NextResponse.json({ error: GENERIC_502 }, { status: 500 });
  }
}

async function handleGenerate(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  // Optional regeneration feedback (the "what's wrong / what to improve" popup)
  // + optional memberId to scope the regen to a single member.
  let feedback: string | undefined;
  const body = (await req.json().catch(() => ({}))) as {
    issues?: string;
    improvements?: string;
    memberId?: string;
    scope?: "individual" | "shared" | "both";
  };
  const issues = body.issues?.trim();
  const improvements = body.improvements?.trim();
  if (issues || improvements) {
    feedback = [
      "ملاحظات العميلة على الخطة الحالية:",
      issues ? `- ما لم يعجبها: ${issues}` : null,
      improvements ? `- التحسينات المطلوبة: ${improvements}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const memberId = body.memberId?.trim();
  // The regenerate-scope dialog (only meaningful for a member with shared meals).
  const scope =
    memberId &&
    (body.scope === "individual" || body.scope === "shared" || body.scope === "both")
      ? body.scope
      : undefined;

  const result = await triggerPlanGeneration({
    supabase,
    userId: user.id,
    feedback,
    // Scope to the viewed member: carry the rest over, regenerate only this one.
    // independentRegen is NOT forced here — dispatch derives it from the member's
    // CURRENT meal_mode (independent → fresh own dishes; shared → re-merge with the
    // shared group), so toggling Shared→Individual→Shared round-trips. No memberId →
    // full regen (fallback). With a scope, regenerate only that category of meals
    // (partial regen, co-sharers recomputed) — see triggerPlanGeneration.regenScope.
    ...(memberId
      ? {
          carryOver: true,
          regenerateMemberId: memberId,
          ...(scope ? { regenScope: scope } : {}),
        }
      : {}),
  });

  if (result.ok) {
    return NextResponse.json(
      { plan_id: result.mealPlanId, status: result.status },
      { status: 200 },
    );
  }

  switch (result.kind) {
    case "access": {
      const access = result.access;
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
          // Per-member regenerate quota (3/week per member) vs the account-wide
          // new-plan pool — show the matching message.
          const error = access.details?.member_regen
            ? `وصلتي للحد الأقصى لإعادة إنشاء خطة هذا الفرد هذا الأسبوع (٣ مرات). حاولي بعد ${days} أيام`
            : `وصلتي للحد الأقصى من الخطط هذا الأسبوع. حاولي مرة ثانية بعد ${days} أيام`;
          return NextResponse.json({ error }, { status: 429 });
        }
      }
      return NextResponse.json({ error: "حدث خطأ غير متوقع" }, { status: 500 });
    }
    case "onboarding":
      return NextResponse.json(
        { error: "أكملي بياناتك أولاً قبل إنشاء الخطة" },
        { status: 400 },
      );
    case "medical":
      return NextResponse.json(
        { error: "يجب استشارة الطبيب قبل إنشاء الخطة بسبب حالتك الصحية" },
        { status: 403 },
      );
    case "busy":
      return NextResponse.json(
        { error: "خطتك قيد التجهيز الآن", busy: true },
        { status: 409 },
      );
    case "dispatch":
      return NextResponse.json({ error: GENERIC_502 }, { status: 502 });
    case "server":
      return NextResponse.json({ error: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
