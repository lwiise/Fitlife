import { TriangleAlert } from "lucide-react";
import type { MealSection } from "@/lib/admin/console-types";
import { fmtMoney, fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { fill, fmtDateTime, fmtDay } from "./helpers";
import { PlanStatePill } from "./parts";

/**
 * The meal plan the household is served, at a glance (the prototype's
 * `mealSummary` inside its `.box`): state, when it was generated, days ready,
 * people on the plan and what the run cost. A newer run that failed while
 * this older plan is still shown is stated above the box, with its date.
 *
 * Returns sibling elements (note + box) for the caller's stacked container
 * (`.ad-panel`, `.ad-sh-body`), whose gap spaces them.
 */
export function MealSummaryBox({
  section,
  locale,
  currency,
}: {
  section: MealSection;
  locale: AdminLocale;
  currency: Currency;
}) {
  const served = section.served;
  if (!served) {
    return (
      <div className="ad-empty">
        <b>{t("fm_meal_none", locale)}</b>
        {t("fm_meal_none_b", locale)}
      </div>
    );
  }

  const { plan, week } = served;
  const generating = plan.status === "generating";
  const at = generating ? plan.createdAt : (plan.generatedAt ?? plan.createdAt);
  const days =
    plan.daysReady != null
      ? `${fmtNumber(plan.daysReady, locale)}/${fmtNumber(plan.daysTotal, locale)}`
      : "—";
  const people = week ? fmtNumber(week.members.length, locale) : "—";
  const cost = plan.costUsd != null ? fmtMoney(plan.costUsd, currency, locale, 2) : "—";

  let note: string | null = null;
  if (served.masked) {
    const when = served.maskedFailureAt
      ? fill(t("fm_on_date", locale), { date: fmtDay(served.maskedFailureAt, locale) })
      : "";
    note = fill(t("fm_meal_masked", locale), { when });
  } else if (plan.status === "failed") {
    note = fill(t("fm_meal_failed", locale), {
      when: fill(t("fm_on_date", locale), { date: fmtDay(plan.createdAt, locale) }),
    });
  }

  return (
    <>
      {note ? (
        <div className="ad-note ad-crit" role="note">
          <TriangleAlert className="ad-ic" aria-hidden="true" />
          <span>{note}</span>
        </div>
      ) : null}
      <div className="ad-box">
        <div className="ad-box-top">
          <span>
            <PlanStatePill state={plan.status} locale={locale} />
          </span>
          <span className="ad-muted">
            {t(generating ? "fm_started" : "fm_generated", locale)}{" "}
            <time dateTime={at}>{fmtDateTime(at, locale)}</time>
          </span>
        </div>
        <div className="ad-stats3">
          <div>
            <b className="ad-num">{days}</b>
            <span>{t("fm_days_ready", locale)}</span>
          </div>
          <div>
            <b className="ad-num">{people}</b>
            <span>{t("fm_people_on_plan", locale)}</span>
          </div>
          <div>
            <b className="ad-num">{cost}</b>
            <span>{t("fm_run_cost", locale)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
