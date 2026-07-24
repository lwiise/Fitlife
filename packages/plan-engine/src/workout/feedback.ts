/**
 * Post-week intensity feedback → next-generation adaptation.
 *
 * WorkoutViewer's «أنجزتها» mark can carry an intensity rating (easy / right /
 * hard — workout_checkins.intensity, migration 00022). Before a workout
 * generation, recent rows are summarized per member and the summary rides the
 * trainee's prompt line as an adaptation clause, so the next program responds
 * to how the last one actually felt — the closest thing to a coach's weekly
 * adjustment the platform has.
 *
 * Absence of ratings is UNKNOWN (engagement-layer contract): no clause is
 * emitted, nothing is fabricated.
 */

export const WORKOUT_INTENSITIES = ["easy", "right", "hard"] as const;
export type WorkoutIntensity = (typeof WORKOUT_INTENSITIES)[number];

export interface WorkoutFeedbackSummary {
  /** Sessions marked done in the window. */
  done: number;
  /** Done sessions that carried an intensity rating. */
  rated: number;
  easy: number;
  hard: number;
}

/** Minimum rated sessions before the feedback is allowed to steer a program —
 * one tap is an anecdote, not a signal. */
export const FEEDBACK_MIN_RATED = 2;

/**
 * Collapse recent workout_checkins rows into per-member summaries.
 * Rows are (member_id, status, intensity) — intensity only counts on done
 * sessions (the viewer only offers it there, but stale data must not skew).
 */
export function summarizeWorkoutFeedback(
  rows: Array<{
    member_id: string | null;
    status: string;
    intensity?: string | null;
  }>,
): Record<string, WorkoutFeedbackSummary> {
  const out: Record<string, WorkoutFeedbackSummary> = {};
  for (const row of rows) {
    if (!row.member_id || row.status !== "done") continue;
    const s = (out[row.member_id] ??= { done: 0, rated: 0, easy: 0, hard: 0 });
    s.done += 1;
    if (row.intensity === "easy" || row.intensity === "hard" || row.intensity === "right") {
      s.rated += 1;
      if (row.intensity === "easy") s.easy += 1;
      if (row.intensity === "hard") s.hard += 1;
    }
  }
  return out;
}

/**
 * The Arabic adaptation clause for a trainee's roster line, or null when the
 * signal is too thin to act on. Wording is a directive to Coach Sara (فصحى,
 * feminine imperative — she is the coach), numbers first per the copy rules.
 */
export function workoutFeedbackClause(
  summary: WorkoutFeedbackSummary | undefined | null,
): string | null {
  if (!summary || summary.rated < FEEDBACK_MIN_RATED) return null;
  const { rated, easy, hard } = summary;
  if (hard * 2 >= rated && hard > easy) {
    return (
      `تقييم الأسبوع الماضي: ${hard} من ${rated} جلسات مقيّمة كانت شاقة — ` +
      "خفّفي هذا الأسبوع: أنقصي مجموعة من كل تمرين رئيسي أو اخفضي الوزن درجة، وثبّتي التكرارات."
    );
  }
  if (easy * 2 >= rated && easy > hard) {
    return (
      `تقييم الأسبوع الماضي: ${easy} من ${rated} جلسات مقيّمة كانت خفيفة — ` +
      "زيدي التحدي هذا الأسبوع: وزن أعلى درجة أو مجموعة إضافية على التمارين المركبة، مع بقاء RIR ضمن 1-3."
    );
  }
  return (
    `تقييم الأسبوع الماضي: ${rated} جلسات مقيّمة وكانت الشدة مناسبة — ` +
    "حافظي على المستوى نفسه مع التدرّج الطبيعي."
  );
}
