/**
 * Pure helpers for the shared family blocks (_blocks/*). No React, no I/O, no
 * clock: everything that depends on "today" takes it as an argument, so a
 * block renders the same on the server and in the side panel.
 *
 * Client-safe on purpose — the side panel imports these. Only type imports
 * from the console contract; runtime imports are the admin's own pure
 * formatters and dictionary.
 */

import { PRICING_TIERS, type Tier } from "@fitlife/config";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { planStatusLabel, roleLabel, t, tierLabel, type AdminStringKey } from "@/lib/admin/i18n";
import type {
  AttentionReason,
  AttentionSeverity,
  FamilyFlag,
  MealPlanCell,
  MealSection,
  MealWeekDay,
  MealWeekMember,
  MealWeekProjection,
  PlanCellState,
  SessionMarkStatus,
  TraineeProfileSummary,
  WorkoutPlanCell,
  WorkoutSection,
  WorkoutSessionMark,
  WorkoutSessionView,
  WorkoutTraineeView,
} from "@/lib/admin/console-types";

// ── Tones ───────────────────────────────────────────────────────────────────

/** The six tones shared by pills, flags, notes and reasons (`ad-<tone>`). */
export type Tone = "ok" | "warn" | "crit" | "neu" | "pur" | "info";

export function toneClass(tone: Tone): string {
  return `ad-${tone}`;
}

/** `.ad-w0` … `.ad-w100` for a 0–1 fraction (clamped, rounded to a percent). */
export function widthClass(fraction: number): string {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return `ad-w${Math.round(f * 100)}`;
}

// ── Text ────────────────────────────────────────────────────────────────────

/** Replace `{key}` placeholders with already-formatted values. Unknown keys stay. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole,
  );
}

/** Arabic-Indic digits, as Intl's ar-SA formats every figure on the page. */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/**
 * Western digits inside generated plan text («10 لكل جهة», «8-12») shown in
 * the admin's digits, as every other figure on the page is. Digit by digit,
 * so nothing else in the text (leading zeros included) changes.
 */
export function localizeDigits(text: string, locale: AdminLocale): string {
  if (locale !== "ar") return text;
  return text.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)] ?? d);
}

/** Join display items the way the prototype does («، » in Arabic). */
export function joinList(items: readonly string[], locale: AdminLocale): string {
  return items.join(locale === "ar" ? "، " : ", ");
}

type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";
type PluralKeys = Record<PluralCategory, AdminStringKey>;

const PLURAL_RULES: Record<AdminLocale, Intl.PluralRules> = {
  ar: new Intl.PluralRules("ar"),
  en: new Intl.PluralRules("en"),
};

function plural(keys: PluralKeys, n: number, locale: AdminLocale): string {
  const category = PLURAL_RULES[locale].select(n) as PluralCategory;
  return fill(t(keys[category] ?? keys.other, locale), { n: fmtNumber(n, locale) });
}

const PEOPLE_KEYS: PluralKeys = {
  zero: "fm_n_people_zero",
  one: "fm_n_people_one",
  two: "fm_n_people_two",
  few: "fm_n_people_few",
  many: "fm_n_people_many",
  other: "fm_n_people_other",
};

const MINUTE_KEYS: PluralKeys = {
  zero: "fm_n_min_zero",
  one: "fm_n_min_one",
  two: "fm_n_min_two",
  few: "fm_n_min_few",
  many: "fm_n_min_many",
  other: "fm_n_min_other",
};

/** «٥ أفراد» / «5 people», with Arabic number agreement. */
export function countPeople(n: number, locale: AdminLocale): string {
  return plural(PEOPLE_KEYS, n, locale);
}

/** «٤٥ دقيقة» / «10 دقائق» / «45 min». */
export function countMinutes(n: number, locale: AdminLocale): string {
  return plural(MINUTE_KEYS, n, locale);
}

// ── Dates ───────────────────────────────────────────────────────────────────

/**
 * Locale tags for every date these blocks format. Arabic pins the Gregorian
 * calendar: a bare "ar-SA" is Gregorian in Node's ICU but Umm al-Qura (Hijri)
 * in Chromium, so the same date would read differently on a server-rendered
 * page and in the client-rendered side panel — and a client component
 * server-rendered by Node would not hydrate. Digits stay Arabic-Indic.
 */
const TAG: Record<AdminLocale, string> = { ar: "ar-SA-u-ca-gregory", en: "en-US" };
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** Operators read times in Riyadh; every timestamp is formatted there. */
const RIYADH_TZ = "Asia/Riyadh";
/** A known Sunday (2026-01-04) — weekday names are formatted from it. */
const SUNDAY_ANCHOR_MS = Date.UTC(2026, 0, 4);

/** A plain calendar day (YYYY-MM-DD) that parses. */
export function isIsoDay(value: unknown): value is string {
  return typeof value === "string" && ISO_DAY.test(value) && !Number.isNaN(dayMs(value));
}

function dayMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** YYYY-MM-DD + n days (pure calendar math, UTC). */
export function addDaysIso(iso: string, days: number): string {
  return new Date(dayMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Weekday of a calendar day, 0 = Sunday … 6 = Saturday (the workout convention). */
export function weekdayOfIso(iso: string | null | undefined): number | null {
  if (!isIsoDay(iso)) return null;
  return new Date(dayMs(iso)).getUTCDay();
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetweenIso(from: string, to: string): number | null {
  if (!isIsoDay(from) || !isIsoDay(to)) return null;
  return Math.round((dayMs(to) - dayMs(from)) / DAY_MS);
}

/** A weekday name (0 = Sunday), in the admin language. */
export function fmtWeekday(
  weekday: number,
  locale: AdminLocale,
  style: "long" | "short" = "long",
): string {
  const day = ((Math.trunc(weekday) % 7) + 7) % 7;
  return new Intl.DateTimeFormat(TAG[locale], { weekday: style, timeZone: "UTC" }).format(
    new Date(SUNDAY_ANCHOR_MS + day * DAY_MS),
  );
}

/**
 * A calendar date — fmtDate's shape («٢٧ سبتمبر ٢٠٢٦» / «Sep 27, 2026»), with
 * the calendar pinned (see TAG). "—" when missing or unparseable.
 *
 * A real timestamp is dated in RIYADH, like fmtDateTime: one failed run must
 * not read «٢٧ سبتمبر» in the attention list and 28 Sep in the runs table,
 * which UTC did for every event between 21:00 and 24:00 UTC. A plain
 * YYYY-MM-DD is already a calendar day and stays as written (UTC), since
 * shifting it would move the day itself.
 */
export function fmtDay(iso: string | null | undefined, locale: AdminLocale): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat(TAG[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: isIsoDay(iso) ? "UTC" : RIYADH_TZ,
  }).format(new Date(ms));
}

/** Day of the month for a calendar day (Gregorian, admin digits). */
export function fmtDayOfMonth(iso: string, locale: AdminLocale): string {
  return new Intl.DateTimeFormat(TAG[locale], { day: "numeric", timeZone: "UTC" }).format(
    new Date(dayMs(iso)),
  );
}

/** Date and time in Riyadh — «٢٨ سبتمبر، ١:٣٠ ص». "—" if missing. */
export function fmtDateTime(iso: string | null | undefined, locale: AdminLocale): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat(TAG[locale], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: RIYADH_TZ,
  }).format(new Date(ms));
}

/** A run's duration as m:ss («١٢:٤١»). "—" when unknown. */
export function fmtDuration(ms: number | null | undefined, locale: AdminLocale): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const two = new Intl.NumberFormat(TAG[locale], { minimumIntegerDigits: 2 });
  return `${fmtNumber(minutes, locale)}:${two.format(seconds)}`;
}

/** The arrow a date range reads with («←» right-to-left, «→» left-to-right). */
export function rangeArrow(locale: AdminLocale): string {
  return locale === "ar" ? "←" : "→";
}

// ── Plan and subscription states ────────────────────────────────────────────

const PLAN_TONE: Record<string, Tone> = {
  ready: "ok",
  failed: "crit",
  generating: "pur",
  archived: "neu",
};

/** Tone of a plan state or raw plan status. */
export function planStateTone(state: string): Tone {
  return PLAN_TONE[state] ?? "neu";
}

/** Label of a plan state or raw plan status («لا يوجد» for none). */
export function planStateLabel(state: PlanCellState | string, locale: AdminLocale): string {
  return state === "none" ? t("fm_state_none", locale) : planStatusLabel(state, locale);
}

const RUN_TONE: Record<string, Tone> = { completed: "ok", failed: "crit", started: "pur" };

/** Tone of a plan_generations.status. */
export function runStatusTone(status: string): Tone {
  return RUN_TONE[status] ?? "neu";
}

const SUBSCRIPTION_TONE: Record<string, Tone> = {
  trialing: "pur",
  active: "ok",
  past_due: "crit",
  cancelled: "neu",
  expired: "neu",
};

/** Tone of a subscription status (none / unknown → neutral). */
export function subscriptionStatusTone(status: string | null): Tone {
  return (status && SUBSCRIPTION_TONE[status]) || "neu";
}

/** Tier display name (Arabic from the pricing config). "—" when missing. */
export function tierName(tier: string | null, locale: AdminLocale): string {
  const arName = tier && tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
  return tierLabel(tier, locale, arName);
}

/** A household role, with the housekeeper called the cook (as the prototype does). */
export function memberRoleLabel(role: string, isHousekeeper: boolean, locale: AdminLocale): string {
  if (isHousekeeper || role === "housekeeper") return t("fm_role_cook", locale);
  return role ? roleLabel(role, locale) : "";
}

/**
 * Anyone under this age is planned by portions — the engine's
 * `CHILD_AGE_CUTOFF` (plan-engine childRule.ts). Mirrored, not imported: this
 * module ships to the client panel and the engine index would come with it.
 * helpers.test.ts pins both this figure and `isPlannedByPortions` to the
 * engine's own definitions, so the two cannot drift.
 */
export const CHILD_AGE_CUTOFF = 18;

/**
 * The app's ONE child rule (`isChildByAge`): member_type child OR under 18, so
 * an under-18 owner or a minor saved as an adult is shown the way the engine
 * plans them — by portions. An unknown age reads as an adult (the engine's own
 * stance). The cook is never planned, so never a child here.
 */
export function isPlannedByPortions(member: {
  memberType: string;
  isHousekeeper: boolean;
  age: number | null;
}): boolean {
  if (member.isHousekeeper || member.memberType === "housekeeper") return false;
  if (member.memberType === "child") return true;
  return member.age != null && member.age < CHILD_AGE_CUTOFF;
}

/** The families-list meal cell, rebuilt from a family's meal section. */
export function mealCellFromSection(section: MealSection): MealPlanCell {
  const served = section.served;
  if (!served) return { state: "none", daysReady: null, daysTotal: 7, masked: false };
  const status = served.plan.status;
  const state: PlanCellState =
    status === "ready" || status === "generating" || status === "failed" ? status : "failed";
  return {
    state,
    daysReady: served.plan.daysReady,
    daysTotal: served.plan.daysTotal,
    masked: served.masked,
  };
}

/** The families-list exercise cell, rebuilt from a family's workout section. */
export function workoutCellFromSection(section: WorkoutSection): WorkoutPlanCell {
  if (section.served) return { state: "ready", masked: section.served.masked };
  const status = section.latest?.status;
  if (!status) return { state: "none", masked: false };
  if (status === "ready" || status === "generating" || status === "failed") {
    return { state: status, masked: false };
  }
  return { state: "failed", masked: false };
}

/**
 * The served program's trainee count and sessions a week, or null for either
 * when the data cannot back it. The row's own figures win; otherwise they are
 * counted from the projection. An EMPTY projection is unknown, not zero: a
 * program decided from the row columns alone (its blob read failed) is served
 * with no trainees and no figures by design, and «٠ متدرّبون · ٠ حصص» would
 * state a number nobody measured.
 */
export function programFigures(served: WorkoutSection["served"]): {
  trainees: number | null;
  sessions: number | null;
} {
  if (!served) return { trainees: null, sessions: null };
  const projected = served.trainees.length > 0 ? served.trainees : null;
  return {
    trainees: served.plan.traineeCount ?? projected?.length ?? null,
    sessions:
      served.plan.sessionsPerWeek ??
      projected?.reduce((n, tr) => n + tr.sessions.length, 0) ??
      null,
  };
}

/** `value / of` as a 0–1 fraction (0 when either is unknown). */
export function fraction(value: number | null, of: number | null): number {
  if (value == null || of == null || !Number.isFinite(value) || !(of > 0)) return 0;
  return Math.min(1, Math.max(0, value / of));
}

// ── Flags and attention reasons ─────────────────────────────────────────────

export type FlagLike = FamilyFlag | "medical_gate";

const FLAG_KEY: Record<FlagLike, AdminStringKey> = {
  past_due: "status_past_due",
  over_limit: "flag_over_limit",
  medical_gate: "flag_medical_gate",
  failed_workout_run: "fm_flag_failed_workout",
  failed_meal_run: "fm_flag_failed_meal",
  cancel_scheduled: "cancel_scheduled",
  onboarding_incomplete: "fm_flag_onboarding",
};

const FLAG_TONE: Record<FlagLike, Tone> = {
  past_due: "crit",
  over_limit: "crit",
  medical_gate: "crit",
  failed_workout_run: "crit",
  failed_meal_run: "warn",
  cancel_scheduled: "warn",
  onboarding_incomplete: "warn",
};

export function familyFlagLabel(flag: FlagLike, locale: AdminLocale): string {
  return t(FLAG_KEY[flag], locale);
}

export function familyFlagTone(flag: FlagLike): Tone {
  return FLAG_TONE[flag];
}

/**
 * The flags shown as chips next to the tier and status. `past_due` is left
 * out — the status pill already says it; the medical gate joins right after
 * over-limit (the reasons' order) when the caller is allowed to show it.
 */
export function chipFlags(flags: readonly FamilyFlag[], medicalGateBlocked: boolean): FlagLike[] {
  const out: FlagLike[] = [];
  for (const flag of flags) {
    if (flag === "past_due") continue;
    out.push(flag);
    if (flag === "over_limit" && medicalGateBlocked) out.push("medical_gate");
  }
  // No over-limit flag: the gate is the most severe chip left, so it leads.
  if (medicalGateBlocked && !out.includes("medical_gate")) out.unshift("medical_gate");
  return out;
}

export const SEVERITY_TONE: Record<AttentionSeverity, Tone> = {
  high: "crit",
  medium: "warn",
  low: "neu",
};

const SEVERITY_KEY: Record<AttentionSeverity, AdminStringKey> = {
  high: "severity_high",
  medium: "severity_medium",
  low: "severity_low",
};

export function severityLabel(severity: AttentionSeverity, locale: AdminLocale): string {
  return t(SEVERITY_KEY[severity], locale);
}

const MEAL_REASON: Record<AttentionSeverity, AdminStringKey> = {
  high: "fm_r_meal_high",
  medium: "fm_r_meal_medium",
  low: "fm_r_meal_low",
};

const WORKOUT_REASON: Record<AttentionSeverity, AdminStringKey> = {
  high: "fm_r_workout_high",
  medium: "fm_r_workout_medium",
  low: "fm_r_workout_low",
};

/** One attention reason as the sentence an operator reads. */
export function reasonSentence(reason: AttentionReason, locale: AdminLocale): string {
  const date = reason.at ? fmtDay(reason.at, locale) : null;
  const when = date ? fill(t("fm_on_date", locale), { date }) : "";
  switch (reason.flag) {
    case "past_due":
      return fill(t("fm_r_past_due", locale), {
        since: date ? fill(t("fm_r_since", locale), { date }) : "",
      });
    case "over_limit": {
      const people = countPeople(reason.people ?? 0, locale);
      return reason.maxPeople != null
        ? fill(t("fm_r_over_limit", locale), {
            people,
            max: fmtNumber(reason.maxPeople, locale),
          })
        : fill(t("fm_r_over_limit_nomax", locale), { people });
    }
    case "medical_gate":
      return t("fm_r_medical", locale);
    case "failed_meal_run":
      return fill(t(MEAL_REASON[reason.severity], locale), { when });
    case "failed_workout_run":
      return fill(t(WORKOUT_REASON[reason.severity], locale), { when });
    case "cancel_scheduled":
      return fill(t("fm_r_cancel", locale), { when });
    case "onboarding_incomplete":
      return date
        ? fill(t("fm_r_onboarding_trial", locale), { date })
        : t("fm_r_onboarding", locale);
  }
}

// ── Meal week ───────────────────────────────────────────────────────────────

export interface DayTab {
  dayIndex: number;
  /** Short weekday («الأحد» / «Sun»); null when the week start is unknown. */
  short: string | null;
  /** Day of the month, or the day's ordinal («٣») without a week start. */
  num: string;
  /** Full label for assistive tech («الأحد ١٦ ربيع الآخر ١٤٤٨ هـ» / «اليوم ٣»). */
  long: string;
}

/** How many day slots a week shows (1–7). */
export function mealDayCount(week: MealWeekProjection): number {
  let maxIndex = -1;
  for (const m of week.members) for (const d of m.days) maxIndex = Math.max(maxIndex, d.dayIndex);
  const total = Number.isFinite(week.daysTotal) ? Math.trunc(week.daysTotal) : 7;
  return Math.min(7, Math.max(1, total, maxIndex + 1));
}

/** One tab per day of the plan week, labelled from week_start_date when known. */
export function mealDayTabs(week: MealWeekProjection, locale: AdminLocale): DayTab[] {
  const start = isIsoDay(week.weekStartDate) ? week.weekStartDate : null;
  const tabs: DayTab[] = [];
  for (let i = 0; i < mealDayCount(week); i += 1) {
    if (start) {
      const iso = addDaysIso(start, i);
      const weekday = weekdayOfIso(iso) ?? 0;
      tabs.push({
        dayIndex: i,
        short: fmtWeekday(weekday, locale, "short"),
        num: fmtDayOfMonth(iso, locale),
        long: `${fmtWeekday(weekday, locale, "long")} ${fmtDay(iso, locale)}`,
      });
    } else {
      const num = fmtNumber(i + 1, locale);
      tabs.push({ dayIndex: i, short: null, num, long: fill(t("fm_day_n", locale), { n: num }) });
    }
  }
  return tabs;
}

/** Today's position in the plan week (0–6), or null outside it / unknown. */
export function mealTodayIndex(
  week: Pick<MealWeekProjection, "weekStartDate">,
  todayIso: string | null | undefined,
): number | null {
  if (!todayIso || !week.weekStartDate) return null;
  const d = daysBetweenIso(week.weekStartDate, todayIso);
  return d != null && d >= 0 && d < 7 ? d : null;
}

/** The member's day, or null when it has not been generated. */
export function memberDay(member: MealWeekMember, dayIndex: number): MealWeekDay | null {
  return member.days.find((d) => d.dayIndex === dayIndex) ?? null;
}

/** The day a member's week opens on: today when inside the week, else their first day. */
export function initialMealDay(
  member: MealWeekMember | null,
  todayIndex: number | null,
  dayCount: number,
): number {
  if (todayIndex != null && todayIndex < dayCount) return todayIndex;
  return member?.days[0]?.dayIndex ?? 0;
}

const SLOT_KEY: Record<string, AdminStringKey> = {
  breakfast: "fm_slot_breakfast",
  lunch: "fm_slot_lunch",
  snack: "fm_slot_snack",
  dinner: "fm_slot_dinner",
};

/** A meal slot's name (unknown slots show as stored). */
export function slotLabel(slot: string, locale: AdminLocale): string {
  const key = SLOT_KEY[slot];
  return key ? t(key, locale) : slot;
}

/**
 * A day total against its target: on target within ±10% (the engine's
 * calorie band), otherwise off.
 */
export function onTarget(total: number | null, target: number | null, band = 0.1): boolean {
  if (total == null || target == null || !(target > 0)) return true;
  return Math.abs(total - target) / target <= band;
}

// ── Exercise week ───────────────────────────────────────────────────────────

/**
 * Today's weekday (0 = Sunday) from the section's mark window — its end is
 * today's Riyadh date. Null when the section has no window (no program).
 */
export function todayWeekdayFrom(section: Pick<WorkoutSection, "marksWindow">): number | null {
  return weekdayOfIso(section.marksWindow?.end ?? null);
}

/** The Sunday that opens the current training week. */
export function trainingWeekStart(todayIso: string, todayWeekday: number): string {
  return addDaysIso(todayIso, -todayWeekday);
}

/**
 * This week's mark for a session. The mark window reaches up to two days
 * into LAST week (the app's 48h grace), and marks are keyed by weekday — so a
 * mark on a day still ahead of today belongs to last week and is not shown.
 */
export function effectiveMark(
  session: Pick<WorkoutSessionView, "dayIndex" | "mark">,
  todayWeekday: number | null,
): WorkoutSessionMark | null {
  if (!session.mark) return null;
  if (todayWeekday != null && session.dayIndex > todayWeekday) return null;
  return session.mark;
}

/** Sessions done this week (the loader's count when today is unknown). */
export function doneThisWeek(trainee: WorkoutTraineeView, todayWeekday: number | null): number {
  if (todayWeekday == null) return trainee.doneThisWeek;
  return trainee.sessions.filter((s) => effectiveMark(s, todayWeekday)?.status === "done").length;
}

/** The session a trainee's week opens on: today's, else the next one, else the first. */
export function defaultSessionDay(
  trainee: Pick<WorkoutTraineeView, "sessions"> | null,
  todayWeekday: number | null,
): number | null {
  const days = (trainee?.sessions ?? []).map((s) => s.dayIndex).sort((a, b) => a - b);
  if (days.length === 0) return null;
  if (todayWeekday != null) {
    const next = days.find((d) => d >= todayWeekday);
    if (next !== undefined) return next;
  }
  return days[0] ?? null;
}

const MARK_KEY: Record<SessionMarkStatus, AdminStringKey> = {
  done: "fm_mark_done",
  moved: "fm_mark_moved",
  skipped: "fm_mark_skipped",
};

const MARK_TONE: Record<SessionMarkStatus, Tone> = { done: "ok", moved: "warn", skipped: "neu" };

const INTENSITY_KEY: Record<NonNullable<WorkoutSessionMark["intensity"]>, AdminStringKey> = {
  easy: "fm_int_easy",
  right: "fm_int_right",
  hard: "fm_int_hard",
};

export interface MarkView {
  tone: Tone;
  /** No leading dot (for "upcoming"). */
  plain: boolean;
  label: string;
}

/**
 * The pill a session day shows: its mark (with intensity when asked), else
 * «اليوم» / «بلا تسجيل» / «قادمة» relative to today. Null when there is no
 * mark and today is unknown.
 */
export function markView(
  session: Pick<WorkoutSessionView, "dayIndex" | "mark">,
  todayWeekday: number | null,
  locale: AdminLocale,
  withIntensity: boolean,
): MarkView | null {
  const mark = effectiveMark(session, todayWeekday);
  if (mark) {
    const base = t(MARK_KEY[mark.status], locale);
    const label =
      withIntensity && mark.intensity
        ? `${base} · ${t("fm_intensity", locale)}: ${t(INTENSITY_KEY[mark.intensity], locale)}`
        : base;
    return { tone: MARK_TONE[mark.status], plain: false, label };
  }
  if (todayWeekday == null) return null;
  if (session.dayIndex === todayWeekday) {
    return { tone: "pur", plain: false, label: t("fm_today", locale) };
  }
  if (session.dayIndex < todayWeekday) {
    return { tone: "neu", plain: false, label: t("fm_mark_none", locale) };
  }
  return { tone: "neu", plain: true, label: t("fm_upcoming", locale) };
}

// ── Workout questionnaire labels ────────────────────────────────────────────

const LOCATION_KEY: Record<string, AdminStringKey> = {
  home: "fm_loc_home",
  gym: "fm_loc_gym",
  both: "fm_loc_both",
};

const EQUIPMENT_KEY: Record<string, AdminStringKey> = {
  none: "fm_eq_none",
  dumbbells: "fm_eq_dumbbells",
  bands: "fm_eq_bands",
  machines: "fm_eq_machines",
};

const LEVEL_KEY: Record<string, { f: AdminStringKey; m: AdminStringKey }> = {
  beginner: { f: "fm_lvl_beginner_f", m: "fm_lvl_beginner_m" },
  intermediate: { f: "fm_lvl_intermediate_f", m: "fm_lvl_intermediate_m" },
  advanced: { f: "fm_lvl_advanced_f", m: "fm_lvl_advanced_m" },
};

const FOCUS_KEY: Record<string, AdminStringKey> = {
  full_body: "fm_focus_full_body",
  core: "fm_focus_core",
  lower_glutes: "fm_focus_lower_glutes",
  strength: "fm_focus_strength",
  endurance: "fm_focus_endurance",
  definition: "fm_focus_definition",
  balanced: "fm_focus_balanced",
};

const SESSION_MINUTES: Record<string, [number, number]> = {
  m20_30: [20, 30],
  m30_45: [30, 45],
  m45_60: [45, 60],
};

export function locationLabel(location: string, locale: AdminLocale): string {
  const key = LOCATION_KEY[location];
  return key ? t(key, locale) : location;
}

export function equipmentLabel(equipment: string, locale: AdminLocale): string {
  const key = EQUIPMENT_KEY[equipment];
  return key ? t(key, locale) : equipment;
}

/** Training level, inflected by the trainee's sex in Arabic (feminine fallback). */
export function experienceLabel(
  experience: string,
  sex: "male" | "female" | null,
  locale: AdminLocale,
): string {
  const keys = LEVEL_KEY[experience];
  if (!keys) return experience;
  return t(sex === "male" ? keys.m : keys.f, locale);
}

export function focusLabel(focus: string, locale: AdminLocale): string {
  const key = FOCUS_KEY[focus];
  return key ? t(key, locale) : focus;
}

/** «٣٠–٤٥ دقيقة» for a session-length answer. */
export function sessionMinutesLabel(value: string, locale: AdminLocale): string {
  const range = SESSION_MINUTES[value];
  if (!range) return value;
  return fill(t("fm_minutes_range", locale), {
    from: fmtNumber(range[0], locale),
    to: fmtNumber(range[1], locale),
  });
}

/** The equipment answer as one phrase; empty when nothing was listed. */
export function equipmentText(profile: TraineeProfileSummary, locale: AdminLocale): string {
  return joinList(
    profile.equipment.map((e) => equipmentLabel(e, locale)),
    locale,
  );
}

/**
 * A trainee's one-line summary parts: location · equipment · level (the split
 * is Arabic plan content and is rendered separately). Missing answers are
 * skipped, never guessed.
 */
export function traineeProfileParts(
  profile: TraineeProfileSummary | null,
  sex: "male" | "female" | null,
  locale: AdminLocale,
): string[] {
  if (!profile) return [];
  const parts: string[] = [];
  if (profile.location) parts.push(locationLabel(profile.location, locale));
  const equipment = equipmentText(profile, locale);
  if (equipment) parts.push(equipment);
  if (profile.experience) parts.push(experienceLabel(profile.experience, sex, locale));
  return parts;
}

/** Chosen weekdays as names («الأحد، الثلاثاء، الخميس»). */
export function weekdaysText(days: readonly number[], locale: AdminLocale): string {
  return joinList(
    [...days].sort((a, b) => a - b).map((d) => fmtWeekday(d, locale, "long")),
    locale,
  );
}

const WEEKDAY_INITIAL: readonly AdminStringKey[] = [
  "fm_wdi_0",
  "fm_wdi_1",
  "fm_wdi_2",
  "fm_wdi_3",
  "fm_wdi_4",
  "fm_wdi_5",
  "fm_wdi_6",
];

/** One-letter weekday mark (0 = Sunday). */
export function weekdayInitial(weekday: number, locale: AdminLocale): string {
  const key = WEEKDAY_INITIAL[weekday];
  return key ? t(key, locale) : "";
}

// ── Household ───────────────────────────────────────────────────────────────

/** «١٣٠ / ١٨٠ / ٥٦» (protein / carbs / fat, grams, rounded). */
export function macrosText(
  macros: { protein_g: number; carbs_g: number; fat_g: number },
  locale: AdminLocale,
): string {
  return [macros.protein_g, macros.carbs_g, macros.fat_g]
    .map((g) => fmtNumber(Math.round(Number(g)), locale))
    .join(" / ");
}

// ── Links ───────────────────────────────────────────────────────────────────

/** The read-only meal plan view (audited on open). */
export function mealPlanHref(userId: string, planId: string): string {
  return `/admin/subscribers/${encodeURIComponent(userId)}/plan/${encodeURIComponent(planId)}`;
}

/** The read-only exercise program view (audited on open). */
export function programHref(userId: string, planId: string): string {
  return `/admin/subscribers/${encodeURIComponent(userId)}/workout/${encodeURIComponent(planId)}`;
}

/** The audited health page. */
export function healthHref(userId: string): string {
  return `/admin/subscribers/${encodeURIComponent(userId)}/health`;
}
