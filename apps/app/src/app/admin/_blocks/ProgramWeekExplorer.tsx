"use client";

import { Fragment, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import type {
  WorkoutExerciseView,
  WorkoutSection,
  WorkoutSessionView,
  WorkoutTraineeView,
} from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { joinSep } from "../_ui/Sep";
import {
  addDaysIso,
  countMinutes,
  defaultSessionDay,
  experienceLabel,
  fill,
  fmtDayOfMonth,
  fmtWeekday,
  focusLabel,
  joinList,
  localizeDigits,
  locationLabel,
  markView,
  sessionMinutesLabel,
  equipmentText,
  trainingWeekSundayFrom,
  weekdaysText,
  type MarkView,
} from "./helpers";
import { ArText, Pill } from "./parts";

const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * The served exercise program, one trainee at a time (the prototype's
 * trainee chips + Sunday-first week + session detail). Rest days are drawn
 * as outlined cells; each session day shows its name, length and this week's
 * mark; the selected session lists its exercises (sets × reps, rest, effort)
 * with the mark and its intensity. View only.
 *
 * `todayWeekday` (0 = Sunday, Riyadh) marks today and decides which marks
 * belong to this week — the caller supplies it so the render has no clock
 * (`todayWeekdayFrom(section)` derives it from the section's mark window).
 * Client state resets on remount: key it by the family id when the family
 * changes in place. Renders nothing when no program is served.
 */
export function ProgramWeekExplorer({
  section,
  locale,
  todayWeekday,
}: {
  section: WorkoutSection;
  locale: AdminLocale;
  todayWeekday: number | null;
}) {
  const trainees = section.served?.trainees ?? [];
  if (trainees.length === 0) return null;
  return (
    <Explorer trainees={trainees} section={section} locale={locale} todayWeekday={todayWeekday} />
  );
}

function Explorer({
  trainees,
  section,
  locale,
  todayWeekday,
}: {
  trainees: readonly WorkoutTraineeView[];
  section: WorkoutSection;
  locale: AdminLocale;
  todayWeekday: number | null;
}) {
  const [traineeId, setTraineeId] = useState(() => trainees[0]?.memberId ?? "");
  const [picked, setPicked] = useState<number | null>(null);
  const trainee = trainees.find((tr) => tr.memberId === traineeId) ?? trainees[0] ?? null;
  if (!trainee) return null;

  const dayOf = (d: number) => trainee.sessions.find((s) => s.dayIndex === d) ?? null;
  const selectedDay =
    picked != null && dayOf(picked) ? picked : defaultSessionDay(trainee, todayWeekday);
  const selected = selectedDay != null ? dayOf(selectedDay) : null;

  // Day numbers for this training week, counted from its Sunday — the mark
  // window's start, as the loader defined it (never recomputed here).
  const sunday = trainingWeekSundayFrom(section);
  const dayNum = (d: number) => (sunday ? fmtDayOfMonth(addDaysIso(sunday, d), locale) : null);

  const excluded = section.ineligible;

  return (
    <>
      <div className="ad-chips" role="group" aria-label={t("fm_trainees_label", locale)}>
        {trainees.map((tr) => {
          const meta = [
            tr.profile?.location ? locationLabel(tr.profile.location, locale) : null,
            tr.profile?.experience ? experienceLabel(tr.profile.experience, tr.sex, locale) : null,
          ].filter((x): x is string => !!x);
          return (
            <button
              key={tr.memberId}
              type="button"
              aria-pressed={tr.memberId === trainee.memberId}
              onClick={() => {
                setTraineeId(tr.memberId);
                setPicked(null);
              }}
            >
              <bdi>{tr.name}</bdi>
              {meta.length > 0 ? <small>{joinSep(...meta)}</small> : null}
            </button>
          );
        })}
        {excluded.length > 0 ? (
          <span className="ad-cx ad-na">
            {joinSep(
              // One flex item, so the names read as one list, not spaced apart by the chip's gap.
              <span>
                {excluded.map((m, i) => (
                  <Fragment key={m.memberId}>
                    {i > 0 ? (locale === "ar" ? "، " : ", ") : null}
                    {m.reason === "housekeeper" ? t("fm_role_cook", locale) : <bdi>{m.name}</bdi>}
                  </Fragment>
                ))}
              </span>,
              t("fm_not_incl_short", locale),
            )}
          </span>
        ) : null}
      </div>

      <div className="ad-wk" role="group" aria-label={t("fm_week_label", locale)}>
        {WEEK.map((d) => {
          const session = dayOf(d);
          const num = dayNum(d);
          const dn = (
            <span className="ad-dn">
              {fmtWeekday(d, locale, "short")}
              {num ? ` ${num}` : null}
            </span>
          );
          if (!session) {
            return (
              <div key={d} className="ad-wd ad-rest">
                {dn}
                {t("fm_rest_day", locale)}
              </div>
            );
          }
          const mark = markView(session, todayWeekday, locale, false);
          return (
            <button
              key={d}
              type="button"
              className={clsx("ad-wd", d === todayWeekday && "ad-today")}
              aria-pressed={d === selectedDay}
              onClick={() => setPicked(d)}
            >
              {dn}
              <b>
                <ArText>{session.name}</ArText>
              </b>
              {session.durationMin != null ? (
                <span className="ad-muted">{countMinutes(session.durationMin, locale)}</span>
              ) : null}
              {mark ? <MarkPill mark={mark} /> : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <SessionDetail
          session={selected}
          trainee={trainee}
          locale={locale}
          mark={markView(selected, todayWeekday, locale, true)}
        />
      ) : (
        <div className="ad-empty">{t("fm_no_sessions", locale)}</div>
      )}
    </>
  );
}

function MarkPill({ mark }: { mark: MarkView }) {
  return (
    <Pill tone={mark.tone} plain={mark.plain}>
      {joinSep(mark.label, mark.detail)}
    </Pill>
  );
}

function SessionDetail({
  session,
  trainee,
  locale,
  mark,
}: {
  session: WorkoutSessionView;
  trainee: WorkoutTraineeView;
  locale: AdminLocale;
  mark: MarkView | null;
}) {
  const profile = trainee.profile;
  const facts: Array<[string, string]> = [];
  if (profile?.location)
    facts.push([t("fm_place", locale), locationLabel(profile.location, locale)]);
  if (profile) {
    const equipment = equipmentText(profile, locale);
    if (equipment) facts.push([t("fm_equipment", locale), equipment]);
  }
  if (profile?.experience) {
    facts.push([t("fm_level", locale), experienceLabel(profile.experience, trainee.sex, locale)]);
  }
  if (profile && profile.focusAreas.length > 0) {
    facts.push([
      t("fm_focus", locale),
      joinList(
        profile.focusAreas.map((f) => focusLabel(f, locale)),
        locale,
      ),
    ]);
  }
  if (profile?.sessionMinutes) {
    facts.push([
      t("fm_session_length", locale),
      sessionMinutesLabel(profile.sessionMinutes, locale),
    ]);
  }
  if (profile?.preferredDays && profile.preferredDays.length > 0) {
    facts.push([t("fm_chosen_days", locale), weekdaysText(profile.preferredDays, locale)]);
  }

  return (
    <div className="ad-box">
      <div className="ad-panel-h">
        <div>
          {joinSep(
            <b>
              <ArText>{session.name}</ArText>
            </b>,
            <span className="ad-muted">{fmtWeekday(session.dayIndex, locale)}</span>,
            session.durationMin != null ? (
              <span className="ad-muted">{countMinutes(session.durationMin, locale)}</span>
            ) : null,
          )}
        </div>
        {mark ? <MarkPill mark={mark} /> : null}
      </div>

      {session.exercises.length > 0 ? (
        <ol className="ad-exlist">
          {session.exercises.map((exercise, i) => (
            <ExerciseRow key={i} index={i} exercise={exercise} locale={locale} />
          ))}
        </ol>
      ) : null}

      {facts.length > 0 ? (
        <p className="ad-pl-sum">
          {joinSep(
            ...facts.map(([label, value]) => (
              <>
                {label}: <b>{value}</b>
              </>
            )),
          )}
        </p>
      ) : null}
      {session.warmup ? (
        <p className="ad-pl-sum">
          {t("fm_warmup", locale)}: <ArText>{session.warmup}</ArText>
        </p>
      ) : null}
      {session.cooldown ? (
        <p className="ad-pl-sum">
          {t("fm_cooldown", locale)}: <ArText>{session.cooldown}</ArText>
        </p>
      ) : null}
      {trainee.progressionNotes ? (
        <p className="ad-pl-sum">
          {t("fm_progression", locale)}: <ArText>{trainee.progressionNotes}</ArText>
        </p>
      ) : null}
    </div>
  );
}

function ExerciseRow({
  index,
  exercise,
  locale,
}: {
  index: number;
  exercise: WorkoutExerciseView;
  locale: AdminLocale;
}) {
  // Muscles, rest, effort — whichever the program states, in that order.
  const details: ReactNode[] = joinSep(
    exercise.targetMuscles ? <ArText>{exercise.targetMuscles}</ArText> : null,
    exercise.restSeconds != null
      ? fill(t("fm_rest_s", locale), { n: fmtNumber(exercise.restSeconds, locale) })
      : null,
    exercise.rir ? <ArText>{localizeDigits(exercise.rir, locale)}</ArText> : null,
  );

  return (
    <li>
      <span className="ad-n ad-num">{fmtNumber(index + 1, locale)}</span>
      <span>
        <b>
          <ArText>{exercise.name}</ArText>
        </b>
        {details.length > 0 ? <small>{details}</small> : null}
        {exercise.homeVariant ? (
          <small>
            {t("fm_home_variant", locale)}: <ArText>{exercise.homeVariant}</ArText>
          </small>
        ) : null}
      </span>
      <span className="ad-sets ad-num">
        {exercise.sets != null ? fmtNumber(exercise.sets, locale) : "—"} ×{" "}
        <ArText>{exercise.reps ? localizeDigits(exercise.reps, locale) : "—"}</ArText>
      </span>
    </li>
  );
}
