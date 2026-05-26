/**
 * JavaScript getDay() returns: Sunday=0, Monday=1, …, Saturday=6.
 * Our plan schema uses Khaleeji week ordering:
 *   السبت=0, الأحد=1, الإثنين=2, الثلاثاء=3, الأربعاء=4, الخميس=5, الجمعة=6
 *
 * "Today" is always device-date based (the user's device reflects Saudi UTC+3
 * naturally) — never computed server-side, to avoid a UTC off-by-one at night.
 */

const DAYS_AR = [
  "السبت",
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
] as const;

export type KhaleejiDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const JS_TO_KHALEEJI: Record<number, KhaleejiDayIndex> = {
  6: 0, // Saturday
  0: 1, // Sunday
  1: 2, // Monday
  2: 3, // Tuesday
  3: 4, // Wednesday
  4: 5, // Thursday
  5: 6, // Friday
};

export function getCurrentKhaleejiDayIndex(date: Date = new Date()): KhaleejiDayIndex {
  return JS_TO_KHALEEJI[date.getDay()] ?? 0;
}

export function getDayNameAr(index: KhaleejiDayIndex): string {
  return DAYS_AR[index] ?? "";
}

export function getTodayDayName(): string {
  return getDayNameAr(getCurrentKhaleejiDayIndex());
}

// Gregorian calendar forced — ar-SA defaults to the Hijri calendar, which would
// show a Hijri month name. We want e.g. "اليوم الأحد — ١٢ مايو".
const HEADER_DATE_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
});

export function formatTodayHeader(date: Date = new Date()): string {
  const dayName = getDayNameAr(getCurrentKhaleejiDayIndex(date));
  return `اليوم ${dayName} — ${HEADER_DATE_FMT.format(date)}`;
}
