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
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { planHasContent, MEMBER_GEN_MAX_ATTEMPTS } from "@fitlife/plan-engine";
import { applyChildDisplayTargets } from "@/lib/plans/childTargets";
import { applyMemberDisplayNames } from "@/lib/plans/memberNames";
import { genderPick } from "@/lib/copy/gender";
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
  // Live-roster names to overlay onto the frozen plan snapshot at read time, so
  // a member/mom rename in Settings is reflected immediately without a
  // regenerate — the snapshot keeps whatever name it captured at generation.
  // Applied to both the meal plan and the workout plan below. See
  // applyMemberDisplayNames.
  const nameRoster = {
    mom: { display_name: profile?.display_name ?? null },
    members: familyMembers,
  };

  const isOnboarded = !!profile?.onboarding_completed_at;
  // Members saved but not yet in the plan (deferred while a prior gen was in
  // flight). When onboarding is done and the plan is ready, a lazy drain fills
  // them in (mirrors the dashboard's pending diff; see DeferredMemberDrain).
  const planMemberIds = latest?.member_ids ?? [];
  const pendingMembers = familyMembers.filter(
    (m) => m.role !== "housekeeper" && !planMemberIds.includes(m.id),
  );

  // The workout chain, the meal marks, and the access gate are mutually
  // independent — fetch them in one parallel batch instead of four stages.
  const [workoutBundle, mealMarks, familyChangeAccess] = await Promise.all([
    // Workout plan (opt-in) + its session marks (the exercise pillar). The
    // toggle renders only when a row exists; the meal view is untouched
    // otherwise. Untyped cast: workout_checkins (00020) isn't in the generated
    // Database types until db:types is regenerated; select("*") degrades to []
    // on a pre-apply prod. Feeds WorkoutViewer's inline session marking (the
    // «موسم بيتنا» leaderboard now lives on the dashboard and fetches its own
    // marks via getFamilySeasonProps).
    (async () => {
      const workout = profile ? await getLatestWorkoutPlan(profile.id) : null;
      let workoutCheckins:
        | Array<{ day_index: number; member_id: string; status: string }>
        | undefined;
      if (profile && workout?.status === "ready") {
        const supabase = await createClient();
        const { data } = await (supabase as unknown as SupabaseClient)
          .from("workout_checkins")
          .select("*")
          .eq("workout_plan_id", workout.id)
          .limit(400);
        workoutCheckins = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          day_index: r.day_index as number,
          member_id: (r.member_id ?? "") as string,
          status: r.status as string,
        }));
      }
      return { workout, workoutCheckins };
    })(),
    // Inline per-meal tracking marks + per-dish verdicts («كيف كانت؟») for this
    // plan (interactive page only — history/housekeeper views never receive
    // them). select("*") on purpose: member_id is a 00019 column — naming it
    // would fail the whole read on a pre-apply prod, while * degrades to rows
    // without it (house tolerance pattern). Rows are per (day, slot, member) →
    // 7 days × 4 slots × household. meal_verdicts is a 00017 table; a missing
    // table degrades to [].
    (async () => {
      if (!profile || latest?.status !== "ready") return null;
      const supabase = await createClient();
      // meal_absences (00021) is not in the generated types yet — untyped
      // cast, and a pre-apply prod (missing table) degrades to [] so the plan
      // still renders without absence adjustments.
      const [checkinRes, verdictRes, absenceRes] = await Promise.all([
        supabase.from("meal_checkins").select("*").eq("meal_plan_id", latest.id).limit(400),
        supabase.from("meal_verdicts").select("*").eq("meal_plan_id", latest.id).limit(400),
        (async (): Promise<{ data: unknown[] | null }> => {
          try {
            return await (supabase as unknown as SupabaseClient)
              .from("meal_absences")
              .select("*")
              .eq("meal_plan_id", latest.id)
              .limit(400);
          } catch {
            return { data: null };
          }
        })(),
      ]);
      return {
        checkins: ((checkinRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          day_index: r.day_index as number,
          slot: r.slot as string,
          status: r.status as string,
          reason: (r.reason ?? null) as string | null,
          member_id: (r.member_id ?? null) as string | null,
        })),
        verdicts: ((verdictRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          day_index: r.day_index as number,
          slot: r.slot as string,
          member_id: (r.member_id ?? null) as string | null,
          verdict: r.verdict as string,
        })),
        absences: ((absenceRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          day_index: r.day_index as number,
          slot: r.slot as string,
          member_id: (r.member_id ?? "") as string,
        })),
      };
    })(),
    // Deferred members the tier can't cover → don't auto-drain or show
    // "preparing" (it never completes); show an upgrade nudge instead.
    // (profiles.id = user id.)
    pendingMembers.length > 0 && profile
      ? canGenerateForFamilyChange(profile.id)
      : null,
  ]);

  const { workout, workoutCheckins } = workoutBundle;
  const workoutView = view === "workout" && workout != null;
  const checkins = mealMarks?.checkins;
  const verdicts = mealMarks?.verdicts;
  const absences = mealMarks?.absences;
  const pendingBlocked = familyChangeAccess ? !familyChangeAccess.allowed : false;
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
  // «رحلتك الخاصة» entries — one per member who may keep a private weight
  // record (adults AND children now, per owner directive; the housekeeper
  // never — the shared rule in engagement/eligibility.ts). The PlanViewer shows
  // the entry on the matching member tab; a child's journey has no body photos
  // and never feeds the shared goal celebration (both enforced in the journey/
  // action/seasonProps layer, not here).
  const journeyMembers = [
    ...(isWeighInEligibleMom(profile?.birth_year ?? null)
      ? [{ id: "mom", name: null as string | null, sex: profile?.sex ?? null }]
      : []),
    ...familyMembers
      .filter((m) => isWeighInEligibleMember(m))
      .map((m) => ({
        id: m.id,
        name: m.name as string | null,
        sex: m.sex as string | null,
      })),
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

  // The meal-ready view renders PlanViewer, which hosts the plan-type toggle in
  // the same row as the «الوزن والمتابعة» journey link. Every other state renders
  // the toggle standalone above its content.
  const mealReadyView =
    !workoutView && latest?.status === "ready" && !!latest.plan_data;

  const planTypeToggle =
    workout != null ? (
      <div
        className="inline-flex rounded-full border border-brand-ink/10 bg-white p-1"
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
    ) : null;

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
          <PlanOnboardingBanner planReady={planReady} ownerSex={profile?.sex} />
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
                  جهّزنا خطتك. خطط {queuedNames} متاحة مع الاشتراك —{" "}
                  {genderPick(profile?.sex)("اشتركي", "اشترك")} ونجهّزها دفعة
                  واحدة مع وجبات العائلة المنسقة.
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

        {/* Standalone in every state except the meal-ready view, where
            PlanViewer renders it inline with the journey link. */}
        {planTypeToggle && !mealReadyView && <div className="mb-6">{planTypeToggle}</div>}

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
                ownerSex={profile?.sex}
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
                  تعذّر إنشاء برنامج التمارين.{" "}
                  {genderPick(profile?.sex)(
                    "أعيدي المحاولة، أو عدّلي إجاباتك من الملف الشخصي.",
                    "أعِد المحاولة، أو عدّل إجاباتك من الملف الشخصي.",
                  )}
                </p>
                <RetryWorkoutButton ownerSex={profile?.sex} />
              </div>
            )}
            {workout.status === "ready" && workout.plan_data && (
              <WorkoutViewer
                plan={applyMemberDisplayNames(workout.plan_data, nameRoster)}
                planId={workout.id}
                checkins={workoutCheckins}
                ownerSex={profile?.sex}
              />
            )}
          </>
        )}

        {!workoutView && !latest && (
          <EmptyState isOnboarded={isOnboarded} ownerSex={profile?.sex} />
        )}

        {!workoutView && latest?.status === "generating" && (
          <PlanGeneratingState
            planId={latest.id}
            name={generatingFor}
            ownerSex={profile?.sex}
          />
        )}

        {!workoutView && latest?.status === "failed" && (
          <PlanFailedState
            planId={latest.id}
            reason={latest.error_message}
            ownerSex={profile?.sex}
          />
        )}

        {!workoutView && latest?.status === "ready" && latest.plan_data && (
          <>
            {shouldDrain && <DeferredMemberDrain generating={latest.in_progress} />}
            <PlanViewer
              plan={applyMemberDisplayNames(
                profile
                  ? applyChildDisplayTargets(latest.plan_data, {
                      mom: {
                        member_type: profile.member_type,
                        birth_year: profile.birth_year,
                      },
                      members: familyMembers,
                    })
                  : latest.plan_data,
                nameRoster,
              )}
              planId={latest.id}
              generating={latest.in_progress}
              updatedAt={latest.updated_at}
              preselectedMember={member}
              housekeeperLocale={housekeeperLocale}
              showWorkoutOptIn={workout === null}
              checkins={checkins}
              verdicts={verdicts}
              absences={absences}
              journeyMembers={journeyMembers}
              planTypeToggle={planTypeToggle}
              ownerSex={profile?.sex}
            />
          </>
        )}
      </div>
    </main>
  );
}
