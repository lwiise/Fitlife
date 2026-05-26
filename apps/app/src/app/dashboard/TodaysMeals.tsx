import Link from "next/link";
import { Loader2, ChevronLeft } from "lucide-react";
import { getTodaysPlanView } from "@/lib/plans/getTodaysPlanView";
import { TodayHeader } from "./TodayHeader";
import { TodaysMealsClient } from "./TodaysMealsClient";
import { EmptyPlanCTA } from "./EmptyPlanCTA";
import { GeneratingPlanWatcher } from "./GeneratingPlanWatcher";

function HeaderStrip({ showWeekLink }: { showWeekLink: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 rounded-2xl bg-gradient-to-l from-brand-lavender/10 to-brand-yellow/10 px-4 py-4">
      <TodayHeader />
      {showWeekLink && (
        <Link
          href="/plan"
          className="inline-flex items-center gap-1 flex-shrink-0 min-h-11 px-2 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
        >
          اعرضي الأسبوع كامل
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/**
 * Primary dashboard content: today's meals for all family members. Server
 * component — fetches + branches status; the actual "today" day selection is
 * done client-side (device date) inside TodaysMealsClient.
 */
export async function TodaysMeals({
  userId,
  isOnboarded,
}: {
  userId: string;
  isOnboarded: boolean;
}) {
  const view = await getTodaysPlanView(userId);

  // Not onboarded + no plan → defer entirely to the dashboard's onboarding
  // nudge (avoid showing "create your plan" before onboarding is done).
  if (view.status === "no_plan" && !isOnboarded) return null;

  if (view.status === "no_plan") {
    return (
      <section className="space-y-4">
        <HeaderStrip showWeekLink={false} />
        <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
          <p className="font-bold text-brand-ink text-lg">ما عندك خطة بعد</p>
          <p className="mt-1 text-brand-ink-muted text-sm leading-relaxed">
            ابدئي بإنشاء خطتك الأولى لمعرفة وجبات اليوم
          </p>
          <div className="mt-4 flex justify-center">
            <EmptyPlanCTA isOnboarded={isOnboarded} />
          </div>
        </div>
      </section>
    );
  }

  if (view.status === "generating") {
    return (
      <section className="space-y-4">
        <HeaderStrip showWeekLink />
        <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
          <Loader2 className="size-6 mx-auto animate-spin motion-reduce:animate-none text-brand-purple-900" aria-hidden="true" />
          <p className="font-bold text-brand-ink text-lg mt-3">خطتك تتجهز الآن…</p>
          <p className="mt-1 text-brand-ink-muted text-sm">خلال دقيقة تقريباً</p>
          <Link
            href="/plan"
            className="inline-flex items-center justify-center min-h-11 mt-4 px-5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            عرض التقدم
          </Link>
        </div>
        <GeneratingPlanWatcher />
      </section>
    );
  }

  if (view.status === "failed") {
    return (
      <section className="space-y-4">
        <HeaderStrip showWeekLink={false} />
        <div className="bg-white rounded-2xl border border-red-200 p-6 text-center">
          <p className="font-bold text-brand-ink text-lg">ما قدرنا ننشئ خطتك</p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <EmptyPlanCTA isOnboarded={isOnboarded} variant="failed" />
            <Link
              href="/settings"
              className="text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors"
            >
              تواصلي معنا
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ready
  return (
    <section className="space-y-4">
      <HeaderStrip showWeekLink />
      <TodaysMealsClient members={view.members} planId={view.planId} />
    </section>
  );
}
