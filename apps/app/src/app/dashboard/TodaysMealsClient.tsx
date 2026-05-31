"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronLeft } from "lucide-react";
import type { MemberPlan } from "@fitlife/plan-engine";
import { dayIndexFromWeekStart } from "@/lib/plans/dayMapping";
import { MealCard } from "@/app/plan/MealCard";

/**
 * Client-side "today" selection. The plan's week is anchored to its generation
 * day, so today's slot = whole days elapsed since `weekStartDate` (computed in
 * Riyadh time, after mount — reflects the user's day, avoids hydration mismatch).
 *
 * TODO (polish, post-MVP): re-check the day every ~5 min and re-render if it
 * rolled over while the dashboard stayed open overnight.
 */
export function TodaysMealsClient({
  members,
  planId: _planId,
  weekStartDate,
}: {
  members: MemberPlan[];
  planId: string;
  weekStartDate: string | null;
}) {
  // null = not mounted yet; -1 = the plan's 7 days have ended.
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!weekStartDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot Riyadh-date compute after mount, keyed on stable prop; no loop
      setDayIndex(0);
      return;
    }
    const raw = dayIndexFromWeekStart(weekStartDate);
    setDayIndex(raw > 6 ? -1 : Math.max(0, raw));
  }, [weekStartDate]);

  const memberNames = useMemo(
    () => Object.fromEntries(members.map((m) => [m.member_id, m.member_name_ar])),
    [members],
  );

  if (dayIndex === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-brand-purple-900" aria-hidden="true" />
      </div>
    );
  }

  if (dayIndex === -1) {
    return (
      <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
        <p className="font-bold text-brand-ink">انتهت أيام خطتك لهذا الأسبوع</p>
        <p className="mt-1 text-brand-ink-muted text-sm leading-relaxed">
          أنشئي خطة جديدة لأسبوع جديد
        </p>
        <Link
          href="/plan"
          className="inline-flex items-center justify-center min-h-11 mt-4 px-5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          الخطة الكاملة
        </Link>
      </div>
    );
  }

  const sections = members
    .map((m) => ({
      member: m,
      day: m.days.find((d) => d.day_index === dayIndex),
    }))
    .filter((s) => s.day && s.day.meals.length > 0);

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
        <p className="font-bold text-brand-ink">ما فيه وجبات لهذا اليوم في خطتك</p>
        <p className="mt-1 text-brand-ink-muted text-sm leading-relaxed">
          تحققي من الخطة الكاملة أو أنشئي خطة جديدة
        </p>
        <Link
          href="/plan"
          className="inline-flex items-center justify-center min-h-11 mt-4 px-5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          الخطة الكاملة
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map(({ member, day }) => {
        const isMom = member.member_id === "mom";
        const initial = member.member_name_ar.trim().charAt(0) || "؟";
        return (
          <section key={member.member_id} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-brand-lavender/40 flex items-center justify-center flex-shrink-0">
                <span className="font-extrabold text-brand-purple-900 text-sm">{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-brand-ink truncate">
                  {isMom && <span className="text-brand-pink me-1">أنتِ ·</span>}
                  {member.member_name_ar}
                </p>
                <p className="text-brand-ink-muted text-xs mt-0.5 tabular-nums">
                  {member.daily_calories_target} سعرة • {day!.meals.length} وجبات
                </p>
              </div>
              <Link
                href={`/plan?member=${encodeURIComponent(member.member_id)}`}
                className="inline-flex items-center gap-1 flex-shrink-0 min-h-11 px-3 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
              >
                الأسبوع الكامل
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="space-y-3 ps-2 border-s-2 border-brand-lavender/40">
              {day!.meals.map((meal, i) => (
                <MealCard key={i} meal={meal} memberNames={memberNames} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
