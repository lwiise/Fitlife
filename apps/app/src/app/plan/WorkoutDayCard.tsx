"use client";

// One day of the generated workout plan — a session or a rest day. Mirrors the
// MealCard visual grammar (pill + title + meta + big number) so meals↔exercise read
// as the same surface. Arabic-only (the housekeeper/translated view hides exercise).

import { Clock, HeartPulse, Moon } from "lucide-react";
import type { WorkoutDay } from "@fitlife/plan-engine";
import {
  BAND_LABEL_AR,
  BAND_STYLE,
  MODALITY_LABEL_AR,
} from "@/lib/exercise/workoutLabels";

export function WorkoutDayCard({ entry }: { entry: WorkoutDay["entry"] }) {
  if (entry.kind === "rest") {
    return (
      <article className="flex items-center gap-3 rounded-2xl bg-brand-surface-elevated border border-brand-ink/5 px-5 py-4">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-lavender/40 text-brand-purple-900 flex-shrink-0">
          <Moon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-brand-ink text-base leading-snug">راحة</h3>
          {entry.notes_ar && (
            <p className="mt-0.5 text-brand-ink-muted text-xs leading-relaxed">
              {entry.notes_ar}
            </p>
          )}
        </div>
      </article>
    );
  }

  const band = BAND_STYLE[entry.band];
  const intensity = entry.hr_zone
    ? `${entry.hr_zone.low_bpm}–${entry.hr_zone.high_bpm} ن/د`
    : entry.rpe_low != null && entry.rpe_high != null
      ? `مجهود ${entry.rpe_low}–${entry.rpe_high} من 10`
      : null;

  return (
    <article className="rounded-2xl overflow-hidden bg-brand-surface-elevated border border-brand-ink/5">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${band.bg} ${band.text}`}
          >
            {BAND_LABEL_AR[entry.band]}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-brand-ink text-base leading-snug">
              {MODALITY_LABEL_AR[entry.exercise_type] ?? entry.exercise_type}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-brand-ink-muted text-xs tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {entry.duration_min} دقيقة
              </span>
              {intensity && (
                <span className="inline-flex items-center gap-1">
                  <HeartPulse className="size-3.5" aria-hidden="true" />
                  {intensity}
                </span>
              )}
            </p>
          </div>
          {entry.est_kcal != null && entry.est_kcal > 0 && (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="font-extrabold text-brand-ink text-xl tabular-nums">
                {Math.round(entry.est_kcal)}
              </span>
              <span className="text-brand-ink-muted text-xs">سعرة</span>
            </div>
          )}
        </div>
        {entry.notes_ar && (
          <p className="mt-3 text-brand-ink-muted text-xs leading-relaxed bg-brand-surface/60 rounded-xl p-3">
            {entry.notes_ar}
          </p>
        )}
      </div>
    </article>
  );
}
