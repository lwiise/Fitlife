"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Clock, UserPlus, History, ChefHat, AlertTriangle, Dumbbell, Lock } from "lucide-react";
import type { MealPlan, MemberPlan, LocaleCode } from "@fitlife/plan-engine";
import { MealCard } from "./MealCard";
import { SaraChangesCard } from "./SaraChangesCard";
import {
  setMealCheckin as setMealCheckinAction,
  setMealVerdict as setMealVerdictAction,
} from "@/lib/engagement/actions";
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
import { genderPick } from "@/lib/copy/gender";

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
  planId,
  generating = false,
  updatedAt,
  preselectedMember,
  readOnly = false,
  hideExport = false,
  housekeeperLocale,
  locale,
  showWorkoutOptIn = false,
  checkins,
  verdicts,
  journeyMembers,
  ownerSex,
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
  // No workout plan exists yet → offer the add-exercise-plan entry in the
  // action bar (main /plan page only; read-only views never pass it).
  showWorkoutOptIn?: boolean;
  // Inline per-meal tracking (main /plan page only): current marks for this
  // plan. Presence of the prop enables the controls; read-only/translated
  // views never pass it. member_id: "mom" | family_members.id per person, or
  // "household"/null for legacy whole-house rows (pre-00019) — those act as a
  // fallback for every member of that meal.
  checkins?: Array<{
    day_index: number;
    slot: string;
    status: string;
    reason: string | null;
    member_id?: string | null;
  }>;
  // Per-dish verdicts (main /plan page only, same scope as checkins). member_id
  // is whose verdict it is — verdicts are personal, so there is NO whole-house
  // fallback (unlike checkins). Feeds golden dishes / vetoes → «سارة عدّلت خطتك».
  verdicts?: Array<{
    day_index: number;
    slot: string;
    member_id?: string | null;
    verdict: string;
  }>;
  // «رحلتك الخاصة» entries (main /plan page only): the weigh-in journeys this
  // household may open — "mom" plus eligible adult family_members ids (name
  // null for the mom). The entry renders on the ACTIVE member's tab only;
  // read-only/translated views never pass it. `sex` genders the entry copy.
  journeyMembers?: Array<{ id: string; name: string | null; sex?: string | null }>;
  // The account owner's sex (profiles.sex) → owner-directed Arabic copy on this
  // page (the «أنتِ/أنتَ» tab marker). Absent on read-only/translated views.
  ownerSex?: string | null;
}) {
  const router = useRouter();
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

  // Inline per-meal tracking (see the checkins prop). Optimistic map keyed
  // day|slot|member — PER PERSON, so a shared meal carries a separate status
  // for each participant. Legacy whole-house rows (member_id null/"household")
  // sit under the "household" key and act as a fallback for every member of
  // that meal. The 48h window is enforced server-side too — the client gate
  // just hides controls on future days so adherence can't be pre-marked.
  const [checkinMap, setCheckinMap] = useState<
    Map<string, { status: "cooked" | "swapped" | "skipped"; reason: string | null }>
  >(
    () =>
      new Map(
        (checkins ?? [])
          .filter(
            (c): c is typeof c & { status: "cooked" | "swapped" | "skipped" } =>
              c.status === "cooked" || c.status === "swapped" || c.status === "skipped",
          )
          .map((c) => [
            `${c.day_index}|${c.slot}|${c.member_id ?? "household"}`,
            { status: c.status, reason: c.reason },
          ]),
      ),
  );
  // Per-dish verdicts, keyed day|slot|member. Personal by design → no
  // whole-house fallback (a verdict is never attested for someone else).
  const [verdictMap, setVerdictMap] = useState<
    Map<string, "loved" | "fine" | "not_again">
  >(
    () =>
      new Map(
        (verdicts ?? [])
          .filter(
            (v): v is typeof v & { verdict: "loved" | "fine" | "not_again" } =>
              v.verdict === "loved" ||
              v.verdict === "fine" ||
              v.verdict === "not_again",
          )
          .map((v) => [
            `${v.day_index}|${v.slot}|${v.member_id ?? "mom"}`,
            v.verdict,
          ]),
      ),
  );
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const checkinTodayIdx = dayIndexFromWeekStart(plan.week_start_date);
  const canCheckinActiveDay =
    checkins !== undefined &&
    !readOnly &&
    !translated &&
    activeDayIndex <= checkinTodayIdx &&
    activeDayIndex >= checkinTodayIdx - 2;

  /** A member's effective mark: their own row, else the whole-house fallback. */
  function checkinFor(dayIndex: number, slot: string, memberId: string) {
    return (
      checkinMap.get(`${dayIndex}|${slot}|${memberId}`) ??
      checkinMap.get(`${dayIndex}|${slot}|household`) ??
      null
    );
  }

  /** A member's own verdict for a dish (no fallback — verdicts are personal). */
  function verdictFor(dayIndex: number, slot: string, memberId: string) {
    return verdictMap.get(`${dayIndex}|${slot}|${memberId}`) ?? null;
  }

  function handleVerdict(
    memberId: string,
    slot: (typeof plan.members)[number]["days"][number]["meals"][number]["slot"],
    recipeNameAr: string,
    verdict: "loved" | "fine" | "not_again" | null,
  ) {
    const key = `${activeDayIndex}|${slot}|${memberId}`;
    const prev = verdictMap.get(key) ?? null;
    const next = new Map(verdictMap);
    if (verdict === null) next.delete(key);
    else next.set(key, verdict);
    setVerdictMap(next);
    setCheckinError(null);
    void setMealVerdictAction({
      meal_plan_id: planId,
      day_index: activeDayIndex,
      slot,
      member_id: memberId,
      recipe_name_ar: recipeNameAr,
      verdict,
    }).then((result) => {
      if (!result.ok) {
        setVerdictMap((cur) => {
          const reverted = new Map(cur);
          if (prev) reverted.set(key, prev);
          else reverted.delete(key);
          return reverted;
        });
        setCheckinError(result.error);
      }
    });
  }

  function handleCheckin(
    memberId: string,
    slot: (typeof plan.members)[number]["days"][number]["meals"][number]["slot"],
    status: "cooked" | "swapped" | "skipped" | null,
    reason: string | null,
  ) {
    const key = `${activeDayIndex}|${slot}|${memberId}`;
    const householdKey = `${activeDayIndex}|${slot}|household`;
    const prev = checkinMap.get(key) ?? null;
    const prevHousehold = checkinMap.get(householdKey) ?? null;
    const next = new Map(checkinMap);
    if (status === null) {
      // Mirror the server: clearing removes the member's own mark; un-tapping
      // a chip lit only by the whole-house fallback retracts that row instead.
      if (next.has(key)) next.delete(key);
      else next.delete(householdKey);
    } else {
      // Setting never touches the whole-house row — it stays as the fallback
      // for the other members of this meal.
      next.set(key, { status, reason });
    }
    setCheckinMap(next);
    setCheckinError(null);
    void setMealCheckinAction({
      meal_plan_id: planId,
      day_index: activeDayIndex,
      slot,
      member_id: memberId,
      status,
      reason: reason as never,
    }).then((result) => {
      if (!result.ok) {
        setCheckinMap((cur) => {
          const reverted = new Map(cur);
          if (prev) reverted.set(key, prev);
          else reverted.delete(key);
          if (prevHousehold) reverted.set(householdKey, prevHousehold);
          return reverted;
        });
        setCheckinError(result.error);
      }
    });
  }

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
          {!readOnly && !translated && showWorkoutOptIn && (
            <Link
              href="/onboarding/workout"
              className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              <Dumbbell className="size-4" aria-hidden="true" />
              {genderPick(ownerSex)("أضيفي خطة التمارين", "أضِف خطة التمارين")}
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
              locale={locale}
              ownerSex={ownerSex}
            />
          )}
        </div>
      </div>

      {/* «سارة عدّلت خطتك» — the engagement-loop payoff: what Sara changed this
          week and why, citing the family's real logged marks. Plan-wide (above
          the member tabs). The minimum-signal guard already ran in the engine,
          so a present week_changes is safe to show. Hidden on the housekeeper's
          translated view — it is the mom's فصحى adaptation narrative. */}
      {!translated && plan.week_changes && plan.week_changes.length > 0 && (
        <SaraChangesCard changes={plan.week_changes} />
      )}

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
                  <span className="text-brand-pink me-1">
                    {genderPick(ownerSex)("أنتِ", "أنتَ")} ·
                  </span>
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

      {/* Children are planned by PORTIONS (healthy-plate servings), not a calorie
          target — so the figures above are an APPROXIMATE weekly average and each
          day naturally varies. Say so, so the numbers don't read as a fixed daily
          goal every day misses. Interactive Arabic view only (the housekeeper view
          just shows the averaged number). */}
      {!translated && activeMember.is_child && (
        <p className="text-brand-ink-muted text-xs leading-relaxed -mt-2">
          خطة {activeMember.member_name_ar} بالحصص المناسبة للعمر — الأرقام أعلاه
          متوسّط تقريبي للأسبوع، ويختلف إجمالي كل يوم حسب أطباق اليوم.
        </p>
      )}

      {/* «رحلتك الخاصة» — the private weigh-in entry for the viewed member
          (moved here from the dashboard). Renders only for eligible adults on
          the interactive plan page; the destination page carries the privacy
          contract, so the entry itself reveals nothing. */}
      {(() => {
        const journeyEntry =
          journeyMembers?.find((j) => j.id === activeMemberId) ?? null;
        if (!journeyEntry || readOnly || translated) return null;
        return (
          <Link
            href={
              journeyEntry.id === "mom"
                ? "/journey"
                : `/journey?member=${journeyEntry.id}`
            }
            className="flex items-center justify-between gap-3 bg-brand-lavender/20 hover:bg-brand-lavender/30 rounded-2xl px-4 py-3.5 min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            <span className="flex items-center gap-2.5 text-sm font-bold text-brand-purple-900">
              <Lock className="size-4 shrink-0" aria-hidden="true" />
              {journeyEntry.name
                ? `رحلة ${journeyEntry.name} الخاصة`
                : "رحلتك الخاصة"}
            </span>
            <span className="text-xs text-brand-purple-900/70">
              الوزن والمتابعة على انفراد
            </span>
          </Link>
        );
      })()}

      {/* Generation progress — real "day N of M" while the plan streams in.
          Hidden once the viewed member is complete (ready === total) so a full
          bar never sits there spinning. */}
      {memberIsGenerating && !preparingStalled && genProgress.ready < genProgress.total && (
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

      {/* Day tabs */}
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
            <>
              {checkinError && (
                <p role="alert" className="text-sm font-bold text-red-700">
                  {checkinError}
                </p>
              )}
              {orderedMeals.map((meal, i) => (
                <MealCard
                  key={i}
                  meal={meal}
                  memberNames={memberNames}
                  locale={locale}
                  currentMemberId={activeMember.member_id}
                  checkin={checkinFor(
                    activeDayIndex,
                    meal.slot,
                    activeMember.member_id,
                  )}
                  sharedCheckins={
                    meal.shared_recipe && meal.per_member_portions?.length
                      ? Object.fromEntries(
                          meal.per_member_portions.map((p) => [
                            p.member_id,
                            checkinFor(activeDayIndex, meal.slot, p.member_id),
                          ]),
                        )
                      : undefined
                  }
                  onCheckin={
                    canCheckinActiveDay
                      ? (memberId, status, reason) =>
                          handleCheckin(memberId, meal.slot, status, reason)
                      : undefined
                  }
                  verdict={verdictFor(
                    activeDayIndex,
                    meal.slot,
                    activeMember.member_id,
                  )}
                  onVerdict={
                    canCheckinActiveDay
                      ? (verdict) =>
                          handleVerdict(
                            activeMember.member_id,
                            meal.slot,
                            meal.recipe_name_ar,
                            verdict,
                          )
                      : undefined
                  }
                />
              ))}
            </>
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
                  locale={locale}
                  ownerSex={ownerSex}
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
    </div>
  );
}
