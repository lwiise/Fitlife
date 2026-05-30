import { Suspense } from "react";
import {
  getCurrentUserLatestPlan,
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { planHasContent } from "@fitlife/plan-engine";
import { LogoutButton } from "../dashboard/LogoutButton";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { SettingsLink } from "@/components/SettingsLink";
import { EmptyState } from "./EmptyState";
import { PlanGeneratingState } from "./PlanGeneratingState";
import { PlanFailedState } from "./PlanFailedState";
import { PlanViewer } from "./PlanViewer";
import { PlanOnboardingBanner } from "./PlanOnboardingBanner";
import { DeferredMemberDrain } from "./DeferredMemberDrain";

export const metadata = {
  title: "خطتي — فت لايف",
  robots: { index: false, follow: false },
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const [{ member }, profile, latest, familyMembers] = await Promise.all([
    searchParams,
    getCurrentUserProfile(),
    getCurrentUserLatestPlan(),
    getCurrentUserFamilyMembers(),
  ]);

  const isOnboarded = !!profile?.onboarding_completed_at;
  // Members saved but not yet in the plan (deferred while a prior gen was in
  // flight). When onboarding is done and the plan is ready, a lazy drain fills
  // them in (mirrors the dashboard's pending diff; see DeferredMemberDrain).
  const planMemberIds = latest?.member_ids ?? [];
  const pendingMembers = familyMembers.filter(
    (m) => m.role !== "housekeeper" && !planMemberIds.includes(m.id),
  );
  const shouldDrain =
    isOnboarded &&
    latest?.status === "ready" &&
    !!latest.plan_data &&
    planHasContent(latest.plan_data) &&
    pendingMembers.length > 0;
  // Housekeeper view entry: only when a housekeeper exists and reads a non-Arabic language.
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");
  const housekeeperLocale =
    housekeeper && housekeeper.preferred_language !== "ar"
      ? housekeeper.preferred_language
      : undefined;
  // Who we're generating for: the just-added member (from the redirect param),
  // otherwise the account owner. Never framed as "the family".
  const generatingFor = member || profile?.display_name || null;

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
          <PlanOnboardingBanner />
        </Suspense>

        {!latest && <EmptyState isOnboarded={isOnboarded} />}

        {latest?.status === "generating" && (
          <PlanGeneratingState planId={latest.id} name={generatingFor} />
        )}

        {latest?.status === "failed" && (
          <PlanFailedState planId={latest.id} reason={latest.error_message} />
        )}

        {latest?.status === "ready" && latest.plan_data && (
          <>
            {shouldDrain && <DeferredMemberDrain />}
            <PlanViewer
              plan={latest.plan_data}
              planId={latest.id}
              generating={latest.in_progress}
              preselectedMember={member}
              housekeeperLocale={housekeeperLocale}
            />
          </>
        )}
      </div>
    </main>
  );
}
