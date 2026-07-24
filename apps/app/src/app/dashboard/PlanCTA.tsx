import Link from "next/link";
import { CalendarDays, ChevronLeft, Loader2 } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";
import { EmptyPlanCTA } from "./EmptyPlanCTA";
import { GeneratingPlanWatcher } from "./GeneratingPlanWatcher";

export type PlanCTAState = "ready" | "generating" | "failed" | "none";

/**
 * The dashboard's doorway to /plan — the one clear call to action to the
 * weekly plan (the leaderboard move stripped every /plan link off the page).
 * Ready state is a whole-card link with zero client JS; the other lifecycle
 * states keep the plan reachable (progress, retry, first generation).
 */
export function PlanCTA({
  state,
  isOnboarded,
  ownerSex,
  memberCount,
}: {
  state: PlanCTAState;
  isOnboarded: boolean;
  ownerSex?: string | null;
  memberCount: number;
}) {
  const g = genderPick(ownerSex);

  if (state === "ready") {
    return (
      <Link
        href="/plan"
        className="group block rounded-3xl bg-brand-purple-900 hover:bg-brand-purple-700 transition-colors shadow-[0_14px_32px_-24px_rgba(78,36,144,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-4 p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="grid place-items-center size-11 shrink-0 rounded-full bg-white/10 text-brand-yellow"
          >
            <CalendarDays className="size-6" />
          </span>
          <div className="flex-1 min-w-44">
            <h2 className="font-extrabold text-white text-lg sm:text-xl leading-tight">
              خطة هذا الأسبوع
            </h2>
            <p className="text-white/75 text-sm mt-0.5 leading-relaxed">
              {memberCount > 1
                ? "٧ أيام من وجبات بيتك جاهزة بالمقادير"
                : "٧ أيام من وجباتك جاهزة بالمقادير"}
            </p>
          </div>
          <span className="inline-flex items-center justify-center gap-1.5 min-h-11 px-5 rounded-full bg-white text-brand-purple-900 group-hover:bg-brand-yellow text-sm font-bold transition-colors w-full sm:w-auto">
            {g("اعرضي الخطة", "اعرض الخطة")}
            <ChevronLeft
              className="size-4 transition-transform motion-reduce:transition-none group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    );
  }

  if (state === "generating") {
    return (
      <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
        <Loader2
          className="size-6 mx-auto animate-spin motion-reduce:animate-none text-brand-purple-900"
          aria-hidden="true"
        />
        <p className="font-bold text-brand-ink text-lg mt-3">خطتك تتجهز الآن…</p>
        <p className="mt-1 text-brand-ink-muted text-sm">خلال دقيقة تقريباً</p>
        <Link
          href="/plan"
          className="inline-flex items-center justify-center min-h-11 mt-4 px-5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          عرض التقدم
        </Link>
        <GeneratingPlanWatcher />
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-6 text-center">
        <p className="font-bold text-brand-ink text-lg">ما قدرنا ننشئ خطتك</p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <EmptyPlanCTA isOnboarded={isOnboarded} variant="failed" ownerSex={ownerSex} />
          <Link
            href="/settings"
            className="text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors"
          >
            {g("تواصلي معنا", "تواصل معنا")}
          </Link>
        </div>
      </div>
    );
  }

  // none — onboarded but no plan yet
  return (
    <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
      <p className="font-bold text-brand-ink text-lg">ما عندك خطة بعد</p>
      <p className="mt-1 text-brand-ink-muted text-sm leading-relaxed">
        {g(
          "أنشئي خطتك الأولى لعرض وجبات الأسبوع",
          "أنشئ خطتك الأولى لعرض وجبات الأسبوع",
        )}
      </p>
      <div className="mt-4 flex justify-center">
        <EmptyPlanCTA isOnboarded={isOnboarded} ownerSex={ownerSex} />
      </div>
    </div>
  );
}
