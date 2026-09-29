import { Info, TriangleAlert } from "lucide-react";
import type { WorkoutSection } from "@/lib/admin/console-types";
import { fmtMoney, fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { fill, fmtDateTime, fmtDay, programFigures } from "./helpers";
import { PlanStatePill } from "./parts";

/**
 * The household's exercise program at a glance, in whichever state it is:
 *
 *  - none — nobody opted in («لم تشترك الأسرة…»), or opted in with no run yet;
 *  - waiting for meals — the run holds until the meal run finishes;
 *  - generating — started at …;
 *  - failed — «the previous program is still shown» when an older one is
 *    served, else «nothing to show»;
 *  - ready — the prototype's box: trainees, sessions a week, run cost.
 *
 * View only (no regenerate/retry: those spend AI credit). Returns sibling
 * elements (notes + box) for the caller's stacked container.
 */
export function ProgramSummaryBox({
  section,
  locale,
  currency,
}: {
  section: WorkoutSection;
  locale: AdminLocale;
  currency: Currency;
}) {
  const { served, latest } = section;

  if (!served && !latest) {
    return section.optedIn ? (
      <div className="ad-empty">
        <b>{t("fm_ex_no_program", locale)}</b>
        {t("fm_ex_no_program_b", locale)}
      </div>
    ) : (
      <div className="ad-empty">
        <b>{t("fm_ex_none", locale)}</b>
        {t("fm_ex_none_b", locale)}
      </div>
    );
  }

  const failedWhen =
    latest?.status === "failed"
      ? fill(t("fm_on_date", locale), { date: fmtDay(latest.createdAt, locale) })
      : "";

  let note: { tone: "neutral" | "crit"; title?: string; body: string } | null = null;
  if (section.waitingForMeals) {
    note = {
      tone: "neutral",
      title: t("fm_ex_waiting", locale),
      body: t("fm_ex_waiting_b", locale),
    };
  } else if (latest?.status === "generating") {
    note = {
      tone: "neutral",
      title: t("fm_ex_generating", locale),
      body: fill(t("fm_ex_generating_b", locale), {
        date: fmtDateTime(latest.createdAt, locale),
      }),
    };
  } else if (latest?.status === "failed") {
    note = {
      tone: "crit",
      body: fill(t(served ? "fm_ex_masked" : "fm_ex_failed", locale), { when: failedWhen }),
    };
  }

  const plan = served?.plan ?? null;
  // A newest row that reads ready but whose program could not be read still
  // gets its state line, without figures it cannot back.
  const shown = plan ?? (note ? null : latest);
  const at = shown ? (shown.generatedAt ?? shown.createdAt) : null;
  // Unknown (an empty projection) renders «—», never a fabricated zero.
  const { trainees, sessions } = programFigures(served);

  return (
    <>
      {note ? (
        <div className={note.tone === "crit" ? "ad-note ad-crit" : "ad-note"} role="note">
          {note.tone === "crit" ? (
            <TriangleAlert className="ad-ic" aria-hidden="true" />
          ) : (
            <Info className="ad-ic" aria-hidden="true" />
          )}
          <span>
            {note.title ? (
              <>
                <b>{note.title}</b>
                <br />
              </>
            ) : null}
            {note.body}
          </span>
        </div>
      ) : null}
      {shown && at ? (
        <div className="ad-box">
          <div className="ad-box-top">
            <span>
              <PlanStatePill state={shown.status} locale={locale} />
            </span>
            <span className="ad-muted">
              {t("fm_generated", locale)} <time dateTime={at}>{fmtDateTime(at, locale)}</time>
            </span>
          </div>
          {plan ? (
            <div className="ad-stats3">
              <div>
                <b className="ad-num">{trainees != null ? fmtNumber(trainees, locale) : "—"}</b>
                <span>{t("fm_trainees", locale)}</span>
              </div>
              <div>
                <b className="ad-num">{sessions != null ? fmtNumber(sessions, locale) : "—"}</b>
                <span>{t("fm_sessions_wk", locale)}</span>
              </div>
              <div>
                <b className="ad-num">
                  {plan.costUsd != null ? fmtMoney(plan.costUsd, currency, locale, 2) : "—"}
                </b>
                <span>{t("fm_run_cost", locale)}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
