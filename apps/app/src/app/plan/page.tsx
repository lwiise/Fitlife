import { Suspense } from "react";
import {
  getCurrentUserLatestPlan,
  getCurrentUserProfile,
} from "@/lib/supabase/queries";
import { LogoutButton } from "../dashboard/LogoutButton";
import { Logo } from "@/components/Logo";
import { EmptyState } from "./EmptyState";
import { PlanGeneratingState } from "./PlanGeneratingState";
import { PlanFailedState } from "./PlanFailedState";
import { PlanViewer } from "./PlanViewer";
import { PlanOnboardingBanner } from "./PlanOnboardingBanner";

export const metadata = {
  title: "خطتي — فت لايف",
  robots: { index: false, follow: false },
};

export default async function PlanPage() {
  const [profile, latest] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserLatestPlan(),
  ]);

  const isOnboarded = !!profile?.onboarding_completed_at;

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
          <LogoutButton />
        </div>
      </header>

      <div className="container-app py-8 md:py-12">
        <Suspense fallback={null}>
          <PlanOnboardingBanner />
        </Suspense>

        {!latest && <EmptyState isOnboarded={isOnboarded} />}

        {latest?.status === "generating" && (
          <PlanGeneratingState planId={latest.id} />
        )}

        {latest?.status === "failed" && <PlanFailedState planId={latest.id} />}

        {latest?.status === "ready" && latest.plan_data && (
          <PlanViewer plan={latest.plan_data} planId={latest.id} />
        )}
      </div>
    </main>
  );
}
