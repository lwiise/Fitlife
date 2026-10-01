"use client";

import { useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import type {
  HouseholdMember,
  MealWeekDay,
  MealWeekMember,
  MealWeekProjection,
} from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { joinText } from "@/lib/admin/separators";
import { Count, joinSep } from "../_ui/Sep";
import {
  fraction,
  initialMealDay,
  mealDayCount,
  mealDayTabs,
  mealTodayIndex,
  memberDay,
  onTarget,
  slotLabel,
  widthClass,
} from "./helpers";
import { PlanText } from "./parts";

/**
 * The served meal week, one person and one day at a time (the prototype's
 * member chips + 7-day strip + that day's meals). Days a member does not have
 * yet are drawn dashed and open on a "not generated yet" state; a child —
 * planned by portions, with no calorie target — reads «بالحصص» instead of a
 * target. View only.
 *
 * Client state (person, day) resets when the component remounts: callers that
 * swap families in place (the side panel) should key it by the family id.
 *
 * `todayIso` (YYYY-MM-DD, Riyadh) marks today's day and opens on it when it
 * falls inside the plan week; the caller supplies it so the render has no
 * clock. `household` only adds children's ages to their chips.
 */
export function MealWeekExplorer({
  week,
  locale,
  todayIso = null,
  household,
}: {
  week: MealWeekProjection | null;
  locale: AdminLocale;
  todayIso?: string | null;
  household?: readonly HouseholdMember[];
}) {
  if (!week || week.members.length === 0) {
    return (
      <div className="ad-meals">
        <div className="ad-empty">
          <b>{t("fm_week_empty", locale)}</b>
          {t("fm_week_empty_b", locale)}
        </div>
      </div>
    );
  }
  return <Week week={week} locale={locale} todayIso={todayIso} household={household} />;
}

function Week({
  week,
  locale,
  todayIso,
  household,
}: {
  week: MealWeekProjection;
  locale: AdminLocale;
  todayIso: string | null;
  household?: readonly HouseholdMember[];
}) {
  const members = week.members;
  const dayCount = mealDayCount(week);
  const todayIndex = mealTodayIndex(week, todayIso);
  const tabs = useMemo(() => mealDayTabs(week, locale), [week, locale]);

  const [memberId, setMemberId] = useState(() => members[0]?.memberId ?? "");
  const member = members.find((m) => m.memberId === memberId) ?? members[0] ?? null;
  const [pickedDay, setPickedDay] = useState(() => initialMealDay(member, todayIndex, dayCount));
  const day = Math.min(Math.max(0, pickedDay), dayCount - 1);

  const ageById = useMemo(() => {
    const out = new Map<string, number>();
    for (const m of household ?? []) if (m.age != null) out.set(m.id, m.age);
    return out;
  }, [household]);

  if (!member) return null;
  const current = memberDay(member, day);
  const tab = tabs.find((x) => x.dayIndex === day);

  return (
    <>
      <div className="ad-chips" role="group" aria-label={t("fm_members_label", locale)}>
        {members.map((m) => {
          const age = ageById.get(m.memberId);
          return (
            <button
              key={m.memberId}
              type="button"
              aria-pressed={m.memberId === member.memberId}
              onClick={() => setMemberId(m.memberId)}
            >
              <bdi>{m.name}</bdi>
              {m.isChild ? (
                <small>{age != null ? fmtNumber(age, locale) : t("fm_child", locale)}</small>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="ad-days7" role="group" aria-label={t("fm_days_label", locale)}>
        {tabs.map((d) => {
          const ready = memberDay(member, d.dayIndex) !== null;
          const isToday = d.dayIndex === todayIndex;
          const label = joinText(
            [d.long, isToday && t("fm_today", locale), !ready && t("fm_day_not_ready", locale)],
            locale,
          );
          return (
            <button
              key={d.dayIndex}
              type="button"
              aria-pressed={d.dayIndex === day}
              aria-label={label}
              className={clsx(isToday && "ad-today", !ready && "ad-missing")}
              onClick={() => setPickedDay(d.dayIndex)}
            >
              {/* Short names on wide strips, one letter on a phone's (admin.css). */}
              {d.short ? <span className="ad-dt-short">{d.short}</span> : null}
              {d.narrow ? <span className="ad-dt-narrow">{d.narrow}</span> : null}
              <b>{d.num}</b>
            </button>
          );
        })}
      </div>

      {current ? (
        <DayMeals
          day={current}
          member={member}
          label={joinText([member.name, tab?.long], locale)}
          locale={locale}
        />
      ) : (
        <div className="ad-meals">
          <div className="ad-empty">
            <b>{t(week.generating ? "fm_day_generating" : "fm_day_missing", locale)}</b>
            {t(week.generating ? "fm_day_generating_b" : "fm_day_missing_b", locale)}
          </div>
        </div>
      )}
    </>
  );
}

function DayMeals({
  day,
  member,
  label,
  locale,
}: {
  day: MealWeekDay;
  member: MealWeekMember;
  label: string;
  locale: AdminLocale;
}) {
  const kcal = t("fm_kcal", locale);
  return (
    <div className="ad-meals" role="group" aria-label={label}>
      {day.meals.map((meal, i) => (
        <div key={`${meal.slot}-${i}`} className="ad-meal">
          <span className="ad-slot">{slotLabel(meal.slot, locale)}</span>
          <span className="ad-dish">
            <PlanText text={meal.name} locale={locale} />
          </span>
          <span className="ad-share">
            {meal.sharedBy > 1 ? (
              <span className="ad-pill ad-pur ad-plain">
                {t("fm_shared_by", locale)}
                <Count>{fmtNumber(meal.sharedBy, locale)}</Count>
              </span>
            ) : null}
          </span>
          <span className="ad-kc ad-num">
            {meal.calories != null
              ? `${fmtNumber(Math.round(meal.calories), locale)} ${kcal}`
              : "—"}
          </span>
        </div>
      ))}
      <DayTotal day={day} member={member} locale={locale} />
    </div>
  );
}

function DayTotal({
  day,
  member,
  locale,
}: {
  day: MealWeekDay;
  member: MealWeekMember;
  locale: AdminLocale;
}) {
  const of = t("fm_of", locale);
  const kcal = t("fm_kcal", locale);
  const g = t("fm_g", locale);
  const total = day.totalCalories;
  const target = member.isChild ? null : member.caloriesTarget;
  const protein = day.totalProteinG;
  const proteinTarget = member.isChild ? null : member.proteinTargetG;
  const n = (v: number) => fmtNumber(Math.round(v), locale);

  let calories: ReactNode;
  if (total == null) {
    calories = <>—</>;
  } else if (member.isChild) {
    calories = joinSep(
      `${n(total)} ${kcal}`,
      <span className="ad-muted">{t("fm_portions", locale)}</span>,
    );
  } else if (target != null && target > 0) {
    calories = (
      <>
        {n(total)} {of} {n(target)} {kcal}
        <span className="ad-meter" aria-hidden="true">
          <i
            className={clsx(
              widthClass(fraction(total, target)),
              !onTarget(total, target) && "ad-warn",
            )}
          />
        </span>
      </>
    );
  } else {
    calories = (
      <>
        {n(total)} {kcal}
      </>
    );
  }

  return (
    <div className="ad-daytot">
      <span>
        {t("fm_day_total", locale)} {calories}
      </span>
      <span>
        {t("fm_protein", locale)}{" "}
        {protein == null
          ? "—"
          : proteinTarget != null && proteinTarget > 0
            ? `${n(protein)} ${of} ${n(proteinTarget)} ${g}`
            : `${n(protein)} ${g}`}
      </span>
    </div>
  );
}
