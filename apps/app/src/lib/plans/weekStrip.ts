/**
 * The /plan week strip's cells: seven dated days for the plan bar (09/2026).
 *
 * Pure calendar math on YYYY-MM-DD strings in UTC, like dayMapping.ts — a
 * device timezone must never move a plan day onto the neighbouring date.
 *
 * THE ARABIC MONTH IS A TABLE, NOT Intl. `Intl.DateTimeFormat("ar-SA")`
 * resolves its calendar per ENGINE: Node's ICU picks gregory, Chromium's picks
 * islamic-umalqura. The same cell would then render «سبتمبر» on the server and
 * «ربيع الآخر» in the browser — a hydration text mismatch, and a Hijri month
 * beside a Gregorian day number. Other locales go through Intl with the
 * calendar pinned in the tag (`-u-ca-gregory`) for the same reason; see
 * `weekRangeLocale` in dayMapping.ts, which hit this once already.
 */

import type { LocaleCode } from "@fitlife/plan-engine";
import { arNum } from "@/lib/copy/numbers";
import { WORKOUT_GRACE_DAYS } from "@/lib/engagement/seasonMath";
import { addDaysISO, riyadhTodayISO } from "./dayMapping";

export type StripDayState = "ready" | "empty" | "pending";

export interface StripDay {
  /** The viewer's own index (meal day_index 0..6 OR workout weekday 0..6). */
  index: number;
  /** YYYY-MM-DD calendar date of that cell ("" when the anchor was invalid). */
  iso: string;
  /** The locale the labels were built in — dayLineDate/stripDayLabel need it. */
  locale: LocaleCode;
  /** «أحد» … «سبت» (Arabic) or Intl short weekday for other locales. */
  weekdayShort: string;
  /** «الأحد» … (Arabic) or Intl long weekday. */
  weekdayFull: string;
  /** «٢٩» on Arabic; the locale's own digits elsewhere. */
  dayOfMonth: string;
  /** «سبتمبر» */
  monthLong: string;
  isToday: boolean;
}

/** Indexed by JS getUTCDay(): 0 = Sunday. The dashboard's season strip
 * shortens the same way («الإثنين» → «إثنين»). */
export const SHORT_WEEKDAY_AR: readonly string[] = [
  "أحد",
  "إثنين",
  "ثلاثاء",
  "أربعاء",
  "خميس",
  "جمعة",
  "سبت",
];

const FULL_WEEKDAY_AR: readonly string[] = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

/** Gregorian months as Saudi readers write them — indexed by getUTCMonth(). */
export const MONTH_AR: readonly string[] = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/**
 * The Intl tag for a NON-Arabic locale, calendar pinned to Gregorian. Exported
 * so a test can assert the TAG: under Node's ICU the output looks right with
 * or without the pin, so only the tag catches a regression. Urdu goes through
 * ur-PK (the housekeeper audience) rather than the bare language.
 */
export function intlLocaleTag(locale: LocaleCode): string {
  return `${locale === "ur" ? "ur-PK" : locale}-u-ca-gregory`;
}

interface LocaleFormatters {
  short: Intl.DateTimeFormat;
  long: Intl.DateTimeFormat;
  month: Intl.DateTimeFormat;
  full: Intl.DateTimeFormat;
  num: Intl.NumberFormat;
}

// Seven cells × four formatters per render is wasteful; build once per locale.
const formatters = new Map<LocaleCode, LocaleFormatters>();

function formattersFor(locale: LocaleCode): LocaleFormatters {
  const hit = formatters.get(locale);
  if (hit) return hit;
  const tag = intlLocaleTag(locale);
  const f: LocaleFormatters = {
    short: new Intl.DateTimeFormat(tag, { timeZone: "UTC", weekday: "short" }),
    long: new Intl.DateTimeFormat(tag, { timeZone: "UTC", weekday: "long" }),
    month: new Intl.DateTimeFormat(tag, { timeZone: "UTC", month: "long" }),
    full: new Intl.DateTimeFormat(tag, {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    num: new Intl.NumberFormat(tag, { useGrouping: false }),
  };
  formatters.set(locale, f);
  return f;
}

function parseISO(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDay(index: number, iso: string, locale: LocaleCode, todayISO: string): StripDay {
  const d = parseISO(iso);
  if (!d) {
    // A plan without a readable week start still needs a navigable strip:
    // number the cells rather than inventing dates.
    return {
      index,
      iso: "",
      locale,
      weekdayShort: locale === "ar" ? arNum(index + 1) : String(index + 1),
      weekdayFull: "",
      dayOfMonth: "",
      monthLong: "",
      isToday: false,
    };
  }
  const isToday = iso === todayISO;
  if (locale === "ar") {
    return {
      index,
      iso,
      locale,
      weekdayShort: SHORT_WEEKDAY_AR[d.getUTCDay()]!,
      weekdayFull: FULL_WEEKDAY_AR[d.getUTCDay()]!,
      dayOfMonth: arNum(d.getUTCDate()),
      monthLong: MONTH_AR[d.getUTCMonth()]!,
      isToday,
    };
  }
  const f = formattersFor(locale);
  return {
    index,
    iso,
    locale,
    weekdayShort: f.short.format(d),
    weekdayFull: f.long.format(d),
    dayOfMonth: f.num.format(d.getUTCDate()),
    monthLong: f.month.format(d),
    isToday,
  };
}

/** Meal plan cells: day i = week_start_date + i. `todayISO` injectable for tests. */
export function mealStripDays(
  weekStartISO: string,
  locale: LocaleCode,
  todayISO: string = riyadhTodayISO(),
): StripDay[] {
  const valid = parseISO(weekStartISO) !== null;
  return Array.from({ length: 7 }, (_, i) =>
    buildDay(i, valid ? addDaysISO(weekStartISO, i) : "", locale, todayISO),
  );
}

/**
 * Workout cells: weekday-anchored (0 = Sunday … 6 = Saturday, the workout
 * day_index convention), each dated to the session a mark on it would be
 * recorded against — the SAME rule setWorkoutCheckin stamps by. The strip is a
 * rolling seven days starting at the marking window's floor, in date order:
 * Sunday→Saturday of this week from Tuesday on, but on a Sunday or Monday the
 * window still reaches LAST Friday/Saturday (the 48h grace), so those cells
 * lead the strip with their past dates instead of trailing it with next week's
 * — dates never run out of order, and each weekday appears exactly once.
 */
export function workoutStripDays(
  locale: LocaleCode,
  todayISO: string = riyadhTodayISO(),
): StripDay[] {
  const today = parseISO(todayISO);
  if (!today) {
    return Array.from({ length: 7 }, (_, i) => buildDay(i, "", locale, todayISO));
  }
  const back = Math.max(today.getUTCDay(), WORKOUT_GRACE_DAYS);
  const start = addDaysISO(todayISO, -back);
  return Array.from({ length: 7 }, (_, k) => {
    const iso = addDaysISO(start, k);
    return buildDay(parseISO(iso)!.getUTCDay(), iso, locale, todayISO);
  });
}

/** A cell's full spoken date — «الثلاثاء ٢٩ سبتمبر», or the locale's own
 * order via Intl («Tuesday, September 29»). */
export function stripDayLabel(day: StripDay): string {
  const d = parseISO(day.iso);
  if (!d) return day.weekdayFull || day.weekdayShort;
  if (day.locale === "ar") return `${day.weekdayFull} ${day.dayOfMonth} ${day.monthLong}`;
  return formattersFor(day.locale).full.format(d);
}

const RELATIVE_AR: Record<number, string> = { [-1]: "أمس", 0: "اليوم", 1: "غداً" };

/**
 * The day line's date: «الثلاثاء ٢٩ سبتمبر» plus a relative word when the day
 * is yesterday, today or tomorrow. Arabic only — the translated view reads the
 * date alone (relative is null), since those three words would need seven
 * locales' worth of review for a line the cook reads once a day.
 */
export function dayLineDate(
  day: StripDay,
  todayISO: string = riyadhTodayISO(),
): { date: string; relative: string | null } {
  const date = stripDayLabel(day);
  if (day.locale !== "ar") return { date, relative: null };
  const d = parseISO(day.iso);
  const today = parseISO(todayISO);
  if (!d || !today) return { date, relative: null };
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  return { date, relative: RELATIVE_AR[diff] ?? null };
}
