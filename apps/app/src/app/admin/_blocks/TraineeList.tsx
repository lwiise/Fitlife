import { Fragment } from "react";
import { Info } from "lucide-react";
import type {
  WorkoutIneligibleMember,
  WorkoutSection,
  WorkoutTraineeView,
} from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { joinSep } from "../_ui/Sep";
import {
  doneThisWeek,
  effectiveMark,
  fmtWeekday,
  traineeProfileParts,
  traineeRoleLabel,
  weekdayInitial,
  weekdaysText,
} from "./helpers";
import { PlanText } from "./parts";

const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Who trains in the served program: per trainee their role, a line of
 * location, equipment, level and split, sessions done this week, and a
 * Sunday-first week of day marks (purple = training day, green = done).
 * Children and the cook — never given a program — are named in a note below.
 * Renders nothing when no program is served.
 *
 * `todayWeekday` (0 = Sunday, Riyadh) is the caller's — see ProgramWeekExplorer.
 */
export function TraineeList({
  section,
  locale,
  todayWeekday,
}: {
  section: WorkoutSection;
  locale: AdminLocale;
  todayWeekday: number | null;
}) {
  if (!section.served) return null;
  return (
    <>
      <div>
        {section.served.trainees.map((trainee) => (
          <Trainee
            key={trainee.memberId}
            trainee={trainee}
            locale={locale}
            todayWeekday={todayWeekday}
          />
        ))}
      </div>
      <NotIncludedNote members={section.ineligible} locale={locale} />
    </>
  );
}

function Trainee({
  trainee,
  locale,
  todayWeekday,
}: {
  trainee: WorkoutTraineeView;
  locale: AdminLocale;
  todayWeekday: number | null;
}) {
  const sessionDays = new Set(trainee.sessions.map((s) => s.dayIndex));
  const doneDays = new Set(
    trainee.sessions
      .filter((s) => effectiveMark(s, todayWeekday)?.status === "done")
      .map((s) => s.dayIndex),
  );
  const parts = traineeProfileParts(trainee.profile, trainee.sex, locale);
  const role = traineeRoleLabel(trainee.role, trainee.sex, locale);
  const of = t("fm_of", locale);

  return (
    <div className="ad-trainee">
      <div className="ad-t1">
        <b>
          <bdi>{trainee.name}</bdi>
        </b>
        {role ? <span className="ad-muted">{role}</span> : null}
      </div>
      <span className="ad-done">
        {t("fm_done_week", locale)}: {fmtNumber(doneThisWeek(trainee, todayWeekday), locale)} {of}{" "}
        {fmtNumber(trainee.sessions.length, locale)}
      </span>
      <p>
        {parts.length === 0 && !trainee.splitName ? t("fm_no_answers", locale) : null}
        {joinSep(
          ...parts,
          trainee.splitName ? <PlanText text={trainee.splitName} locale={locale} /> : null,
        )}
      </p>
      <div className="ad-wdays" aria-hidden="true">
        {WEEK.map((d) => (
          <i
            key={d}
            className={doneDays.has(d) ? "ad-done" : sessionDays.has(d) ? "ad-on" : undefined}
            title={fmtWeekday(d, locale)}
          >
            {weekdayInitial(d, locale)}
          </i>
        ))}
      </div>
      <p className="ad-sr">
        {t("fm_training_days", locale)}: {weekdaysText([...sessionDays], locale) || "—"}.{" "}
        {t("fm_done_days", locale)}: {weekdaysText([...doneDays], locale) || "—"}.
      </p>
    </div>
  );
}

/** The prototype's «خارج خطط التمارين» note: children with their age, and the cook. */
export function NotIncludedNote({
  members,
  locale,
}: {
  members: readonly WorkoutIneligibleMember[];
  locale: AdminLocale;
}) {
  if (members.length === 0) return null;
  const sep = locale === "ar" ? "، " : ", ";
  return (
    <div className="ad-note" role="note">
      <Info className="ad-ic" aria-hidden="true" />
      <span>
        <b>{t("fm_not_incl", locale)}:</b>{" "}
        {members.map((m, i) => (
          <Fragment key={m.memberId}>
            {i > 0 ? sep : null}
            {m.reason === "housekeeper" ? (
              t("fm_role_cook", locale)
            ) : (
              <>
                <bdi>{m.name}</bdi>
                {m.age != null ? ` (${fmtNumber(m.age, locale)})` : null}
              </>
            )}
          </Fragment>
        ))}
        . {t("fm_not_incl_why", locale)}
      </span>
    </div>
  );
}
