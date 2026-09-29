"use client";

import { Fragment, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  Flame,
  ShieldCheck,
  TrendingUp,
  Moon,
  Check,
  UserPlus,
  Dumbbell,
  History,
} from "lucide-react";
import type { WorkoutPlan, MemberWorkout, WorkoutSession } from "@fitlife/plan-engine";
import type { WorkoutCheckinStatus, WorkoutIntensity } from "@/lib/engagement/types";
import { setWorkoutCheckin as setWorkoutCheckinAction } from "@/lib/engagement/actions";
import { ExerciseLottie } from "./ExerciseLottie";
import { formatWeekRange, riyadhTodayISO } from "@/lib/plans/dayMapping";
import { stripDayLabel, workoutStripDays } from "@/lib/plans/weekStrip";
import { genderPick } from "@/lib/copy/gender";
import { arDec, arDigits, arNum } from "@/lib/copy/numbers";
import { workoutSessionPastDateISO } from "@/lib/engagement/seasonMath";
import { countAr, type ArabicCountForms } from "@/lib/copy/plural";
import { Avatar } from "@/components/ui/avatar";
import {
  PlanBar,
  PlanBarEnd,
  PlanBarIdentity,
  PlanBarMore,
  PlanBarRow,
} from "./bar/PlanBar";
import { WeekStrip, type WeekStripDay } from "./bar/WeekStrip";
import { MemberSheet, type MemberSheetMember } from "./bar/MemberSheet";
import { MoreSheet } from "./bar/MoreSheet";
import { PLAN_MENU_ICON_CLASS, PLAN_MENU_ITEM_CLASS } from "./bar/menuItem";

// Workout day_index is weekday-anchored: 0 = الأحد … 6 = السبت (matches JS
// Date#getDay, where 0 = Sunday) — which is why the plan bar's strip comes
// from workoutStripDays (the current week's dates), not the plan's week start.

// «٣ حصص أسبوعياً» — the member sheet's status line for a trainee.
const SESSION_FORMS: ArabicCountForms = {
  one: "حصة واحدة",
  two: "حصتان",
  few: "حصص",
  many: "حصة",
  other: "حصة",
};

const WORKOUT_STATUS_CHIPS: { value: WorkoutCheckinStatus; label: string }[] = [
  { value: "done", label: "أنجزتها" },
  { value: "moved", label: "بدّلتها" },
  { value: "skipped", label: "تجاوزتها" },
];
const WORKOUT_HEADER_LABEL: Record<WorkoutCheckinStatus, string> = {
  done: "أنجزت",
  moved: "بدّلت",
  skipped: "تجاوزت",
};
// How the done session felt (00022) — feeds next week's program.
const INTENSITY_CHIPS: { value: WorkoutIntensity; label: string }[] = [
  { value: "easy", label: "خفيفة" },
  { value: "right", label: "مناسبة" },
  { value: "hard", label: "شاقة" },
];

interface WorkoutMark {
  status: WorkoutCheckinStatus;
  intensity: WorkoutIntensity | null;
}

// One implementation for the initial useState seed AND the props-resync, so
// the optimistic map can never drift from how server rows are read.
function seedWorkoutMap(
  checkins:
    | Array<{ day_index: number; member_id: string; status: string; intensity?: string | null }>
    | undefined,
) {
  return new Map<string, WorkoutMark>(
    (checkins ?? [])
      .filter(
        (c): c is typeof c & { status: WorkoutCheckinStatus } =>
          c.status === "done" || c.status === "moved" || c.status === "skipped",
      )
      .map((c) => [
        `${c.member_id}|${c.day_index}`,
        {
          status: c.status,
          intensity:
            c.intensity === "easy" || c.intensity === "right" || c.intensity === "hard"
              ? c.intensity
              : null,
        },
      ]),
  );
}

function formatRest(restSeconds: number): string {
  return restSeconds >= 60
    ? `${arDec(Math.round(restSeconds / 30) / 2)} د`
    : `${arNum(restSeconds)} ث`;
}

// Today's weekday (0=Sunday) in RIYADH time — the clock the server marks
// against (setWorkoutCheckin), the strip dates its cells by and the meal view
// uses. The device clock disagreed with all three near midnight outside UTC+3
// (a UAE phone after 00:00 offered a session the server then refused), and
// with the server's own render during hydration.
function riyadhWeekday(): number {
  return new Date(`${riyadhTodayISO()}T00:00:00Z`).getUTCDay();
}

// Today if it's a training day, else the next training day (wrapping) — so the
// viewer opens on actionable content, mirroring the meal viewer's today-first
// default.
function defaultDayIndex(member: MemberWorkout | undefined): number {
  if (!member) return 0;
  const trainingDays = new Set(member.weekly_sessions.map((s) => s.day_index));
  const today = riyadhWeekday();
  for (let k = 0; k < 7; k++) {
    const di = (today + k) % 7;
    if (trainingDays.has(di)) return di;
  }
  return member.weekly_sessions[0]?.day_index ?? 0;
}

function SessionDetail({
  session,
  homeMode,
}: {
  session: WorkoutSession;
  homeMode: boolean;
}) {
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets, 0);
  // One form animation open at a time; remounting on member/day switch (the
  // parent keys this subtree) resets it.
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <>
      <div className="rounded-2xl border border-brand-line bg-brand-card px-4 py-3.5">
        <p className="text-meta font-bold text-brand-ink-muted mb-1.5">الإحماء</p>
        <ul className="text-sm text-brand-ink leading-relaxed list-disc ps-5 space-y-0.5">
          {session.warmup_ar.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-brand-line">
          <p className="font-bold text-brand-ink text-sm">{session.session_name_ar}</p>
          <p className="text-brand-ink-muted text-meta tabular-nums">
            {arNum(session.exercises.length)} تمارين · {arNum(totalSets)} مجموعة
          </p>
        </div>
        <div className="overflow-x-auto no-scrollbar px-4 pb-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-brand-ink-muted text-meta border-b border-brand-line">
                <th className="text-start font-bold py-2 pe-3">التمرين</th>
                <th className="text-center font-bold py-2 px-2">المجموعات</th>
                <th className="text-center font-bold py-2 px-2">التكرارات</th>
                <th className="text-center font-bold py-2 ps-2">الراحة</th>
              </tr>
            </thead>
            <tbody>
              {session.exercises.map((ex, i) => {
                const displayName = homeMode && ex.home_variant_ar ? ex.home_variant_ar : ex.name_ar;
                // Home mode shows the home substitution's animation when the
                // catalog knows it; older plans without ids simply don't expand.
                const animId =
                  homeMode && ex.home_variant_id ? ex.home_variant_id : (ex.exercise_id ?? null);
                const isOpen = expanded === i;
                return (
                  <Fragment key={i}>
                    <tr className="border-b border-brand-line last:border-0 align-top">
                      <td className="py-1.5 pe-3">
                        {animId ? (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : i)}
                            aria-expanded={isOpen}
                            className="flex items-start gap-1.5 w-full min-h-11 py-1 text-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                          >
                            <ChevronDown
                              className={`size-4 flex-shrink-0 mt-0.5 text-brand-purple-900 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0">
                              <span className="font-bold text-brand-ink block">{displayName}</span>
                              <span className="text-brand-ink-muted text-meta block">
                                {ex.target_muscles_ar}
                                {ex.name_en && !homeMode ? ` · ${ex.name_en}` : ""}
                              </span>
                              {ex.rir && (
                                <span className="text-brand-purple-900 text-meta block mt-0.5">{ex.rir}</span>
                              )}
                            </span>
                          </button>
                        ) : (
                          <span className="block py-1">
                            <span className="font-bold text-brand-ink block">{displayName}</span>
                            <span className="text-brand-ink-muted text-meta block">
                              {ex.target_muscles_ar}
                              {ex.name_en && !homeMode ? ` · ${ex.name_en}` : ""}
                            </span>
                            {ex.rir && (
                              <span className="text-brand-purple-900 text-meta block mt-0.5">{ex.rir}</span>
                            )}
                            {ex.notes_ar && (
                              <span className="text-brand-ink-muted text-meta block mt-0.5">{ex.notes_ar}</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums font-bold text-brand-ink">
                        {arNum(ex.sets)}
                      </td>
                      {/* A stored range («8-12») in the table's own digits, in
                          the table's own RTL order — «٨-١٢» reads right to
                          left like the rest of the row. */}
                      <td className="py-2.5 px-2 text-center tabular-nums text-brand-ink">
                        {arDigits(ex.reps)}
                      </td>
                      <td className="py-2.5 ps-2 text-center tabular-nums text-brand-ink-muted">
                        {formatRest(ex.rest_seconds)}
                      </td>
                    </tr>
                    {animId && isOpen && (
                      <tr className="border-b border-brand-line last:border-0">
                        <td colSpan={4} className="pb-4 pt-1">
                          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-brand-lavender/15 p-3">
                            <div className="w-full max-w-56 sm:w-56 flex-shrink-0">
                              <ExerciseLottie exerciseId={animId} label={displayName} />
                            </div>
                            <div className="flex-1 min-w-48">
                              <p className="text-brand-purple-900 font-bold text-meta mb-1.5">الأداء الصحيح</p>
                              <p className="text-brand-ink text-sm leading-relaxed">
                                {ex.notes_ar || ex.target_muscles_ar}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {session.cooldown_ar.length > 0 && (
        <div className="rounded-2xl border border-brand-line bg-brand-card px-4 py-3.5">
          <p className="text-meta font-bold text-brand-ink-muted mb-1.5">التهدئة</p>
          <ul className="text-sm text-brand-ink leading-relaxed list-disc ps-5 space-y-0.5">
            {session.cooldown_ar.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Weekly workout program viewer, mirroring the meal PlanViewer's structure:
 * the plan bar (whose program + the week's seven days) → summary tiles → one
 * day at a time (training session or rest state), with a home/gym variant
 * toggle when the member's plan includes home variants.
 */
export function WorkoutViewer({
  plan,
  planId,
  checkins,
  ownerSex,
  notice,
  planTypeToggle,
  journeyMembers,
  roster,
  addMemberHref = "/family",
  addTraineeHref = "/onboarding/workout",
}: {
  plan: WorkoutPlan;
  /** workout_plans.id — needed to write session marks. */
  planId?: string;
  /** Session marks for this plan (interactive page only). member_id: "mom" |
   * family_members.id; day_index weekday-anchored. Presence enables marking. */
  checkins?: Array<{
    day_index: number;
    member_id: string;
    status: string;
    intensity?: string | null;
  }>;
  /** Account owner's sex → the «أنتِ/أنتَ» mom-tab marker. */
  ownerSex?: string | null;
  /** The page's one notice (or its onboarding banner), rendered under the plan
   * bar — the bar is the top of the page on phones, so nothing sits above it. */
  notice?: ReactNode;
  /** The meal/workout plan-type switch, full-width under the bar (and notice)
   * — the same slot the meal PlanViewer gives it, so it never moves when
   * switching views. */
  planTypeToggle?: ReactNode;
  /** «رحلتك الخاصة» entries, member-keyed. The link follows the active member
   * tab and shows only for eligible members (same rule as the meal view). */
  journeyMembers?: Array<{ id: string; name: string | null; sex?: string | null }>;
  /** The member tabs to show — the SAME set/order as the meal view, so switching
   * to Exercise keeps the exact tab row (owner directive 07/2026). Each carries
   * `eligible` (adults-only workout rule): an eligible member without a program
   * gets an add-plan CTA, an ineligible one (child) an adults-only note. Absent
   * → fall back to the workout plan's own members (every tab has content). */
  roster?: Array<{ member_id: string; member_name_ar: string; eligible: boolean }>;
  /** The member sheet's «إضافة فرد» target — /family, exactly like the meal
   * view (adding a household member, not the workout opt-in). */
  addMemberHref?: string;
  /** Where «إضافة فرد للتمارين» leads. The page resolves this to the opt-in
   * questionnaire when an eligible adult can be added, else to /family to add
   * one first. */
  addTraineeHref?: string;
}) {
  // The Exercise view mirrors the meal view's member tabs (owner directive
  // 07/2026): the SAME people appear as tabs. A member with a program shows it;
  // one without shows an add-plan CTA (eligible adults) or an adults-only note
  // (children). `roster` is the meal plan's member set/order so the tabs match
  // the meal view exactly; when it is absent (nothing to mirror) we fall back to
  // the workout plan's own members, so every tab still resolves to content.
  const tabs = useMemo(
    () =>
      roster && roster.length > 0
        ? roster
        : plan.members.map((m) => ({
            member_id: m.member_id,
            member_name_ar: m.member_name_ar,
            eligible: true,
          })),
    [roster, plan.members],
  );
  const [activeMemberId, setActiveMemberId] = useState(tabs[0]?.member_id ?? "");
  const activeTab = tabs.find((t) => t.member_id === activeMemberId) ?? tabs[0];
  // The active member's program, if they have one. Null → the tab renders the
  // add-plan CTA / adults-only note instead of a week of sessions.
  const activeWorkout =
    plan.members.find((m) => m.member_id === activeMemberId) ?? null;
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() =>
    defaultDayIndex(plan.members[0]),
  );
  // Viewer-level so the choice survives switching days/members.
  const [homeMode, setHomeMode] = useState(false);

  // One sheet at a time: opening one replaces the other.
  const [openSheet, setOpenSheet] = useState<"member" | "more" | null>(null);
  // Spoken after a member switch when focus did NOT land back on the renamed
  // identity trigger — otherwise nothing says the page below changed.
  const [announcement, setAnnouncement] = useState("");
  // The bar's sheet triggers: each sheet's focus-return target (Safari never
  // focuses a tapped button).
  const identityRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const dayTopRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // Today in Riyadh, once per mount — the clock the server marks against
  // (setWorkoutCheckin) — so a midnight re-render cannot move «اليوم» or the
  // markable days under the user's finger. The strip dates each cell by the
  // same rule the mark is stamped by (workoutSessionPastDateISO).
  const [todayISO] = useState(riyadhTodayISO);
  const [stripBase] = useState(() => workoutStripDays("ar", todayISO));

  // Optimistic session marks, keyed member|day. Seeded from the checkins prop;
  // clearing removes the mark (a mis-tap must be reversible). The whole-current-
  // week window (48h floor) is enforced server-side — the client gate just hides
  // controls on future sessions.
  const [checkinMap, setCheckinMap] = useState(() => seedWorkoutMap(checkins));
  const [checkinError, setCheckinError] = useState<string | null>(null);

  // Marks in flight — while > 0 the optimistic map is the truth and the
  // props-resync below must hold off. Render-phase adjust (the React
  // "adjusting state when props change" pattern; the set-state-in-effect rule
  // forbids the effect version) so fresh server rows — an action's own
  // revalidation, a soft navigation back — re-seed the map instead of it
  // keeping its first-mount seed forever.
  const [pendingWrites, setPendingWrites] = useState(0);
  const [syncedCheckins, setSyncedCheckins] = useState(checkins);
  if (checkins !== syncedCheckins && pendingWrites === 0) {
    setSyncedCheckins(checkins);
    setCheckinMap(seedWorkoutMap(checkins));
  }

  function handleWorkoutCheckin(
    memberId: string,
    dayIndex: number,
    status: WorkoutCheckinStatus | null,
    intensity: WorkoutIntensity | null = null,
  ) {
    if (!planId) return;
    const key = `${memberId}|${dayIndex}`;
    const prev = checkinMap.get(key) ?? null;
    const next = new Map(checkinMap);
    if (status === null) next.delete(key);
    else next.set(key, { status, intensity: status === "done" ? intensity : null });
    setCheckinMap(next);
    setCheckinError(null);
    setPendingWrites((n) => n + 1);
    void setWorkoutCheckinAction({
      workout_plan_id: planId,
      day_index: dayIndex,
      member_id: memberId,
      status,
      intensity: status === "done" ? intensity : null,
    })
      .then((result) => {
        if (!result.ok) {
          setCheckinMap((cur) => {
            const reverted = new Map(cur);
            if (prev) reverted.set(key, prev);
            else reverted.delete(key);
            return reverted;
          });
          setCheckinError(result.error);
        }
      })
      .catch(() => {
        /* transport failure — the next props-resync restores server truth */
      })
      .finally(() => setPendingWrites((n) => n - 1));
  }

  // Always an object (zeros when the active member has no program) — it is read
  // only inside the program branch below, so the empty case never renders.
  const stats = useMemo(() => {
    const sessions = activeWorkout?.weekly_sessions ?? [];
    const totalMin = sessions.reduce((sum, s) => sum + s.duration_min, 0);
    const totalExercises = sessions.reduce((sum, s) => sum + s.exercises.length, 0);
    return {
      count: sessions.length,
      avgMin: sessions.length > 0 ? Math.round(totalMin / sessions.length) : 0,
      totalExercises,
    };
  }, [activeWorkout]);

  if (!activeTab) return null;

  const isSolo = tabs.length === 1;
  const activeSession = activeWorkout?.weekly_sessions.find(
    (s) => s.day_index === activeDayIndex,
  );
  const showHomeVariant = !!activeWorkout?.weekly_sessions.some((s) =>
    s.exercises.some((e) => e.home_variant_ar),
  );
  const activeSets = activeSession
    ? activeSession.exercises.reduce((sum, ex) => sum + ex.sets, 0)
    : 0;

  // This member's mark for the open day, and whether it's within the markable
  // window: the whole current week (Sunday-anchored), with the 48h floor for
  // the previous week's tail; a session later this week has no date to mark
  // yet. The server enforces the same rule — one helper, so the controls, the
  // strip's dates and the stored date cannot disagree.
  const activeMark =
    checkinMap.get(`${activeTab.member_id}|${activeDayIndex}`) ?? null;
  const activeStatus = activeMark?.status ?? null;
  const activeIntensity = activeMark?.intensity ?? null;
  const canMarkActive =
    checkins !== undefined &&
    !!planId &&
    !!activeWorkout &&
    workoutSessionPastDateISO(todayISO, activeDayIndex) !== null;

  const pick = genderPick(ownerSex);
  const activeRosterIndex = Math.max(
    0,
    tabs.findIndex((t) => t.member_id === activeTab.member_id),
  );
  const weekRange = formatWeekRange(plan.week_start_date);

  // Rest days are muted cells; their state is "empty" only so the strip can
  // speak «يوم راحة» after the date (stateLabels are keyed by state). A member
  // without a program gets no strip at all — seven cells that all say «rest»
  // would misdescribe someone who simply has no program yet.
  const trainingDays = new Set(activeWorkout?.weekly_sessions.map((s) => s.day_index));
  const stripDays: WeekStripDay[] = stripBase.map((d) =>
    trainingDays.has(d.index)
      ? { ...d, state: "ready" }
      : { ...d, state: "empty", muted: true },
  );
  const activeStripDay = stripBase.find((d) => d.index === activeDayIndex);

  function selectDay(index: number) {
    setActiveDayIndex(index);
    // Picking a day from the pinned strip while deep in a session: jump to the
    // new day's top instead of leaving the reader mid-way down another day.
    // Instant, not smooth (restrained motion); scroll-padding clears the bar.
    const top = dayTopRef.current;
    const bar = document.querySelector("[data-plan-bar]");
    if (top && bar && top.getBoundingClientRect().top < bar.getBoundingClientRect().bottom) {
      top.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }

  const memberRows: MemberSheetMember[] = tabs.map((t, i) => {
    const program = plan.members.find((m) => m.member_id === t.member_id);
    return {
      id: t.member_id,
      name: t.member_name_ar,
      prefix: t.member_id === "mom" ? `${pick("أنتِ", "أنتَ")} ·` : undefined,
      rosterIndex: i,
      status: {
        text: program
          ? `${countAr(program.weekly_sessions.length, SESSION_FORMS, arNum)} أسبوعياً`
          : t.eligible
            ? "لا يوجد برنامج"
            : "التمارين للبالغين فقط",
      },
    };
  });

  // The private «الوزن والمتابعة» journey link for the ACTIVE member (eligible
  // members only) — same rule as the meal view; it lives in the ••• sheet.
  const journeyEntry =
    journeyMembers?.find((j) => j.id === activeMemberId) ?? null;
  const journeyItems = journeyEntry
    ? [
        <Link
          key="journey"
          href={journeyEntry.id === "mom" ? "/journey" : `/journey?member=${journeyEntry.id}`}
          className={PLAN_MENU_ITEM_CLASS}
        >
          <TrendingUp className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
          الوزن والمتابعة
        </Link>,
      ]
    : [];

  // A solo program has no member sheet, so its «add a trainee» door — the only
  // way the switcher ever grows — moves here from the old header paragraph.
  const addTraineeRow = (
    <Link key="add-trainee" href={addTraineeHref} className={PLAN_MENU_ITEM_CLASS}>
      <Dumbbell className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
      إضافة فرد للتمارين
    </Link>
  );

  return (
    <div>
      <PlanBar>
        {/* The page's <h1>: the bar carries the page's identity on phones, so
            the heading lives in it — visually the identity + strip say it. */}
        <h1 className="sr-only">خطة التمارين، {weekRange}</h1>
        <PlanBarRow>
          <PlanBarIdentity
            avatar={
              <Avatar
                name={activeTab.member_name_ar}
                rosterIndex={activeRosterIndex}
                size="lg"
                className="ring-2 ring-brand-lavender"
              />
            }
            name={activeTab.member_name_ar}
            suffix={activeTab.member_id === "mom" ? pick("أنتِ", "أنتَ") : undefined}
            ref={identityRef}
            onOpen={isSolo ? undefined : () => setOpenSheet("member")}
            expanded={openSheet === "member"}
            openLabel={`خطة ${activeTab.member_name_ar}، تبديل الفرد`}
          />
          <PlanBarEnd>
            <PlanBarMore
              ref={moreRef}
              onClick={() => setOpenSheet("more")}
              expanded={openSheet === "more"}
            />
          </PlanBarEnd>
        </PlanBarRow>
        {activeWorkout && (
          <WeekStrip
            days={stripDays}
            selected={activeDayIndex}
            onSelect={selectDay}
            todayLabel="اليوم"
            label="أيام الأسبوع"
            stateLabels={{ empty: "يوم راحة" }}
            panelId={panelId}
          />
        )}
      </PlanBar>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {notice && <div className="mt-3">{notice}</div>}
      {planTypeToggle && <div className="mt-3">{planTypeToggle}</div>}

      <div className="mt-4 space-y-6">
      {/* A member with a program shows it; one without shows the add-plan CTA
          (eligible adults) or an adults-only note (children) — the Exercise view
          keeps the meal view's tabs while «if there are exercises show them, if
          not show add-an-exercise-plan». */}
      {activeWorkout ? (
        <>
          {plan.safety_disclaimer_ar && (
            <p className="flex items-start gap-2 rounded-xl bg-brand-yellow/15 border border-brand-yellow/40 px-4 py-3 text-brand-ink text-sm leading-relaxed">
              <ShieldCheck className="size-4.5 flex-shrink-0 mt-0.5 text-brand-ink" aria-hidden="true" />
              {plan.safety_disclaimer_ar}
            </p>
          )}

      {/* Member summary tiles */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-brand-card rounded-2xl p-4 border border-brand-line">
          <p className="text-brand-ink-muted text-meta">التقسيم</p>
          <p className="font-extrabold text-brand-ink text-sm mt-1 leading-snug">
            {activeWorkout.split_name_ar}
          </p>
        </div>
        <div className="bg-brand-card rounded-2xl p-4 border border-brand-line">
          <p className="text-brand-ink-muted text-meta">جلسات الأسبوع</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {arNum(stats.count)}
          </p>
        </div>
        <div className="bg-brand-card rounded-2xl p-4 border border-brand-line">
          <p className="text-brand-ink-muted text-meta">متوسط الجلسة</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {arNum(stats.avgMin)}
            <span className="text-brand-ink-muted text-meta ms-1">دقيقة</span>
          </p>
        </div>
        <div className="bg-brand-card rounded-2xl p-4 border border-brand-line">
          <p className="text-brand-ink-muted text-meta">تمارين الأسبوع</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {arNum(stats.totalExercises)}
          </p>
        </div>
      </div>

      {/* The strip's panel: the open day's summary, session and marking. */}
      <div
        id={panelId}
        role="tabpanel"
        aria-label={activeStripDay ? stripDayLabel(activeStripDay) : undefined}
        className="space-y-6"
      >
      {/* Session summary pill + home/gym toggle */}
      <div ref={dayTopRef} className="flex flex-wrap items-center justify-between gap-2">
        {activeSession ? (
          <div className="inline-flex flex-wrap items-center gap-2 bg-brand-card rounded-full border border-brand-line px-4 py-2">
            <span className="font-bold text-brand-ink text-sm">
              {activeSession.session_name_ar}
            </span>
            <span className="text-brand-ink-muted/40">·</span>
            <span className="text-brand-ink text-meta tabular-nums">
              نحو {arNum(activeSession.duration_min)} دقيقة
            </span>
            <span className="text-brand-ink-muted/40">·</span>
            <span className="text-brand-ink text-meta tabular-nums">
              {arNum(activeSession.exercises.length)} تمارين
            </span>
            <span className="text-brand-ink-muted/40">·</span>
            <span className="text-brand-ink text-meta tabular-nums">
              {arNum(activeSets)} مجموعة
            </span>
            {activeStatus && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-meta font-bold ${
                  activeStatus === "done"
                    ? "bg-brand-purple-900 text-white"
                    : "bg-brand-lavender/40 text-brand-purple-900"
                }`}
              >
                {activeStatus === "done" && (
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                )}
                {WORKOUT_HEADER_LABEL[activeStatus]}
              </span>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-brand-card rounded-full border border-brand-line px-4 py-2">
            <span className="text-brand-ink-muted text-meta">يوم راحة</span>
          </div>
        )}
        {showHomeVariant && (
          <button
            type="button"
            onClick={() => setHomeMode((v) => !v)}
            aria-pressed={homeMode}
            className={`min-h-11 rounded-full border px-4 text-meta font-bold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
              homeMode
                ? "border-brand-purple-900 bg-brand-purple-900/10 text-brand-purple-900"
                : "border-brand-ink/10 bg-brand-card text-brand-ink"
            }`}
          >
            {homeMode ? "نسخة المنزل" : "نسخة النادي"}
          </button>
        )}
      </div>

      {/* Single-day content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeWorkout.member_id}-${activeDayIndex}`}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="space-y-3"
        >
          {activeSession ? (
            <SessionDetail session={activeSession} homeMode={homeMode} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Moon className="size-6 text-brand-purple-900 opacity-60" aria-hidden="true" />
              <p className="text-brand-ink font-bold text-sm">يوم راحة واستشفاء</p>
              <p className="text-brand-ink-muted text-sm leading-relaxed max-w-xs">
                العضلات تنمو أثناء الراحة. مشي خفيف ونوم جيد يدعمان تقدّمك.
              </p>
            </div>
          )}

          {/* Session marking — a training day within the current week. Honest
              signal (done/moved/skipped); tapping again clears. Feeds «موسم
              بيتنا». Server re-derives the date and enforces the window. */}
          {activeSession && canMarkActive && (
            <div
              className="rounded-2xl border border-brand-line bg-brand-card px-4 py-3.5 space-y-2"
              aria-label="تتبّع الحصة"
            >
              <p className="text-meta font-bold text-brand-ink-muted">
                هل أنجزت حصة اليوم؟
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WORKOUT_STATUS_CHIPS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() =>
                      handleWorkoutCheckin(
                        activeWorkout.member_id,
                        activeDayIndex,
                        activeStatus === c.value ? null : c.value,
                      )
                    }
                    aria-pressed={activeStatus === c.value}
                    className={`min-h-11 px-3.5 rounded-full text-meta font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                      activeStatus === c.value
                        ? "bg-brand-purple-900 text-white"
                        : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {activeStatus === "done" && (
                <div className="pt-1.5 border-t border-brand-line space-y-1.5">
                  <p className="text-meta font-bold text-brand-ink-muted">
                    كيف كانت شدة الحصة؟
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {INTENSITY_CHIPS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() =>
                          handleWorkoutCheckin(
                            activeWorkout.member_id,
                            activeDayIndex,
                            "done",
                            activeIntensity === c.value ? null : c.value,
                          )
                        }
                        aria-pressed={activeIntensity === c.value}
                        className={`min-h-11 px-3.5 rounded-full text-meta font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                          activeIntensity === c.value
                            ? "bg-brand-pink text-white"
                            : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-meta text-brand-ink-muted leading-relaxed">
                    إجابتك تضبط شدة برنامج الأسبوع القادم.
                  </p>
                </div>
              )}
              {checkinError && (
                <p role="alert" className="text-meta font-bold text-red-700">
                  {checkinError}
                </p>
              )}
              <p className="text-meta text-brand-ink-muted leading-relaxed">
                تسجيلك يُغذّي موسم بيتكم — والضغط مرة أخرى يمسح الاختيار.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Program notes */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-brand-line bg-brand-card p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-ink mb-1.5">
            <TrendingUp className="size-4 text-brand-purple-900" aria-hidden="true" />
            التدرّج
          </p>
          <p className="text-sm text-brand-ink-muted leading-relaxed">
            {activeWorkout.progression_notes_ar}
          </p>
        </div>
        {activeWorkout.cardio_notes_ar && (
          <div className="rounded-2xl border border-brand-line bg-brand-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-brand-ink mb-1.5">
              <Flame className="size-4 text-brand-pink" aria-hidden="true" />
              الكارديو والخطوات
            </p>
            <p className="text-sm text-brand-ink-muted leading-relaxed">
              {activeWorkout.cardio_notes_ar}
            </p>
          </div>
        )}
      </div>

      {activeWorkout.safety_notes_ar && (
        <p className="rounded-xl bg-brand-pink-light/60 border border-brand-pink/30 px-4 py-3 text-brand-ink text-sm leading-relaxed">
          {activeWorkout.safety_notes_ar}
        </p>
      )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <Dumbbell
            className="size-7 text-brand-purple-900 opacity-70"
            aria-hidden="true"
          />
          {activeTab.eligible ? (
            <>
              <p className="text-brand-ink font-bold text-base leading-relaxed max-w-sm">
                لا توجد خطة تمارين لـ{activeTab.member_name_ar} بعد.
              </p>
              <Link
                href="/onboarding/workout"
                className="inline-flex items-center gap-2 bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-sm px-5 py-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-11"
              >
                <Dumbbell className="size-4" aria-hidden="true" />
                {pick(
                  `أضيفي خطة تمارين لـ${activeTab.member_name_ar}`,
                  `أضِف خطة تمارين لـ${activeTab.member_name_ar}`,
                )}
              </Link>
            </>
          ) : (
            <p className="text-brand-ink-muted text-sm leading-relaxed max-w-sm">
              خطط التمارين مخصّصة للكبار.{" "}
              {pick("تجدين", "تجد")} خطة{" "}
              {activeTab.member_name_ar} الغذائية في قسم الوجبات.
            </p>
          )}
        </div>
      )}
      </div>

      {!isSolo && (
        <MemberSheet
          open={openSheet === "member"}
          onClose={() => setOpenSheet(null)}
          title="أفراد البيت"
          subtitle={weekRange}
          members={memberRows}
          selectedId={activeTab.member_id}
          onSelect={(id) => {
            const next = tabs.find((t) => t.member_id === id);
            setActiveMemberId(id);
            setOpenSheet(null);
            if (next) {
              const text = `${pick("تعرضين", "تعرض")} خطة تمارين ${next.member_name_ar}`;
              // The closing sheet hands focus back to the identity trigger,
              // whose label already names her; speak only where it did not.
              requestAnimationFrame(() => {
                if (document.activeElement !== identityRef.current) setAnnouncement(text);
              });
            }
          }}
          returnFocusRef={identityRef}
          footer={
            <>
              <Link href={addMemberHref} className={PLAN_MENU_ITEM_CLASS}>
                <UserPlus className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
                إضافة فرد
              </Link>
              {/* When nobody can be opted in yet the page points this at
                  /family too — one door, not two rows to the same place. */}
              {addTraineeHref !== addMemberHref && addTraineeRow}
            </>
          }
        />
      )}

      <MoreSheet
        open={openSheet === "more"}
        onClose={() => setOpenSheet(null)}
        groups={[
          {
            key: "member",
            label: (
              <>
                <Avatar
                  name={activeTab.member_name_ar}
                  rosterIndex={activeRosterIndex}
                  size="sm"
                />
                {activeTab.member_name_ar}
              </>
            ),
            items: journeyItems,
          },
          {
            key: "plans",
            items: [
              // /plan/history is meal-only (workout programs keep no history),
              // so the row says which plans it opens.
              <Link key="history" href="/plan/history" className={PLAN_MENU_ITEM_CLASS}>
                <History className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
                خطط الوجبات السابقة
              </Link>,
              ...(isSolo ? [addTraineeRow] : []),
            ],
          },
        ]}
        returnFocusRef={moreRef}
      />
    </div>
  );
}
