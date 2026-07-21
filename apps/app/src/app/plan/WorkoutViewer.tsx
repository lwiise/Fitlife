"use client";

import { Fragment, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Flame, ShieldCheck, TrendingUp, Moon, Check } from "lucide-react";
import type { WorkoutPlan, MemberWorkout, WorkoutSession } from "@fitlife/plan-engine";
import type { WorkoutCheckinStatus } from "@/lib/engagement/types";
import { setWorkoutCheckin as setWorkoutCheckinAction } from "@/lib/engagement/actions";
import { ExerciseLottie } from "./ExerciseLottie";
import { genderPick } from "@/lib/copy/gender";

// Workout day_index is weekday-anchored: 0 = الأحد … 6 = السبت (matches JS
// Date#getDay, where 0 = Sunday).
const DAY_NAMES_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

// A session may be marked on its weekday and up to 2 days after (48h grace) —
// mirrors the meal check-in window. The server re-derives + enforces this; the
// client gate just hides the controls on future/stale days.
const WORKOUT_GRACE_DAYS = 2;
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

function formatRest(restSeconds: number): string {
  return restSeconds >= 60
    ? `${Math.round(restSeconds / 30) / 2} د`
    : `${restSeconds} ث`;
}

// Today if it's a training day, else the next training day (wrapping) — so the
// viewer opens on actionable content, mirroring the meal viewer's today-first
// default.
function defaultDayIndex(member: MemberWorkout | undefined): number {
  if (!member) return 0;
  const trainingDays = new Set(member.weekly_sessions.map((s) => s.day_index));
  const today = new Date().getDay();
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
      <div className="rounded-2xl border border-brand-ink/5 bg-white px-4 py-3.5">
        <p className="text-xs font-bold text-brand-ink-muted mb-1.5">الإحماء</p>
        <ul className="text-sm text-brand-ink leading-relaxed list-disc ps-5 space-y-0.5">
          {session.warmup_ar.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-brand-ink/5 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-brand-ink/5">
          <p className="font-bold text-brand-ink text-sm">{session.session_name_ar}</p>
          <p className="text-brand-ink-muted text-xs tabular-nums">
            {session.exercises.length} تمارين · {totalSets} مجموعة
          </p>
        </div>
        <div className="overflow-x-auto px-4 pb-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-brand-ink-muted text-xs border-b border-brand-ink/5">
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
                    <tr className="border-b border-brand-ink/5 last:border-0 align-top">
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
                              <span className="text-brand-ink-muted text-xs block">
                                {ex.target_muscles_ar}
                                {ex.name_en && !homeMode ? ` · ${ex.name_en}` : ""}
                              </span>
                              {ex.rir && (
                                <span className="text-brand-purple-900 text-xs block mt-0.5">{ex.rir}</span>
                              )}
                            </span>
                          </button>
                        ) : (
                          <span className="block py-1">
                            <span className="font-bold text-brand-ink block">{displayName}</span>
                            <span className="text-brand-ink-muted text-xs block">
                              {ex.target_muscles_ar}
                              {ex.name_en && !homeMode ? ` · ${ex.name_en}` : ""}
                            </span>
                            {ex.rir && (
                              <span className="text-brand-purple-900 text-xs block mt-0.5">{ex.rir}</span>
                            )}
                            {ex.notes_ar && (
                              <span className="text-brand-ink-muted text-xs block mt-0.5">{ex.notes_ar}</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums font-bold text-brand-ink">
                        {ex.sets}
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-brand-ink" dir="ltr">
                        {ex.reps}
                      </td>
                      <td className="py-2.5 ps-2 text-center tabular-nums text-brand-ink-muted">
                        {formatRest(ex.rest_seconds)}
                      </td>
                    </tr>
                    {animId && isOpen && (
                      <tr className="border-b border-brand-ink/5 last:border-0">
                        <td colSpan={4} className="pb-4 pt-1">
                          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-brand-lavender/15 p-3">
                            <div className="w-full max-w-56 sm:w-56 flex-shrink-0">
                              <ExerciseLottie exerciseId={animId} label={displayName} />
                            </div>
                            <div className="flex-1 min-w-48">
                              <p className="text-brand-pink font-bold text-xs mb-1.5">الأداء الصحيح</p>
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
        <div className="rounded-2xl border border-brand-ink/5 bg-white px-4 py-3.5">
          <p className="text-xs font-bold text-brand-ink-muted mb-1.5">التهدئة</p>
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
 * Read-only weekly workout program viewer, mirroring the meal PlanViewer's
 * structure: member tabs → summary tiles → 7-day tab grid → one day at a time
 * (training session or rest state), with a home/gym variant toggle when the
 * member's plan includes home variants.
 */
export function WorkoutViewer({
  plan,
  planId,
  checkins,
  ownerSex,
}: {
  plan: WorkoutPlan;
  /** workout_plans.id — needed to write session marks. */
  planId?: string;
  /** Session marks for this plan (interactive page only). member_id: "mom" |
   * family_members.id; day_index weekday-anchored. Presence enables marking. */
  checkins?: Array<{ day_index: number; member_id: string; status: string }>;
  /** Account owner's sex → the «أنتِ/أنتَ» mom-tab marker. */
  ownerSex?: string | null;
}) {
  const [activeMemberId, setActiveMemberId] = useState(
    plan.members[0]?.member_id ?? "",
  );
  const active =
    plan.members.find((m) => m.member_id === activeMemberId) ?? plan.members[0];
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() =>
    defaultDayIndex(plan.members[0]),
  );
  // Viewer-level so the choice survives switching days/members.
  const [homeMode, setHomeMode] = useState(false);

  // Optimistic session marks, keyed member|day. Seeded from the checkins prop;
  // clearing removes the mark (a mis-tap must be reversible). The 48h grace is
  // enforced server-side — the client gate just hides controls on future days.
  const [checkinMap, setCheckinMap] = useState<Map<string, WorkoutCheckinStatus>>(
    () =>
      new Map(
        (checkins ?? [])
          .filter(
            (c): c is typeof c & { status: WorkoutCheckinStatus } =>
              c.status === "done" || c.status === "moved" || c.status === "skipped",
          )
          .map((c) => [`${c.member_id}|${c.day_index}`, c.status]),
      ),
  );
  const [checkinError, setCheckinError] = useState<string | null>(null);
  // Weekday today (0=Sunday), once — matches defaultDayIndex's approach.
  const [todayWeekday] = useState(() => new Date().getDay());

  function handleWorkoutCheckin(
    memberId: string,
    dayIndex: number,
    status: WorkoutCheckinStatus | null,
  ) {
    if (!planId) return;
    const key = `${memberId}|${dayIndex}`;
    const prev = checkinMap.get(key) ?? null;
    const next = new Map(checkinMap);
    if (status === null) next.delete(key);
    else next.set(key, status);
    setCheckinMap(next);
    setCheckinError(null);
    void setWorkoutCheckinAction({
      workout_plan_id: planId,
      day_index: dayIndex,
      member_id: memberId,
      status,
    }).then((result) => {
      if (!result.ok) {
        setCheckinMap((cur) => {
          const reverted = new Map(cur);
          if (prev) reverted.set(key, prev);
          else reverted.delete(key);
          return reverted;
        });
        setCheckinError(result.error);
      }
    });
  }

  const stats = useMemo(() => {
    if (!active) return null;
    const sessions = active.weekly_sessions;
    const totalMin = sessions.reduce((sum, s) => sum + s.duration_min, 0);
    const totalExercises = sessions.reduce((sum, s) => sum + s.exercises.length, 0);
    return {
      count: sessions.length,
      avgMin: sessions.length > 0 ? Math.round(totalMin / sessions.length) : 0,
      totalExercises,
    };
  }, [active]);

  if (!active || !stats) return null;

  const isSolo = plan.members.length === 1;
  const activeSession = active.weekly_sessions.find(
    (s) => s.day_index === activeDayIndex,
  );
  const showHomeVariant = active.weekly_sessions.some((s) =>
    s.exercises.some((e) => e.home_variant_ar),
  );
  const activeSets = activeSession
    ? activeSession.exercises.reduce((sum, ex) => sum + ex.sets, 0)
    : 0;

  // This member's mark for the open day, and whether it's within the markable
  // window (its weekday, up to 2 days back — never a future session).
  const activeStatus =
    checkinMap.get(`${active.member_id}|${activeDayIndex}`) ?? null;
  const activeDayDist = (todayWeekday - activeDayIndex + 7) % 7;
  const canMarkActive =
    checkins !== undefined && !!planId && activeDayDist <= WORKOUT_GRACE_DAYS;

  return (
    <div className="space-y-6">
      {plan.safety_disclaimer_ar && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-yellow/15 border border-brand-yellow/40 px-4 py-3 text-brand-ink text-sm leading-relaxed">
          <ShieldCheck className="size-4.5 flex-shrink-0 mt-0.5 text-brand-ink" aria-hidden="true" />
          {plan.safety_disclaimer_ar}
        </p>
      )}

      {/* Member tabs (hidden for a solo program) — same underline style as the meal viewer */}
      {!isSolo && (
        <div className="border-b border-brand-ink/10 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {plan.members.map((m) => {
              const isActive = m.member_id === active.member_id;
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
                  {m.member_id === "mom" && (
                    <span className="text-brand-pink me-1">
                      {genderPick(ownerSex)("أنتِ", "أنتَ")} ·
                    </span>
                  )}
                  {m.member_name_ar}
                  {isActive && (
                    <motion.span
                      layoutId="workout-member-tab-underline"
                      className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-purple-900"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Member summary tiles */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">التقسيم</p>
          <p className="font-extrabold text-brand-ink text-sm mt-1 leading-snug">
            {active.split_name_ar}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">جلسات الأسبوع</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {stats.count}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">متوسط الجلسة</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {stats.avgMin}
            <span className="text-brand-ink-muted text-xs ms-1">دقيقة</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-brand-ink/5">
          <p className="text-brand-ink-muted text-xs">تمارين الأسبوع</p>
          <p className="font-extrabold text-brand-ink text-xl mt-1 tabular-nums">
            {stats.totalExercises}
          </p>
        </div>
      </div>

      {/* Day tabs — rest days stay visible but muted */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const isTraining = active.weekly_sessions.some((s) => s.day_index === i);
          const isActive = i === activeDayIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveDayIndex(i)}
              aria-pressed={isActive}
              className={`rounded-xl py-2.5 font-bold text-xs transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${
                isActive
                  ? "bg-brand-purple-900 text-white"
                  : isTraining
                    ? "bg-brand-lavender/30 text-brand-purple-900 hover:bg-brand-lavender/50"
                    : "bg-white text-brand-ink-muted/60 border border-brand-ink/5 hover:text-brand-ink-muted"
              }`}
            >
              {DAY_NAMES_AR[i]}
            </button>
          );
        })}
      </div>

      {/* Session summary pill + home/gym toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {activeSession ? (
          <div className="inline-flex flex-wrap items-center gap-2 bg-white rounded-full border border-brand-ink/5 px-4 py-2">
            <span className="font-bold text-brand-ink text-sm">
              {activeSession.session_name_ar}
            </span>
            <span className="text-brand-ink-muted/40">·</span>
            <span className="text-brand-ink text-xs tabular-nums">
              نحو {activeSession.duration_min} دقيقة
            </span>
            <span className="text-brand-ink-muted/40">·</span>
            <span className="text-brand-ink text-xs tabular-nums">
              {activeSession.exercises.length} تمارين
            </span>
            <span className="text-brand-ink-muted/40">·</span>
            <span className="text-brand-ink text-xs tabular-nums">
              {activeSets} مجموعة
            </span>
            {activeStatus && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
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
          <div className="inline-flex items-center gap-2 bg-white rounded-full border border-brand-ink/5 px-4 py-2">
            <span className="text-brand-ink-muted text-xs">يوم راحة</span>
          </div>
        )}
        {showHomeVariant && (
          <button
            type="button"
            onClick={() => setHomeMode((v) => !v)}
            aria-pressed={homeMode}
            className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
              homeMode
                ? "border-brand-purple-900 bg-brand-purple-900/10 text-brand-purple-900"
                : "border-brand-ink/10 bg-white text-brand-ink"
            }`}
          >
            {homeMode ? "نسخة المنزل" : "نسخة النادي"}
          </button>
        )}
      </div>

      {/* Single-day content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${active.member_id}-${activeDayIndex}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
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

          {/* Session marking — a training day within the 48h window. Honest
              signal (done/moved/skipped); tapping again clears. Feeds «موسم
              بيتنا». Server re-derives the date and enforces the window. */}
          {activeSession && canMarkActive && (
            <div
              className="rounded-2xl border border-brand-ink/5 bg-white px-4 py-3.5 space-y-2"
              aria-label="تتبّع الحصة"
            >
              <p className="text-xs font-bold text-brand-ink-muted">
                هل أنجزت حصة اليوم؟
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WORKOUT_STATUS_CHIPS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() =>
                      handleWorkoutCheckin(
                        active.member_id,
                        activeDayIndex,
                        activeStatus === c.value ? null : c.value,
                      )
                    }
                    aria-pressed={activeStatus === c.value}
                    className={`min-h-11 px-3.5 rounded-full text-xs font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                      activeStatus === c.value
                        ? "bg-brand-purple-900 text-white"
                        : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {checkinError && (
                <p role="alert" className="text-xs font-bold text-red-700">
                  {checkinError}
                </p>
              )}
              <p className="text-[11px] text-brand-ink-muted leading-relaxed">
                تسجيلك يُغذّي موسم بيتكم — والضغط مرة أخرى يمسح الاختيار.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Program notes */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-brand-ink/5 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-ink mb-1.5">
            <TrendingUp className="size-4 text-brand-purple-900" aria-hidden="true" />
            التدرّج
          </p>
          <p className="text-sm text-brand-ink-muted leading-relaxed">
            {active.progression_notes_ar}
          </p>
        </div>
        {active.cardio_notes_ar && (
          <div className="rounded-2xl border border-brand-ink/5 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-brand-ink mb-1.5">
              <Flame className="size-4 text-brand-pink" aria-hidden="true" />
              الكارديو والخطوات
            </p>
            <p className="text-sm text-brand-ink-muted leading-relaxed">
              {active.cardio_notes_ar}
            </p>
          </div>
        )}
      </div>

      {active.safety_notes_ar && (
        <p className="rounded-xl bg-brand-pink-light/60 border border-brand-pink/30 px-4 py-3 text-brand-ink text-sm leading-relaxed">
          {active.safety_notes_ar}
        </p>
      )}
    </div>
  );
}
