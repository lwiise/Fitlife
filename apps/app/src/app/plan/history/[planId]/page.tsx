import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPlanById } from "@/lib/plans/getPlanHistory";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { PlanViewer } from "../../PlanViewer";
import { RestorePlanButton } from "../RestorePlanButton";

export const metadata = {
  title: "خطة سابقة — فت لايف",
  robots: { index: false, follow: false },
};

export default async function HistoryPlanViewPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const result = await getPlanById(user.id, planId);
  if (!result) notFound();

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
          <Link
            href="/plan/history"
            className="inline-flex items-center gap-1 min-h-11 px-2 text-brand-ink-muted hover:text-brand-ink text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            كل الخطط
          </Link>
          <RestorePlanButton planId={result.id} />
        </div>

        <PlanViewer plan={result.plan} planId={result.id} readOnly />
      </div>
    </main>
  );
}
