"use client";

import { useState } from "react";
import { Dumbbell, Timer, Flame, ShieldCheck, TrendingUp } from "lucide-react";
import type { WorkoutPlan, MemberWorkout } from "@fitlife/plan-engine";

const DAY_NAMES_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function SessionCard({ session, showHomeVariant }: {
  session: MemberWorkout["weekly_sessions"][number];
  showHomeVariant: boolean;
}) {
  const [homeMode, setHomeMode] = useState(false);
  const hasVariants = session.exercises.some((e) => e.home_variant_ar);

  return (
    <article className="rounded-2xl border border-brand-ink/5 bg-white overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-brand-ink/5 bg-brand-surface/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center size-9 rounded-xl bg-brand-lavender/40 flex-shrink-0">
            <Dumbbell className="size-4.5 text-brand-purple-900" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-brand-ink text-sm truncate">
              {DAY_NAMES_AR[session.day_index] ?? `يوم ${session.day_index + 1}`} — {session.session_name_ar}
            </h3>
            <p className="text-brand-ink-muted text-xs flex items-center gap-1">
              <Timer className="size-3" aria-hidden="true" />
              نحو {session.duration_min} دقيقة
            </p>
          </div>
        </div>
        {showHomeVariant && hasVariants && (
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
      </header>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-xs font-bold text-brand-ink-muted mb-1">الإحماء</p>
          <ul className="text-sm text-brand-ink leading-relaxed list-disc ps-5">
            {session.warmup_ar.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>

        <div className="overflow-x-auto">
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
              {session.exercises.map((ex, i) => (
                <tr key={i} className="border-b border-brand-ink/5 last:border-0 align-top">
                  <td className="py-2.5 pe-3">
                    <span className="font-bold text-brand-ink block">
                      {homeMode && ex.home_variant_ar ? ex.home_variant_ar : ex.name_ar}
                    </span>
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
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums font-bold text-brand-ink">
                    {ex.sets}
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-brand-ink" dir="ltr">
                    {ex.reps}
                  </td>
                  <td className="py-2.5 ps-2 text-center tabular-nums text-brand-ink-muted">
                    {ex.rest_seconds >= 60
                      ? `${Math.round(ex.rest_seconds / 30) / 2} د`
                      : `${ex.rest_seconds} ث`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {session.cooldown_ar.length > 0 && (
          <div>
            <p className="text-xs font-bold text-brand-ink-muted mb-1">التهدئة</p>
            <ul className="text-sm text-brand-ink leading-relaxed list-disc ps-5">
              {session.cooldown_ar.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Read-only weekly workout program viewer: member tabs → session cards with
 * the exercise table (sets × reps, rest, RIR) and a home/gym variant toggle
 * when the member trains in both locations.
 */
export function WorkoutViewer({ plan }: { plan: WorkoutPlan }) {
  const [activeMemberId, setActiveMemberId] = useState(plan.members[0]?.member_id ?? "");
  const active = plan.members.find((m) => m.member_id === activeMemberId) ?? plan.members[0];
  if (!active) return null;

  const sorted = [...active.weekly_sessions].sort((a, b) => a.day_index - b.day_index);
  const showHomeVariant = active.weekly_sessions.some((s) =>
    s.exercises.some((e) => e.home_variant_ar),
  );

  return (
    <div className="space-y-5">
      {plan.safety_disclaimer_ar && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-yellow/15 border border-brand-yellow/40 px-4 py-3 text-brand-ink text-sm leading-relaxed">
          <ShieldCheck className="size-4.5 flex-shrink-0 mt-0.5 text-brand-ink" aria-hidden="true" />
          {plan.safety_disclaimer_ar}
        </p>
      )}

      {plan.members.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="أفراد البرنامج">
          {plan.members.map((m) => (
            <button
              key={m.member_id}
              type="button"
              role="tab"
              aria-selected={m.member_id === active.member_id}
              onClick={() => setActiveMemberId(m.member_id)}
              className={`min-h-11 flex-shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                m.member_id === active.member_id
                  ? "border-brand-purple-900 bg-brand-purple-900/5 text-brand-ink"
                  : "border-brand-ink/10 bg-white text-brand-ink-muted hover:border-brand-ink/25"
              }`}
            >
              {m.member_name_ar}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-brand-ink/5 bg-white px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="font-bold text-brand-ink text-sm">{active.split_name_ar}</span>
        <span className="text-brand-ink-muted text-xs">
          {active.weekly_sessions.length} جلسات أسبوعياً
        </span>
      </div>

      <div className="space-y-4">
        {sorted.map((session) => (
          <SessionCard
            key={session.day_index}
            session={session}
            showHomeVariant={showHomeVariant}
          />
        ))}
      </div>

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
