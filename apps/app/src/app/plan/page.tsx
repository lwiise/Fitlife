import {
  getCurrentUserLatestPlan,
  getCurrentUserProfile,
} from "@/lib/supabase/queries";
import { LogoutButton } from "../dashboard/LogoutButton";
import { EmptyState } from "./EmptyState";
import { PlanGeneratingState } from "./PlanGeneratingState";
import { PlanFailedState } from "./PlanFailedState";
import { PlanViewer } from "./PlanViewer";

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
            className="font-extrabold text-xl text-brand-ink hover:text-brand-purple-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md px-1"
          >
            فت لايف
          </a>
          <LogoutButton />
        </div>
      </header>

      <div className="container-app py-8 md:py-12">
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
