import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanById } from "@/lib/plans/getPlanHistory";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { BackToDashboard } from "@/components/BackToDashboard";
import { PlanViewer } from "../../PlanViewer";
import { RestorePlanButton } from "../RestorePlanButton";

export const metadata = {
  title: "خطة سابقة — فت لايف",
  robots: { index: false, follow: false },
};

export default async function HistoryPlanViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { planId } = await params;
  const { member } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const result = await getPlanById(user.id, planId);
  if (!result) notFound();

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("sex")
    .eq("id", user.id)
    .single();
  const ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex ?? null;

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
          <BackToDashboard />
        </div>
      </header>

      <div className="container-app py-8 md:py-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <BackButton
            href={member ? `/plan/history?member=${member}` : "/plan/history"}
            label="كل الخطط"
          />
          {!result.isCurrent && member && (
            <RestorePlanButton planId={result.id} memberId={member} ownerSex={ownerSex} />
          )}
        </div>

        <PlanViewer
          plan={result.plan}
          planId={result.id}
          readOnly
          preselectedMember={member}
          ownerSex={ownerSex}
        />
      </div>
    </main>
  );
}
