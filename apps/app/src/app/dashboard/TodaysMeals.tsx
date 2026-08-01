import Link from "next/link";
import { Loader2, ChevronLeft } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getTodaysPlanView } from "@/lib/plans/getTodaysPlanView";
import { genderPick } from "@/lib/copy/gender";
import { collapseMealAbsences, isISODate } from "@/lib/engagement/seasonMath";
import { addDaysISO } from "@/lib/plans/dayMapping";
import { TodayHeader } from "./TodayHeader";
import { TodaysMealsClient } from "./TodaysMealsClient";
import { EmptyPlanCTA } from "./EmptyPlanCTA";
import { GeneratingPlanWatcher } from "./GeneratingPlanWatcher";

function HeaderStrip({
  showWeekLink,
  ownerSex,
}: {
  showWeekLink: boolean;
  ownerSex?: string | null;
}) {
  return (
    <div className="flex items-end justify-between gap-3 rounded-2xl bg-gradient-to-l from-brand-lavender/10 to-brand-yellow/10 px-4 py-4">
      <TodayHeader />
      {showWeekLink && (
        <Link
          href="/plan"
          className="inline-flex items-center gap-1 flex-shrink-0 min-h-11 px-2 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
        >
          {genderPick(ownerSex)("اعرضي الأسبوع كامل", "اعرض الأسبوع كامل")}
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
  ownerSex,
}: {
  userId: string;
  isOnboarded: boolean;
  ownerSex?: string | null;
}) {
  const g = genderPick(ownerSex);
  const view = await getTodaysPlanView(userId);

  // Not onboarded + no plan → defer entirely to the dashboard's onboarding
  // nudge (avoid showing "create your plan" before onboarding is done).
  if (view.status === "no_plan" && !isOnboarded) return null;

  if (view.status === "no_plan") {
    return (
      <section className="space-y-4">
        <HeaderStrip showWeekLink={false} ownerSex={ownerSex} />
        <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
          <p className="font-bold text-brand-ink text-lg">ما عندك خطة بعد</p>
          <p className="mt-1 text-brand-ink-muted text-sm leading-relaxed">
            {g(
              "ابدئي بإنشاء خطتك الأولى لمعرفة وجبات اليوم",
              "ابدأ بإنشاء خطتك الأولى لمعرفة وجبات اليوم",
            )}
          </p>
          <div className="mt-4 flex justify-center">
            <EmptyPlanCTA isOnboarded={isOnboarded} ownerSex={ownerSex} />
          </div>
        </div>
      </section>
    );
  }

  if (view.status === "generating") {
    return (
      <section className="space-y-4">
        <HeaderStrip showWeekLink ownerSex={ownerSex} />
        <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
          <Loader2 className="size-6 mx-auto animate-spin motion-reduce:animate-none text-brand-purple-900" aria-hidden="true" />
          <p className="font-bold text-brand-ink text-lg mt-3">خطتك تتجهز الآن…</p>
          {/* Real runs take 5-12 min (measured); «دقيقة تقريباً» read as stuck. */}
          <p className="mt-1 text-brand-ink-muted text-sm">خلال دقائق قليلة</p>
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
        <HeaderStrip showWeekLink={false} ownerSex={ownerSex} />
        <div className="bg-white rounded-2xl border border-red-200 p-6 text-center">
          <p className="font-bold text-brand-ink text-lg">ما قدرنا ننشئ خطتك</p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <EmptyPlanCTA isOnboarded={isOnboarded} variant="failed" ownerSex={ownerSex} />
            <Link
              href="/settings"
              className="inline-flex items-center min-h-11 px-3 rounded-lg text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
            >
              {g("تواصلي معنا", "تواصل معنا")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ready
  // Shared-meal absences (00021) — so today's card shows the same adjusted
  // batch the /plan card shows (display only; the toggle lives on /plan).
  // Untyped cast + tolerant of a pre-apply prod (missing table → []).
  let absences: Array<{ day_index: number; slot: string; member_id: string }> = [];
  try {
    const supabase = await createClient();
    // CALENDAR-keyed, like /plan: every dispatch mints a new meal_plans row and
    // only archives the old one, so a plan-id read went empty mid-week and this
    // card silently showed the UNSCALED batch — the opposite of the adjustment
    // she made. Falls back to the plan id when the week anchor is unusable.
    const base = (supabase as unknown as SupabaseClient)
      .from("meal_absences")
      .select("local_date, day_index, slot, member_id");
    const anchor = isISODate(view.weekStartDate) ? view.weekStartDate : null;
    const { data } = await (anchor
      ? base
          .eq("user_id", userId)
          .gte("local_date", anchor)
          .lte("local_date", addDaysISO(anchor, 6))
      : base.eq("meal_plan_id", view.planId)
    ).limit(400);
    absences = collapseMealAbsences(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        local_date: (r.local_date ?? null) as string | null,
        day_index: r.day_index as number,
        slot: r.slot as string,
        member_id: (r.member_id ?? "") as string,
      })),
      anchor ?? undefined,
    );
  } catch {
    // Absence adjustment is an enrichment — today's meals render regardless.
  }

  return (
    <section className="space-y-4">
      <HeaderStrip showWeekLink ownerSex={ownerSex} />
      <TodaysMealsClient
        members={view.members}
        planId={view.planId}
        weekStartDate={view.weekStartDate}
        ownerSex={ownerSex}
        absences={absences}
      />
    </section>
  );
}
