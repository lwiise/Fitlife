/**
 * Date helpers for the plan week. The plan now starts on the day it's generated
 * (not a fixed Saturday). `day_index` stays a 0–6 ordinal; `day_name_ar` is the
 * Arabic weekday of (week_start_date + day_index).
 *
 * The audience is Saudi/Gulf (UTC+3, no DST), but generation runs server-side in
 * UTC. To make "day 0 = the user's generation day" correct at midnight edges, we
 * compute the Riyadh calendar date (UTC+3) for both the anchor and "today".
 */

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

// Canonical Khaleeji weekday names (index 0 = Saturday). Kept here so the prompt
// and the day-name computation never drift.
export const DAY_NAMES_AR = [
  "السبت",
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
] as const;

// JS getUTCDay() (0=Sun..6=Sat) → Khaleeji index (0=Sat..6=Fri).
const JS_TO_KHALEEJI: Record<number, number> = {
  6: 0,
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
};

/** ISO date (YYYY-MM-DD) of "today" in Riyadh (UTC+3). */
export function riyadhTodayISO(): string {
  return new Date(Date.now() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/** Arabic weekday name for (weekStartISO + dayIndex). */
export function khaleejiDayName(weekStartISO: string, dayIndex: number): string {
  const d = new Date(`${weekStartISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  const khaleeji = JS_TO_KHALEEJI[d.getUTCDay()] ?? 0;
  return DAY_NAMES_AR[khaleeji] ?? `اليوم ${dayIndex + 1}`;
}
