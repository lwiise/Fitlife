"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Loader2, Clock, UserPlus, History, ChefHat, AlertTriangle, HeartPulse } from "lucide-react";
import type { MealPlan, MemberPlan, LocaleCode } from "@fitlife/plan-engine";
import { MealCard } from "./MealCard";
import { WorkoutDayCard } from "./WorkoutDayCard";
import { RegenerateButton } from "./RegenerateButton";
// @react-pdf is dynamically imported inside this button's click handler, so it
// doesn't enter the page bundle and never renders during the React tree render.
import { DownloadPDFButton } from "./pdf/DownloadPDFButton";
import {
  dayIndexFromWeekStart,
  dayNameFromWeekStart,
  getLocalizedDayNameFromWeekStart,
} from "@/lib/plans/dayMapping";
import { getPlanStrings, getLocaleInfo } from "@/lib/plans/locales";
import { orderDayMeals } from "@/lib/plans/mealOrder";

// A day stuck "preparing" this long with no new write means the worker died —
// far longer than a healthy day stream (~1-2 min), far shorter than the 15-min
// server-side dead-man's switch.
const STALE_PREPARING_MS = 180_000;

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
  updatedAt,
  preselectedMember,
  readOnly = false,
  hideExport = false,
  housekeeperLocale,
  locale,
  withheldMemberIds = [],
  domainPickerMemberIds = [],
  budgetChangedByMember = {},
}: {
  plan: MealPlan;
  planId: string;
  generating?: boolean;
  // Last write to the plan row. If a day stays "preparing" while this stops
  // advancing, the background worker died — surface the retry box instead of
  // spinning until the 15-min server-side dead-man's switch.
  updatedAt?: string;
  preselectedMember?: string;
  // Historical view (e.g. /plan/history/[id]): hide regenerate + add-member,
  // and don't rewrite the URL.
  readOnly?: boolean;
  // Hide the PDF export (the admin plan view: read-only, no customer export).
  hideExport?: boolean;
  // Set (to a non-Arabic locale) when the household has a housekeeper who reads
  // another language → show the "housekeeper recipes" entry link.
  housekeeperLocale?: string;
  // Housekeeper view: render translated content + localized chrome + dir/lang.
  locale?: LocaleCode;
  // Members who opted into exercise but are WITHHELD pending doctor sign-off
  // (pregnant/lactating/medical) — they get no workout; show a clearance note.
  withheldMemberIds?: string[];
  // Members for whom the regen DOMAIN picker (meals/exercise/both) is offered —
  // i.e. they have an exercise plan to regenerate independently of their meals.
  domainPickerMemberIds?: string[];
  // Per-member: would an exercise edit move the calorie math (so "exercise only"
  // auto-promotes to "both")? Drives the inline promote note. Server re-checks.
  budgetChangedByMember?: Record<string, boolean>;
}) {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const translated = !!locale && locale !== "ar";
  const t = getPlanStrings(locale ?? "ar");
  const dir = translated ? getLocaleInfo(locale).direction : undefined;
  // Maid view: a day is shown only once ALL its recipes are translated to her
  // locale — otherwise we show a loading state, never the Arabic fallback.
  const isDayTranslated = (day?: MemberPlan["days"][number]) =>
    !!day &&
    day.meals.length > 0 &&
    day.meals.every((m) => m.prep_steps_translated_locale === locale);
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
    // Belt-and-suspenders: even if the `generating` flag were stranded true,
    // stop polling once every member's every day actually has meals — the plan
    // is complete, so there is nothing left to pull in.
    const allContentComplete = plan.members.every(
      (m) => m.days.length > 0 && m.days.every((d) => d.meals.length > 0),
    );
    if (allContentComplete) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [generating, plan.members, router]);

  // Ticking clock so `preparingStalled` re-evaluates without a server round-trip:
  // if the worker died, updatedAt stops advancing and no refresh changes props.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [generating]);

  // Cycle honest per-day process lines (~3s) while generating so the loader reads
  // as active. A day is one atomic AI call, so these describe the real work —
  // not fake per-meal completion. Text-only change (no motion).
  const [stepTick, setStepTick] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(() => setStepTick((s) => s + 1), 3000);
    return () => clearInterval(id);
  }, [generating]);
  // The plan row hasn't been written in a while but is still flagged generating
  // → treat the active "preparing" day as failed so the retry box appears,
  // instead of spinning until the server-side dead-man's switch (15 min).
  const preparingStalled =
    generating &&
    !!updatedAt &&
    now - Date.parse(updatedAt) > STALE_PREPARING_MS;

  const activeMember: MemberPlan | undefined = useMemo(
    () => plan.members.find((m) => m.member_id === activeMemberId) ?? plan.members[0],
    [plan.members, activeMemberId],
  );

  const activeDay = useMemo(() => {
    if (!activeMember) return undefined;
    return activeMember.days.find((d) => d.day_index === activeDayIndex);
  }, [activeMember, activeDayIndex]);

  // Canonical daily order (breakfast → morning snack → lunch → evening snack →
  // dinner). Passing every member's meals for this day keeps a SHARED meal in the
  // same position for everyone who shares it.
  const orderedMeals = useMemo(() => {
    if (!activeDay) return [];
    const familyDay = plan.members.map(
      (m) => m.days.find((d) => d.day_index === activeDayIndex)?.meals ?? [],
    );
    return orderDayMeals(activeDay.meals, familyDay);
  }, [activeDay, plan.members, activeDayIndex]);

  // Does the active member have any SHARED meal across the week? Drives the
  // regenerate-scope dialog (skipped when they have none — nothing to scope).
  const activeMemberHasShared = useMemo(
    () =>
      !!activeMember?.days.some((d) =>
        d.meals.some((m) => m.shared_recipe === true),
      ),
    [activeMember],
  );

  const memberLabel = (m: MemberPlan) =>
    translated ? (m.member_name_translated ?? m.member_name_ar) : m.member_name_ar;

  const memberNames = useMemo(
    () =>
      Object.fromEntries(
        plan.members.map((m) => [m.member_id, memberLabel(m)]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.members, translated],
  );

  const isSolo = plan.members.length === 1;

  // Exercise plan (rides in plan_data.workouts). Arabic view only — the translated
  // housekeeper view stays meals-only. The meals/exercise toggle appears when a
  // member has a generated workout OR is withheld pending doctor sign-off.
  const [view, setView] = useState<"meals" | "exercise">("meals");
  const workouts = plan.workouts ?? [];
  const hasExercise =
    !translated && (workouts.length > 0 || withheldMemberIds.length > 0);
  const exerciseView = hasExercise && view === "exercise";
  const activeWorkout = workouts.find((w) => w.member_id === activeMemberId);
  const activeIsWithheld = withheldMemberIds.includes(activeMemberId);
  // Regen domain picker (meals/exercise/both) — offered only for a member with an
  // exercise plan; the promote note shows if her edit moved the calorie math.
  const activeCanPickDomain = domainPickerMemberIds.includes(activeMemberId);
  const activeBudgetChanged = budgetChangedByMember[activeMemberId] ?? false;
  const activeWorkoutDay = activeWorkout?.days.find(
    (d) => d.day_index === activeDayIndex,
  );
  const workoutSessionDays =
    activeWorkout?.days.filter((d) => d.entry.kind === "session").length ?? 0;
  const ceilingLabel = (c: string) =>
    c === "can_progress_to_vigorous" ? "حتى القوي" : "خفيف–متوسط";
  const modeLabel = (m: string) => (m === "rpe" ? "مجهود محسوس" : "نبض القلب");

  // Generation is one-at-a-time: a run fills a SINGLE member (plan.generating_member_id).
  // Scope all loading UI to that member so a different member's empty/failed day
  // never shows a spinner — it falls through to the "failed — regenerate" box.
  // No id stamped (initial plan / older data) → fall back to the global flag.
  const memberIsGenerating =
    generating &&
    (plan.generating_member_id == null ||
      activeMember?.member_id === plan.generating_member_id);

  // Maid (translated) view: translation runs strictly one member at a time, in
  // plan.members order (mom first). Infer the member being translated NOW = the
  // first member, in order, still missing a translation on a mealed day. Members
  // before it are done; members after it are queued. So the maid sees mom resolve
  // fully, then member 2, then member 3 — and a queued member shows a calm
  // "waiting" state instead of a spinner that reads as random/simultaneous.
  const dayNeedsTranslation = (day?: MemberPlan["days"][number]) =>
    !!day && day.meals.length > 0 && !isDayTranslated(day);
  const isMemberTranslated = (m: MemberPlan) =>
    m.days.every((d) => d.meals.length === 0 || isDayTranslated(d));
  const currentTranslatingIndex = translated
    ? plan.members.findIndex((m) => !isMemberTranslated(m))
    : -1;
  const memberTranslationStatus = (
    m: MemberPlan,
  ): "done" | "translating" | "queued" => {
    if (!translated || currentTranslatingIndex === -1) return "done";
    const idx = plan.members.findIndex((x) => x.member_id === m.member_id);
    if (idx < currentTranslatingIndex) return "done";
    if (idx === currentTranslatingIndex) return "translating";
    return "queued";
  };
  const activeMemberTranslation = activeMember
    ? memberTranslationStatus(activeMember)
    : "done";

  // Day generation runs today-first, one at a time (mirrors the engine). Compute
  // the same order so the UI shows ONE day "preparing" while the rest wait —
  // instead of every tab spinning at once (which reads as random).
  const currentPreparingIndex = useMemo(() => {
    if (!memberIsGenerating || !activeMember) return -1;
    const start = dayIndexFromWeekStart(plan.week_start_date);
    const today = start >= 0 && start <= 6 ? start : 0;
    const order = Array.from({ length: 7 }, (_, k) => (today + k) % 7);
    for (const di of order) {
      const day = activeMember.days.find((d) => d.day_index === di);
      if (!day || day.meals.length === 0) return di;
    }
    return -1;
  }, [memberIsGenerating, activeMember, plan.week_start_date]);

  // Real generation progress for the active member: days with meals vs total
  // expected. Days are generated atomically (a whole day lands at once), so
  // day-granularity is the truthful unit — drives the progress strip + current
  // day name so the wait reads as active, not stalled.
  const genProgress = useMemo(() => {
    const total = plan.days_total ?? activeMember?.days.length ?? 7;
    const ready = activeMember
      ? activeMember.days.filter((d) => d.meals.length > 0).length
      : 0;
    const pct = total > 0 ? Math.min(100, Math.round((100 * ready) / total)) : 0;
    const dayName =
      currentPreparingIndex >= 0
        ? translated
          ? getLocalizedDayNameFromWeekStart(
              plan.week_start_date,
              currentPreparingIndex,
              locale ?? "ar",
            )
          : dayNameFromWeekStart(plan.week_start_date, currentPreparingIndex)
        : "";
    return { ready, total, pct, dayName };
  }, [
    activeMember,
    plan.days_total,
    plan.week_start_date,
    currentPreparingIndex,
    translated,
    locale,
  ]);

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
          {!translated && !hideExport && (
            <DownloadPDFButton
              memberPlan={activeMember}
              planMetadata={{ week_start_date: plan.week_start_date }}
              memberNames={memberNames}
            />
          )}
          {!readOnly && (
            <RegenerateButton
              memberId={activeMember.member_id}
              memberName={activeMember.member_name_ar}
              hasSharedMeals={activeMemberHasShared}
              canPickDomain={activeCanPickDomain}
              budgetChanged={activeBudgetChanged}
              locale={locale}
            />
          )}
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
            const transStatus = memberTranslationStatus(m);
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
                {isMom && !translated && (
                  <span className="text-brand-pink me-1">{t.you} ·</span>
                )}
                {memberLabel(m)}
                {translated && transStatus === "translating" && (
                  <Loader2
                    className="inline-block ms-1.5 size-3 animate-spin motion-reduce:animate-none align-[-1px] text-brand-purple-900"
                    aria-hidden="true"
                  />
                )}
                {translated && transStatus === "queued" && (
                  <Clock
                    className="inline-block ms-1.5 size-3 align-[-1px] opacity-40"
                    aria-hidden="true"
                  />
                )}
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

      {/* Meals / Exercise toggle — when a workout exists or one is withheld (Arabic view). */}
      {hasExercise && (
        <div
          className="flex w-fit rounded-full bg-white border border-brand-ink/10 p-1"
          role="group"
          aria-label="نوع الخطة"
        >
          {(
            [
              ["meals", "الأكل"],
              ["exercise", "التمارين"],
            ] as const
          ).map(([key, label]) => {
            const active = (key === "exercise") === exerciseView;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setView(key)}
                className={`min-h-11 px-5 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${
                  active
                    ? "bg-brand-purple-900 text-white"
                    : "text-brand-ink-muted hover:text-brand-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Member summary tiles — macros for meals, training summary for exercise.
          A withheld member has no workout → skip the tiles (the note shows below). */}
      {!exerciseView ? (
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
      ) : activeWorkout ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
            <p className="text-brand-ink-muted text-xs">أيام التمرين</p>
            <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
              {workoutSessionDays}
              <span className="text-brand-ink-muted text-xs ms-1">في الأسبوع</span>
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
            <p className="text-brand-ink-muted text-xs">أقصى شدّة</p>
            <p className="font-bold text-brand-ink text-sm mt-1.5 leading-snug">
              {activeWorkout ? ceilingLabel(activeWorkout.budget.intensity_ceiling) : "—"}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
            <p className="text-brand-ink-muted text-xs">مقياس الشدّة</p>
            <p className="font-bold text-brand-ink text-sm mt-1.5 leading-snug">
              {activeWorkout ? modeLabel(activeWorkout.budget.intensity_mode) : "—"}
            </p>
          </div>
        </div>
      ) : null}

      {/* Generation progress — real "day N of M" while the plan streams in.
          Hidden once the viewed member is complete (ready === total) so a full
          bar never sits there spinning. */}
      {!exerciseView && memberIsGenerating && !preparingStalled && genProgress.ready < genProgress.total && (
        <div className="bg-white rounded-2xl border border-brand-ink/5 px-4 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-brand-ink font-bold text-sm leading-relaxed">
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none text-brand-purple-900 flex-shrink-0"
                aria-hidden="true"
              />
              <span>{t.preparing_title}</span>
              {genProgress.dayName && (
                <span className="text-brand-purple-900">· {genProgress.dayName}</span>
              )}
            </p>
            <span className="flex-shrink-0 text-brand-ink-muted text-xs font-bold tabular-nums">
              {genProgress.ready}/{genProgress.total}
            </span>
          </div>
          <div
            className="h-1.5 bg-brand-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-busy="true"
            aria-label={t.preparing_title}
            aria-valuenow={genProgress.ready}
            aria-valuemin={0}
            aria-valuemax={genProgress.total}
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(6, genProgress.pct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Day tabs (in the exercise view, only for a member who has a workout) */}
      {(!exerciseView || !!activeWorkout) && (
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const day = activeMember.days.find((d) => d.day_index === i);
          const label = translated
            ? getLocalizedDayNameFromWeekStart(plan.week_start_date, i, locale)
            : day?.day_name_ar || dayNameFromWeekStart(plan.week_start_date, i) || `${i + 1}`;
          const isActive = i === activeDayIndex;
          const pending =
            (memberIsGenerating && i === currentPreparingIndex) ||
            (translated &&
              activeMemberTranslation === "translating" &&
              dayNeedsTranslation(day));
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
      )}

      {/* Day total pill */}
      {!exerciseView && activeDay && (
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

      {/* Exercise day (session or rest) for the active member */}
      {exerciseView && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`ex-${activeMemberId}-${activeDayIndex}`}
            initial={{ opacity: 0, y: prefersReduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReduced ? 0 : -8 }}
            transition={{ duration: prefersReduced ? 0 : 0.2 }}
            className="space-y-3"
          >
            {activeWorkoutDay ? (
              <WorkoutDayCard entry={activeWorkoutDay.entry} />
            ) : activeIsWithheld ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 py-8 px-4 text-center">
                <HeartPulse className="size-6 text-brand-purple-900" aria-hidden="true" />
                <p className="text-brand-ink text-sm font-medium leading-relaxed max-w-sm">
                  صحتكِ أولاً. بمجرد موافقة طبيبكِ، نضيفها لكِ تلقائياً.
                </p>
              </div>
            ) : (
              <div className="text-center py-10 text-brand-ink-muted text-sm leading-relaxed">
                ما في خطة تمارين
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Meal list */}
      {!exerciseView && (
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeMemberId}-${activeDayIndex}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {translated && activeMemberTranslation === "queued" ? (
            // This member's turn hasn't come yet — translation runs one member at
            // a time, in order. Show a calm waiting state, not a spinner (which
            // read as "loading randomly").
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Clock className="size-6 text-brand-purple-900 opacity-60" aria-hidden="true" />
              <p className="text-brand-ink-muted text-sm">{t.translation_queued}</p>
            </div>
          ) : translated && activeMemberTranslation === "translating" && dayNeedsTranslation(activeDay) ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2
                className="size-6 animate-spin motion-reduce:animate-none text-brand-purple-900"
                aria-hidden="true"
              />
              <p className="text-brand-ink-muted text-sm">{t.translating}</p>
            </div>
          ) : activeDay && activeDay.meals.length > 0 ? (
            orderedMeals.map((meal, i) => (
              <MealCard
                key={i}
                meal={meal}
                memberNames={memberNames}
                locale={locale}
                currentMemberId={activeMember.member_id}
              />
            ))
          ) : memberIsGenerating &&
            !preparingStalled &&
            activeDayIndex === currentPreparingIndex ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2
                className="size-6 animate-spin motion-reduce:animate-none text-brand-purple-900"
                aria-hidden="true"
              />
              <p className="text-brand-ink-muted text-sm">
                {t.preparing_steps[stepTick % t.preparing_steps.length] ??
                  t.generating}
              </p>
            </div>
          ) : generating && !preparingStalled ? (
            // A run completes EVERY incomplete beneficiary, not just
            // generating_member_id — so while the plan is still generating, any
            // member's unfilled day is genuinely queued, not failed. Only fall
            // through to the failed box once generation stops or stalls.
            <div className="text-center py-10 text-brand-ink-muted text-sm leading-relaxed">
              {t.day_queued}
            </div>
          ) : activeDay ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-brand-pink bg-brand-pink/5 py-8 px-4 text-center">
              <AlertTriangle className="size-6 text-brand-pink" aria-hidden="true" />
              <p className="text-brand-ink font-bold text-sm leading-relaxed">
                {t.day_failed}
              </p>
              {!readOnly && (
                <RegenerateButton
                  memberId={activeMember.member_id}
                  memberName={activeMember.member_name_ar}
                  hasSharedMeals={activeMemberHasShared}
                  canPickDomain={activeCanPickDomain}
                  budgetChanged={activeBudgetChanged}
                  locale={locale}
                />
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-brand-ink-muted text-sm">
              {t.no_meals}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      )}
    </div>
  );
}
