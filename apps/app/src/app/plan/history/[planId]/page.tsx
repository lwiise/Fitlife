import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanById } from "@/lib/plans/getPlanHistory";
import { BackButton } from "@/components/BackButton";
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
