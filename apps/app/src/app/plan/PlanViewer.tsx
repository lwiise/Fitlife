"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, UserPlus, History, ChefHat } from "lucide-react";
import type { MealPlan, MemberPlan, LocaleCode } from "@fitlife/plan-engine";
import { MealCard } from "./MealCard";
import { RegenerateButton } from "./RegenerateButton";
// @react-pdf is dynamically imported inside this button's click handler, so it
// doesn't enter the page bundle and never renders during the React tree render.
import { DownloadPDFButton } from "./pdf/DownloadPDFButton";
import {
  dayIndexFromWeekStart,
  dayNameFromWeekStart,
  getDayNameInLocale,
} from "@/lib/plans/dayMapping";
import { getPlanStrings, getLocaleInfo } from "@/lib/plans/locales";

function formatWeekRange(weekStart: string, locale?: LocaleCode): string {
  try {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const intlLocale = locale && locale !== "ar" ? `${locale}-u-ca-gregory` : "ar-SA";
    const fmt = new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "long",
    });
    return `${fmt.format(start)} — ${fmt.format(end)}`;
  } catch {
    return weekStart;
  }
}

export function PlanViewer({
  plan,
  planId: _planId,
  generating = false,
  preselectedMember,
  readOnly = false,
  housekeeperLocale,
  locale,
}: {
  plan: MealPlan;
  planId: string;
  generating?: boolean;
  preselectedMember?: string;
  // Historical view (e.g. /plan/history/[id]): hide regenerate + add-member,
  // and don't rewrite the URL.
  readOnly?: boolean;
  // Set (to a non-Arabic locale) when the household has a housekeeper who reads
  // another language → show the "housekeeper recipes" entry link.
  housekeeperLocale?: string;
  // Housekeeper view: render translated content + localized chrome + dir/lang.
  locale?: LocaleCode;
}) {
  const router = useRouter();
  const translated = !!locale && locale !== "ar";
  const t = getPlanStrings(locale ?? "ar");
  const dir = translated ? getLocaleInfo(locale).direction : undefined;
  const [activeMemberId, setActiveMemberId] = useState<string>(
    preselectedMember && plan.members.some((m) => m.member_id === preselectedMember)
      ? preselectedMember
      : (plan.members[0]?.member_id ?? "mom"),
  );
  // The week is anchored to the generation day → default to today's slot.
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    const i = dayIndexFromWeekStart(plan.week_start_date);
    return i >= 0 && i <= 6 ? i : 0;
  });

  // The ?member= param only seeds the initial tab; strip it after mount so a
  // later refresh doesn't override the user's subsequent tab clicks.
  useEffect(() => {
    if (readOnly) return;
    if (typeof window !== "undefined" && window.location.search.includes("member=")) {
      window.history.replaceState(null, "", "/plan");
    }
  }, [readOnly]);

  // While later days are still being prepared, poll for them: a periodic
  // router.refresh pulls the newly-persisted days; once `generating` is false
  // the next render stops the interval.
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [generating, router]);

  const activeMember: MemberPlan | undefined = useMemo(
    () => plan.members.find((m) => m.member_id === activeMemberId) ?? plan.members[0],
    [plan.members, activeMemberId],
  );

  const activeDay = useMemo(() => {
    if (!activeMember) return undefined;
    return activeMember.days.find((d) => d.day_index === activeDayIndex);
  }, [activeMember, activeDayIndex]);

  const memberNames = useMemo(
    () =>
      Object.fromEntries(
        plan.members.map((m) => [m.member_id, m.member_name_ar]),
      ),
    [plan.members],
  );

  const isSolo = plan.members.length === 1;

  if (!activeMember) {
    return (
      <div className="text-center py-12">
        <p className="text-brand-ink-muted">{t.empty_plan}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir} lang={translated ? locale : undefined}>
      {/* Top strip: week range + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-brand-ink-muted text-xs">{t.this_week}</p>
          <p className="font-bold text-brand-ink text-base tabular-nums">
            {formatWeekRange(plan.week_start_date, locale)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly && isSolo && (
            <Link
              href="/family"
              className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              إضافة فرد
            </Link>
          )}
          {!readOnly && (
            <Link
              href="/plan/history"
              className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              <History className="size-4" aria-hidden="true" />
              الخطط السابقة
            </Link>
          )}
          {!readOnly && housekeeperLocale && (
            <Link
              href="/plan/housekeeper"
              className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              <ChefHat className="size-4" aria-hidden="true" />
              وصفات الخدامة
            </Link>
          )}
          {!translated && (
            <DownloadPDFButton
              memberPlan={activeMember}
              planMetadata={{ week_start_date: plan.week_start_date }}
            />
          )}
          {!readOnly && <RegenerateButton />}
        </div>
      </div>

      {/* Member tabs (hidden for a solo plan) */}
      {!isSolo && (
      <div className="border-b border-brand-ink/10 -mx-4 px-4 overflow-x-auto">
        <div className="flex items-center justify-between gap-2 min-w-max">
        <div className="flex gap-1">
          {plan.members.map((m) => {
            const isActive = m.member_id === activeMemberId;
            const isMom = m.member_id === "mom";
            return (
              <button
                key={m.member_id}
                type="button"
                onClick={() => setActiveMemberId(m.member_id)}
                aria-pressed={isActive}
                className={`relative px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${
                  isActive
                    ? "text-brand-purple-900"
                    : "text-brand-ink-muted hover:text-brand-ink"
                }`}
              >
                {isMom && (
                  <span className="text-brand-pink me-1">{t.you} ·</span>
                )}
                {m.member_name_ar}
                {isActive && (
                  <motion.span
                    layoutId="member-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-purple-900"
                  />
                )}
              </button>
            );
          })}
        </div>
        {!readOnly && (
          <Link
            href="/family"
            className="inline-flex items-center gap-1.5 flex-shrink-0 min-h-11 px-3 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            إضافة فرد
          </Link>
        )}
        </div>
      </div>
      )}

      {/* Member summary tiles */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">{t.daily_calories}</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {activeMember.daily_calories_target}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">{t.protein}</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {activeMember.macros_target.protein_g}
            <span className="text-brand-ink-muted text-xs ms-1">{t.grams}</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">{t.carbs}</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {activeMember.macros_target.carbs_g}
            <span className="text-brand-ink-muted text-xs ms-1">{t.grams}</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">{t.fat}</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {activeMember.macros_target.fat_g}
            <span className="text-brand-ink-muted text-xs ms-1">{t.grams}</span>
          </p>
        </div>
      </div>

      {/* Day tabs */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const day = activeMember.days.find((d) => d.day_index === i);
          const label = translated
            ? getDayNameInLocale(i, locale)
            : day?.day_name_ar || dayNameFromWeekStart(plan.week_start_date, i) || `${i + 1}`;
          const isActive = i === activeDayIndex;
          const pending = generating && (!day || day.meals.length === 0);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveDayIndex(i)}
              aria-pressed={isActive}
              className={`relative rounded-xl py-2.5 font-bold text-xs transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${
                isActive
                  ? "bg-brand-purple-900 text-white"
                  : "bg-brand-lavender/30 text-brand-purple-900 hover:bg-brand-lavender/50"
              }`}
            >
              {label}
              {pending && (
                <Loader2
                  className="absolute top-1 end-1 size-3 animate-spin motion-reduce:animate-none opacity-70"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Day total pill */}
      {activeDay && (
        <div className="inline-flex flex-wrap items-center gap-2 bg-white rounded-full border border-brand-ink/5 px-4 py-2">
          <span className="text-brand-ink-muted text-xs">{t.day_total}:</span>
          <span className="font-bold text-brand-ink text-sm tabular-nums">
            {activeDay.day_total.calories} {t.calories_unit}
          </span>
          <span className="text-brand-ink-muted/40">·</span>
          <span className="text-brand-ink text-xs tabular-nums">
            {activeDay.day_total.protein_g} {t.protein}
          </span>
          <span className="text-brand-ink-muted/40">·</span>
          <span className="text-brand-ink text-xs tabular-nums">
            {activeDay.day_total.carbs_g} {t.carbs}
          </span>
          <span className="text-brand-ink-muted/40">·</span>
          <span className="text-brand-ink text-xs tabular-nums">
            {activeDay.day_total.fat_g} {t.fat}
          </span>
        </div>
      )}

      {/* Meal list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeMemberId}-${activeDayIndex}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {activeDay && activeDay.meals.length > 0 ? (
            activeDay.meals.map((meal, i) => (
              <MealCard key={i} meal={meal} memberNames={memberNames} locale={locale} />
            ))
          ) : generating ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2
                className="size-6 animate-spin motion-reduce:animate-none text-brand-purple-900"
                aria-hidden="true"
              />
              <p className="text-brand-ink-muted text-sm">{t.generating}</p>
            </div>
          ) : (
            <div className="text-center py-8 text-brand-ink-muted text-sm">
              {t.no_meals}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
