import { Suspense } from "react";
import Link from "next/link";
import { Sparkles, Users, Calendar, Lock, AlertTriangle, ChevronLeft, ChefHat } from "lucide-react";
import { AddFamilyBanner } from "./AddFamilyBanner";
import { GenerateFamilyPlanBanner } from "./GenerateFamilyPlanBanner";
import { DeferredMemberDrain } from "../plan/DeferredMemberDrain";
import { TodaysMeals } from "./TodaysMeals";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
  getCurrentUserLatestPlan,
} from "@/lib/supabase/queries";
import { planHasContent } from "@fitlife/plan-engine";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { TIER_DISPLAY_NAMES_AR } from "@/lib/subscription/strings";
import { TrialBanner } from "@/components/subscription/TrialBanner";
import { Logo } from "@/components/Logo";
import { SettingsLink } from "@/components/SettingsLink";
import { LogoutButton } from "./LogoutButton";
import { CreateFirstPlanButton } from "./CreateFirstPlanButton";
import { CheckoutSuccessHandler } from "./CheckoutSuccessHandler";
import { BillingPortalButton } from "./BillingPortalButton";

export const metadata = {
  title: "لوحة التحكم",
};

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();
  const familyMembers = await getCurrentUserFamilyMembers();
  const latestPlan = await getCurrentUserLatestPlan();

  // A 'ready' plan with empty day shells isn't usable yet — treat it as still
  // generating so the card shows the loader instead of "نشطة".
  const planHasMeals = latestPlan?.plan_data
    ? planHasContent(latestPlan.plan_data)
    : false;
  const planIsReady = latestPlan?.status === "ready" && planHasMeals;
  const planIsGenerating =
    latestPlan?.status === "generating" ||
    (latestPlan?.status === "ready" && !planHasMeals);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const subscription = user ? await getCurrentSubscription(user.id) : null;
  const subStatus = subscription?.status ?? null;
  const isPaywalled = subStatus === "cancelled" || subStatus === "expired";

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-brand-surface px-4">
        <div className="text-center">
          <p className="text-brand-ink-muted">يتم تحضير حسابك...</p>
        </div>
      </main>
    );
  }

  const displayName = profile.display_name || "أهلاً";
  const onboardingDone = profile.onboarding_completed_at !== null;
  const beneficiaryCount = familyMembers.filter(
    (m) => m.role !== "housekeeper",
  ).length;
  // Mom's plan exists but no other family members yet → nudge to add family.
  // Gate on real readiness (content present, not still generating) so the
  // "خطتك جاهزة" banner never shows over the generating loader.
  const showAddFamily =
    profile.mom_profile_completed_at !== null &&
    planIsReady &&
    !latestPlan?.in_progress &&
    beneficiaryCount === 0;

  // Members who exist but aren't in the current plan yet (e.g. added while a
  // tier upgrade was pending) → offer one-click generation, named for them.
  const planMemberIds = latestPlan?.member_ids ?? [];
  const pendingMembers = familyMembers.filter(
    (m) => m.role !== "housekeeper" && !planMemberIds.includes(m.id),
  );
  // Gate on real content, not bare status: the plan flips to 'ready' on the
  // first emit (an empty shell), so `planIsReady` (status + planHasContent)
  // keeps the banner/drain from firing while the family is still generating.
  const needsFamilyPlan = planIsReady && pendingMembers.length > 0;
  const pendingNames = pendingMembers.map((m) => m.name);

  // Housekeeper recipe view: show only when a non-Arabic housekeeper exists AND
  // there's a ready plan (the /plan/housekeeper page redirects otherwise).
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");
  const showHousekeeperLink =
    latestPlan?.status === "ready" &&
    !!housekeeper &&
    housekeeper.preferred_language !== "ar";

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <Logo className="h-9 w-auto" />
          <div className="flex items-center gap-2">
            <SettingsLink />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12">
        <Suspense fallback={null}>
          <CheckoutSuccessHandler />
        </Suspense>

        {subscription?.status === "past_due" && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start sm:items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 mb-6"
          >
            <AlertTriangle
              className="size-5 flex-shrink-0 mt-0.5 sm:mt-0 text-red-600"
              aria-hidden="true"
            />
            <p className="flex-1 text-brand-ink text-sm font-medium leading-relaxed">
              فيه مشكلة في تجديد اشتراكك. حدّثي بياناتك الآن لتجنب توقف الخدمة
            </p>
            <div className="flex-shrink-0">
              <BillingPortalButton label="تحديث الدفع" variant="ghost" />
            </div>
          </div>
        )}

        {subscription?.status === "trialing" && (
          <TrialBanner subscription={subscription} />
        )}

        {showAddFamily && <AddFamilyBanner />}

        {onboardingDone && needsFamilyPlan && (
          <DeferredMemberDrain generating={latestPlan?.in_progress ?? false} />
        )}
        {needsFamilyPlan && <GenerateFamilyPlanBanner names={pendingNames} />}

        <h2 className="font-extrabold text-xl md:text-2xl text-brand-ink mb-6 leading-tight">
          أهلاً، {displayName}
        </h2>

        <p className="text-brand-ink-muted text-xs font-bold mb-3">نظرة سريعة</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/family"
            className="block bg-white rounded-2xl p-4 border border-brand-ink/5 hover:border-brand-purple-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full bg-brand-lavender/30 flex items-center justify-center">
                <Users className="size-5 text-brand-purple-900" />
              </div>
              <p className="text-brand-ink-muted text-sm font-medium">أفراد العائلة</p>
            </div>
            <p className="font-extrabold text-xl text-brand-ink mt-1 tabular-nums">
              {familyMembers.length}
            </p>
            <p className="inline-flex items-center gap-1 text-brand-purple-900 text-xs font-bold mt-1">
              إدارة العائلة
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </p>
          </Link>

          {isPaywalled ? (
            <div className="bg-brand-purple-900 text-white rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-full bg-white/15 flex items-center justify-center">
                  <Lock className="size-5 text-brand-yellow" aria-hidden="true" />
                </div>
                <p className="text-white/80 text-sm font-medium">الاشتراك</p>
              </div>
              <p className="font-extrabold text-2xl mt-1 leading-tight">
                اشتراكك انتهى
              </p>
              <p className="text-white/80 text-xs mt-1">
                للوصول لخطتك الغذائية
              </p>
              <a
                href="/pricing"
                className="inline-flex items-center gap-2 bg-white text-brand-purple-900 hover:bg-brand-yellow font-bold text-sm px-4 py-2 rounded-full mt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple-900 min-h-[2.75rem]"
              >
                اشتركي للاستمرار
              </a>
            </div>
          ) : (
          <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full bg-brand-pink-light flex items-center justify-center">
                <Calendar className="size-5 text-brand-pink" aria-hidden="true" />
              </div>
              <p className="text-brand-ink-muted text-sm font-medium">الخطة الحالية</p>
            </div>
            {planIsReady && (
              <>
                <p className="font-extrabold text-xl text-brand-ink mt-1">نشطة</p>
                <p className="text-brand-ink-muted text-xs mt-1">
                  {latestPlan.week_start_date
                    ? `تبدأ ${new Date(latestPlan.week_start_date).toLocaleDateString("ar-SA")}`
                    : "خطة حالية جاهزة"}
                </p>
                <a
                  href="/plan"
                  className="inline-flex items-center mt-3 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md"
                >
                  اعرضي الخطة
                </a>
              </>
            )}
            {planIsGenerating && (
              <>
                <p className="font-extrabold text-2xl text-brand-ink mt-1 leading-tight">
                  جاري إنشاء خطتك
                </p>
                <p className="text-brand-ink-muted text-xs mt-1">قد تاخذ دقيقة</p>
                <a
                  href="/plan"
                  className="inline-flex items-center mt-3 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md"
                >
                  متابعة الحالة
                </a>
              </>
            )}
            {latestPlan?.status === "failed" && (
              <>
                <p className="font-extrabold text-2xl text-brand-ink mt-1 leading-tight">
                  آخر محاولة فشلت
                </p>
                <a
                  href="/plan"
                  className="inline-flex items-center mt-3 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md"
                >
                  إعادة المحاولة
                </a>
              </>
            )}
            {!latestPlan && (
              <>
                <p className="font-extrabold text-xl text-brand-ink mt-1">—</p>
                <p className="text-brand-ink-muted text-xs mt-1">ما عندك خطة بعد</p>
                {onboardingDone && <CreateFirstPlanButton />}
              </>
            )}
          </div>
          )}

          <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full bg-brand-yellow/20 flex items-center justify-center">
                <Sparkles className="size-5 text-brand-yellow" aria-hidden="true" />
              </div>
              <p className="text-brand-ink-muted text-sm font-medium">الاشتراك</p>
            </div>
            <p className="font-extrabold text-2xl text-brand-ink mt-1 leading-tight">
              {subscription ? TIER_DISPLAY_NAMES_AR[subscription.tier] : "—"}
            </p>
            <p className="text-brand-ink-muted text-xs mt-1">
              {subStatus === "trialing" ? "فترة تجريبية" : subStatus === "active" ? "نشط" : subStatus === "past_due" ? "تأخر السداد" : subStatus === "cancelled" ? "مُلغى" : subStatus === "expired" ? "منتهي" : "—"}
            </p>
            {subStatus === "active" && subscription?.current_period_end && (
              <p className="text-brand-ink-muted text-xs mt-1">
                التجديد القادم: {new Date(subscription.current_period_end).toLocaleDateString("ar-SA")}
              </p>
            )}
            {subscription && (
              <div className="mt-3">
                <Link
                  href="/subscription"
                  className="inline-flex items-center gap-2 bg-brand-ink text-white hover:bg-brand-purple-900 font-bold text-sm px-4 py-2 rounded-full transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  إدارة الاشتراك
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Housekeeper recipes — directly above today's meals. */}
        {showHousekeeperLink && (
          <Link
            href="/plan/housekeeper"
            className="inline-flex items-center justify-center gap-2 min-h-11 px-5 mt-10 mb-4 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            <ChefHat className="size-4" aria-hidden="true" />
            وصفات الطبخ بلغة الخدامة
          </Link>
        )}

        {/* What am I cooking today? */}
        <div className={`mb-10 ${showHousekeeperLink ? "" : "mt-10"}`}>
          {user && <TodaysMeals userId={user.id} isOnboarded={onboardingDone} />}
        </div>

        {!onboardingDone && (
          <div className="bg-brand-purple-900 text-white rounded-3xl p-6 md:p-8 mb-8">
            <div className="flex items-start gap-3 mb-3">
              <Sparkles className="size-6 text-brand-yellow flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg md:text-xl leading-tight">
                  خطتك على بعد دقيقتين
                </h3>
                <p className="text-white/80 text-sm mt-2 leading-relaxed">
                  جاوبي على أسئلة سريعة عنك وعن عائلتك عشان نصمم لكِ خطة غذائية شخصية.
                </p>
              </div>
            </div>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-white text-brand-purple-900 hover:bg-brand-yellow font-bold text-sm px-5 py-2.5 rounded-full mt-2 transition-colors"
            >
              ابدئي الآن
            </a>
          </div>
        )}

        <details className="mt-12 text-xs text-brand-ink-muted/40">
          <summary className="cursor-pointer hover:text-brand-ink-muted transition-colors">
            معلومات تشخيصية (للمطور فقط)
          </summary>
          <pre className="mt-2 p-3 bg-white/50 rounded-lg overflow-auto">
            {JSON.stringify({ profile, familyMembers, latestPlan }, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
