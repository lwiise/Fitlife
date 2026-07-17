import { Suspense } from "react";
import { Users } from "lucide-react";
import {
  getCurrentUserLatestPlan,
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { canGenerateForFamilyChange } from "@/lib/subscription/access";
import {
  isWeighInEligibleMember,
  isWeighInEligibleMom,
} from "@/lib/engagement/eligibility";
import { createClient } from "@/lib/supabase/server";
import { planHasContent, MEMBER_GEN_MAX_ATTEMPTS } from "@fitlife/plan-engine";
import { LogoutButton } from "../dashboard/LogoutButton";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { SettingsLink } from "@/components/SettingsLink";
import { EmptyState } from "./EmptyState";
import { PlanGeneratingState } from "./PlanGeneratingState";
import { PlanFailedState } from "./PlanFailedState";
import { PlanViewer } from "./PlanViewer";
import { WorkoutViewer } from "./WorkoutViewer";
import { WorkoutGeneratingState } from "./WorkoutGeneratingState";
import { RetryWorkoutButton } from "./RetryWorkoutButton";
import { getLatestWorkoutPlan } from "@/lib/plans/getLatestWorkoutPlan";
import Link from "next/link";
import { PlanOnboardingBanner } from "./PlanOnboardingBanner";
import { DeferredMemberDrain } from "./DeferredMemberDrain";
import { SubscriptionSelfHeal } from "./SubscriptionSelfHeal";

export const metadata = {
  title: "خطتي — فت لايف",
  robots: { index: false, follow: false },
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; view?: string }>;
}) {
  const [{ member, view }, profile, latest, familyMembers] = await Promise.all([
    searchParams,
    getCurrentUserProfile(),
    getCurrentUserLatestPlan(),
    getCurrentUserFamilyMembers(),
  ]);
  // Workout plan (opt-in). The toggle renders only when a row exists; the
  // meal view is untouched otherwise.
  const workout = profile ? await getLatestWorkoutPlan(profile.id) : null;
  const workoutView = view === "workout" && workout != null;

  // Inline per-meal tracking marks for this plan (interactive page only —
  // history/housekeeper views never receive them).
  let checkins;
  if (profile && latest?.status === "ready") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("meal_checkins")
      .select("day_index,slot,status,reason")
      .eq("meal_plan_id", latest.id)
      .limit(60);
    checkins = data ?? [];
  }

  const isOnboarded = !!profile?.onboarding_completed_at;
  // Members saved but not yet in the plan (deferred while a prior gen was in
  // flight). When onboarding is done and the plan is ready, a lazy drain fills
  // them in (mirrors the dashboard's pending diff; see DeferredMemberDrain).
  const planMemberIds = latest?.member_ids ?? [];
  const pendingMembers = familyMembers.filter(
    (m) => m.role !== "housekeeper" && !planMemberIds.includes(m.id),
  );
  // Deferred members the tier can't cover → don't auto-drain or show "preparing"
  // (it never completes); show an upgrade nudge instead. (profiles.id = user id.)
  const pendingBlocked =
    pendingMembers.length > 0 && profile
      ? !(await canGenerateForFamilyChange(profile.id)).allowed
      : false;
  // Order by add order so the banner shows the member being prepared NOW vs the
  // rest still queued (the drain generates them one at a time, in this order).
  const addOrder = Array.isArray(profile?.member_addition_order)
    ? (profile.member_addition_order as string[])
    : [];
  const orderedPending = [...pendingMembers].sort(
    (a, b) =>
      (addOrder.indexOf(a.id) === -1 ? Infinity : addOrder.indexOf(a.id)) -
      (addOrder.indexOf(b.id) === -1 ? Infinity : addOrder.indexOf(b.id)),
  );
  const firstPendingName = orderedPending[0]?.name ?? "";
  const restPendingNames = orderedPending
    .slice(1)
    .map((m) => m.name)
    .join("، ");
  // An in-plan member with a failed/missing day (fewer mealed days than the plan's
  // day count) that's still under the retry cap — the drain re-targets it to
  // completion before starting the next member, so keep the drain mounted for it.
  const daysTotal = latest?.plan_data?.days_total ?? 7;
  const genAttempts = latest?.plan_data?.gen_attempts ?? {};
  const hasIncompleteMember = !!latest?.plan_data?.members.some(
    (m) =>
      m.days.filter((d) => d.meals.length > 0).length < daysTotal &&
      (genAttempts[m.member_id] ?? 0) < MEMBER_GEN_MAX_ATTEMPTS,
  );
  const shouldDrain =
    isOnboarded &&
    latest?.status === "ready" &&
    !!latest.plan_data &&
    planHasContent(latest.plan_data) &&
    !pendingBlocked &&
    (pendingMembers.length > 0 || hasIncompleteMember);
  // «رحلتك الخاصة» entries — one per eligible adult (children never, the
  // housekeeper never; the shared rule in engagement/eligibility.ts). The
  // PlanViewer shows the entry on the matching member tab.
  const journeyMembers = [
    ...(isWeighInEligibleMom(profile?.birth_year ?? null)
      ? [{ id: "mom", name: null as string | null }]
      : []),
    ...familyMembers
      .filter((m) => isWeighInEligibleMember(m))
      .map((m) => ({ id: m.id, name: m.name as string | null })),
  ];
  // Housekeeper view entry: only when a housekeeper exists and reads a non-Arabic language.
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");
  const housekeeperLocale =
    housekeeper && housekeeper.preferred_language !== "ar"
      ? housekeeper.preferred_language
      : undefined;
  // Who we're generating for: prefer the plan's own targeted member (stamped on
  // single-member add/regenerate/edit) so the loader names the right person even when
  // the URL has no ?member (the regenerate button refreshes without it). The
  // add-member redirect's ?member (a name) and the account owner are fallbacks.
  // Never framed as "the family".
  const genId = latest?.plan_data?.generating_member_id;
  const genName = genId
    ? genId === "mom"
      ? (profile?.display_name ?? null)
      : (familyMembers.find((m) => m.id === genId)?.name ?? null)
    : null;
  const generatingFor = genName ?? member ?? profile?.display_name ?? null;

  // A member added mid-run is saved + queued (the drain generates them once the
  // current run finishes) — reassure rather than show a "wait" error.
  const isGenerating =
    latest?.status === "generating" ||
    (latest?.status === "ready" && latest.in_progress);
  const queuedNames = pendingMembers.map((m) => m.name).join("، ");

  // "Plan ready" nudge must reflect real readiness — content present and no
  // longer progressing — so it never shows over the generating loader.
  const planReady =
    latest?.status === "ready" &&
    !!latest.plan_data &&
    planHasContent(latest.plan_data) &&
    !latest.in_progress;

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/dashboard"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <div className="flex items-center gap-2">
            <BackToDashboard />
            <SettingsLink />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12">
        <Suspense fallback={null}>
          <PlanOnboardingBanner planReady={planReady} />
        </Suspense>

        {/* Keep a continuous "preparing" indicator for queued members — while the
            current plan generates AND through the hand-off window after it
            finishes (until the new member's own shell lands) — so there is no
            blank gap before the next member shows as loading. */}
        {pendingMembers.length > 0 && !pendingBlocked && (isGenerating || planReady) && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-3 mb-6 text-brand-ink text-sm font-medium leading-relaxed"
          >
            {isGenerating
              ? `أضفنا ${queuedNames} — ${
                  orderedPending.length > 1 ? "نجهّز خططهم" : "نجهّز الخطة"
                } بعد انتهاء الخطة الحالية`
              : restPendingNames
                ? `نجهّز خطة ${firstPendingName} الآن · التالي: ${restPendingNames}`
                : `نجهّز خطة ${firstPendingName} الآن`}
          </div>
        )}

        {pendingBlocked && (
          <div className="rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-4 mb-6">
            {/* A paid user can land here if their activation webhook was missed.
                Reconcile directly with Lemonsqueezy once; if it activates, the
                page refreshes and the drain takes over instead of this banner. */}
            <SubscriptionSelfHeal />
            <div className="flex items-start gap-3">
              <Users
                className="size-5 flex-shrink-0 mt-0.5 text-brand-purple-900"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-brand-ink text-sm font-medium leading-relaxed">
                  جهّزنا خطتك. خطط {queuedNames} متاحة مع الاشتراك — اشتركي
                  ونجهّزها دفعة واحدة مع وجبات العائلة المنسقة.
                </p>
                <a
                  href="/pricing"
                  className="mt-3 inline-flex items-center gap-2 bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-11"
                >
                  عرض الباقات
                </a>
              </div>
            </div>
          </div>
        )}

        {workout != null && (
          <div
            className="inline-flex rounded-full border border-brand-ink/10 bg-white p-1 mb-6"
            role="tablist"
            aria-label="نوع الخطة"
          >
            <Link
              href="/plan"
              role="tab"
              aria-selected={!workoutView}
              className={`min-h-9 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                !workoutView
                  ? "bg-brand-ink text-white"
                  : "text-brand-ink-muted hover:text-brand-ink"
              }`}
            >
              الوجبات
            </Link>
            <Link
              href="/plan?view=workout"
              role="tab"
              aria-selected={workoutView}
              className={`min-h-9 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                workoutView
                  ? "bg-brand-ink text-white"
                  : "text-brand-ink-muted hover:text-brand-ink"
              }`}
            >
              التمارين
            </Link>
          </div>
        )}

        {workoutView && workout && (
          <>
            {workout.status === "generating" && (
              // Server-known initial state: a live meal run means the workout
              // worker is holding (meals-first) — open directly on the
              // "نجهّز وجباتك أولاً" card, no generic flash. `status ===
              // "generating"` covers the first seconds before the meal shell's
              // first emit; `in_progress` covers the rest of the run.
              <WorkoutGeneratingState
                initialWaitingForMeals={
                  !!latest && (latest.status === "generating" || latest.in_progress)
                }
              />
            )}
            {workout.status === "failed" && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4"
              >
                {/* Never surface the raw engine error (English/zod internals);
                    it stays on the DB row for debugging. */}
                <p className="text-sm text-red-700 leading-relaxed">
                  تعذّر إنشاء برنامج التمارين. أعيدي المحاولة، أو عدّلي إجاباتك من الملف الشخصي.
                </p>
                <RetryWorkoutButton />
              </div>
            )}
            {workout.status === "ready" && workout.plan_data && (
              <WorkoutViewer plan={workout.plan_data} />
            )}
          </>
        )}

        {!workoutView && !latest && <EmptyState isOnboarded={isOnboarded} />}

        {!workoutView && latest?.status === "generating" && (
          <PlanGeneratingState planId={latest.id} name={generatingFor} />
        )}

        {!workoutView && latest?.status === "failed" && (
          <PlanFailedState planId={latest.id} reason={latest.error_message} />
        )}

        {!workoutView && latest?.status === "ready" && latest.plan_data && (
          <>
            {shouldDrain && <DeferredMemberDrain generating={latest.in_progress} />}
            <PlanViewer
              plan={latest.plan_data}
              planId={latest.id}
              generating={latest.in_progress}
              updatedAt={latest.updated_at}
              preselectedMember={member}
              housekeeperLocale={housekeeperLocale}
              showWorkoutOptIn={workout === null}
              checkins={checkins}
              journeyMembers={journeyMembers}
            />
          </>
        )}
      </div>
    </main>
  );
}
