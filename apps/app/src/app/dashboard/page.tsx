import { Suspense } from "react";
import Link from "next/link";
import { Sparkles, Users, AlertTriangle, MailOpen } from "lucide-react";
import { AddFamilyBanner } from "./AddFamilyBanner";
import { DeepDiveBanner } from "./DeepDiveBanner";
import { WorkoutOptInBanner } from "./WorkoutOptInBanner";
import { DeferredMemberDrain } from "../plan/DeferredMemberDrain";
import { FamilySeasonCard } from "../plan/FamilySeasonCard";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
  getCurrentUserLatestPlan,
} from "@/lib/supabase/queries";
import { getLatestWorkoutPlan } from "@/lib/plans/getLatestWorkoutPlan";
import { planHasContent } from "@fitlife/plan-engine";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { canGenerateForFamilyChange } from "@/lib/subscription/access";
import { TrialBanner } from "@/components/subscription/TrialBanner";
import { RenewalRecapCard } from "./RenewalRecapCard";
import {
  isWithinRenewalWindow,
  loadFamilyLedger,
} from "@/lib/engagement/ledger";
import { getFamilySeasonProps } from "@/lib/engagement/seasonProps";
import { Logo } from "@/components/Logo";
import { SettingsLink } from "@/components/SettingsLink";
import { LogoutButton } from "./LogoutButton";
import { CheckoutSuccessHandler } from "./CheckoutSuccessHandler";
import { BillingPortalButton } from "./BillingPortalButton";
import { genderPick } from "@/lib/copy/gender";

export const metadata = {
  title: "لوحة التحكم",
};

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();
  const familyMembers = await getCurrentUserFamilyMembers();
  const latestPlan = await getCurrentUserLatestPlan();

  // A 'ready' plan with empty day shells isn't usable yet — treat it as still
  // generating so downstream gates don't fire early.
  const planHasMeals = latestPlan?.plan_data
    ? planHasContent(latestPlan.plan_data)
    : false;
  const planIsReady = latestPlan?.status === "ready" && planHasMeals;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [subscription, workoutPlan] = user
    ? await Promise.all([
        getCurrentSubscription(user.id),
        getLatestWorkoutPlan(user.id),
      ])
    : [null, null];

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-brand-surface px-4">
        <div className="text-center">
          <p className="text-brand-ink-muted">يتم تحضير حسابك...</p>
        </div>
      </main>
    );
  }

  const g = genderPick(profile.sex);
  const onboardingDone = profile.onboarding_completed_at !== null;
  const beneficiaryCount = familyMembers.filter(
    (m) => m.role !== "housekeeper",
  ).length;
  // Mom's plan exists but no other family members yet → nudge to add family.
  const showAddFamily =
    profile.mom_profile_completed_at !== null &&
    planIsReady &&
    !latestPlan?.in_progress &&
    beneficiaryCount === 0;

  // Meals-only user with a ready plan → nudge the workout opt-in. One banner at
  // a time: family > workout > deep-dive.
  const showWorkoutOptIn =
    !showAddFamily &&
    planIsReady &&
    !latestPlan?.in_progress &&
    profile.workout_profile === null &&
    workoutPlan === null;

  // First plan ready + the optional deep-dive questionnaire not done → nudge.
  const showDeepDive =
    !showAddFamily &&
    !showWorkoutOptIn &&
    planIsReady &&
    !latestPlan?.in_progress &&
    profile.deep_dive_completed_at === null;

  // Members who exist but aren't in the current plan yet → auto-generate.
  const planMemberIds = latestPlan?.member_ids ?? [];
  const pendingMembers = familyMembers.filter(
    (m) => m.role !== "housekeeper" && !planMemberIds.includes(m.id),
  );
  const needsFamilyPlan = planIsReady && pendingMembers.length > 0;
  const pendingNames = pendingMembers.map((m) => m.name);
  const familyChangeAccess =
    needsFamilyPlan && user ? await canGenerateForFamilyChange(user.id) : null;
  const pendingBlocked = familyChangeAccess?.allowed === false;
  const pendingNamesText = pendingNames.join("، ");

  // Housekeeper recipe view existence — only used to add a step to the trial
  // checklist (the dashboard shortcut link itself lives on /plan now).
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");
  const showHousekeeperLink =
    latestPlan?.status === "ready" &&
    !!housekeeper &&
    housekeeper.preferred_language !== "ar";

  // «موسم بيتنا» leaderboard — the dashboard's centerpiece (first thing to see).
  // Null for solo households or before a plan is ready.
  const seasonProps = await getFamilySeasonProps(
    profile,
    familyMembers,
    latestPlan,
    workoutPlan,
  );

  // Renewal-week recap — active paid subs within 7 days of period end.
  let renewalRecap = null;
  if (
    user &&
    subscription?.status === "active" &&
    subscription.lemonsqueezy_subscription_id &&
    !subscription.cancel_at_period_end &&
    subscription.current_period_end &&
    isWithinRenewalWindow(subscription.current_period_end)
  ) {
    renewalRecap = {
      ledger: await loadFamilyLedger(supabase, user.id),
      cadence: subscription.cadence,
    };
  }

  // Day-3 trial activation checklist — DB-derived, only while trialing.
  let trialChecklist;
  if (user && subscription?.status === "trialing") {
    const [chatCount, weightCount] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .limit(1),
      supabase
        .from("body_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .limit(1),
    ]);
    trialChecklist = {
      planReady: planIsReady,
      advisorTried: (chatCount.count ?? 0) > 0,
      weightLogged: !weightCount.error && (weightCount.count ?? 0) > 0,
      showHousekeeperStep: showHousekeeperLink,
    };
  }

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
          <TrialBanner
            subscription={subscription}
            checklist={trialChecklist}
            ownerSex={profile.sex}
          />
        )}

        {showAddFamily && <AddFamilyBanner ownerSex={profile.sex} />}

        {showWorkoutOptIn && <WorkoutOptInBanner ownerSex={profile.sex} />}

        {showDeepDive && <DeepDiveBanner ownerSex={profile.sex} />}

        {onboardingDone && needsFamilyPlan && !pendingBlocked && (
          <DeferredMemberDrain generating={latestPlan?.in_progress ?? false} />
        )}

        {needsFamilyPlan && pendingBlocked && (
          <div className="rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-4 mb-6">
            <div className="flex items-start gap-3">
              <Users
                className="size-5 flex-shrink-0 mt-0.5 text-brand-purple-900"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-brand-ink text-sm font-medium leading-relaxed">
                  خطط باقي أفراد العائلة ({pendingNamesText}) متاحة مع الاشتراك.
                  اشتركي ونجهّز خططهم دفعة واحدة مع وجبات العائلة المنسقة.
                </p>
                <Link
                  href="/pricing"
                  className="mt-3 inline-flex items-center gap-2 bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-11"
                >
                  عرض الباقات
                </Link>
              </div>
            </div>
          </div>
        )}

        {needsFamilyPlan && !pendingBlocked && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-3 mb-6 text-brand-ink text-sm font-medium leading-relaxed"
          >
            {latestPlan?.in_progress
              ? `تمت إضافة ${pendingNamesText} — سيُنشأ بعد اكتمال الخطة الحالية`
              : `تمت إضافة ${pendingNamesText} — ${
                  pendingNames.length > 1 ? "جارٍ إنشاء خططهم" : "جارٍ إنشاء خطته"
                } ضمن خطط العائلة المنسقة`}
          </div>
        )}

        {/* «موسم بيتنا» leaderboard — the dashboard's centerpiece. Hidden for
            solo households / before a plan is ready (seasonProps is null then). */}
        {seasonProps && <FamilySeasonCard {...seasonProps} />}

        {/* Renewal-week recap — celebratory bookkeeping, never a countdown */}
        {renewalRecap && (
          <div className="mt-6">
            <RenewalRecapCard {...renewalRecap} />
          </div>
        )}

        {/* Two quick actions — the advisor and the weekly letter. */}
        {onboardingDone && (
          <div className="flex flex-wrap gap-2 mt-8">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {g("اسألي المستشارة", "اسأل المستشارة")}
            </Link>
            <Link
              href="/recap"
              className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              <MailOpen className="size-4" aria-hidden="true" />
              رسالتك الأسبوعية
            </Link>
          </div>
        )}

        {!onboardingDone && (
          <div className="bg-brand-purple-900 text-white rounded-3xl p-6 md:p-8 mb-8">
            <div className="flex items-start gap-3 mb-3">
              <Sparkles className="size-6 text-brand-yellow flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg md:text-xl leading-tight">
                  خطتك على بعد دقيقتين
                </h3>
                <p className="text-white/80 text-sm mt-2 leading-relaxed">
                  {g(
                    "جاوبي على أسئلة سريعة عنك وعن عائلتك عشان نصمم لكِ خطة غذائية شخصية.",
                    "جاوب على أسئلة سريعة عنك وعن عائلتك عشان نصمم لك خطة غذائية شخصية.",
                  )}
                </p>
              </div>
            </div>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-white text-brand-purple-900 hover:bg-brand-yellow font-bold text-sm px-5 py-2.5 rounded-full mt-2 transition-colors"
            >
              {g("ابدئي الآن", "ابدأ الآن")}
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
