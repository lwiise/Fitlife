import type { MealPlanCell, WorkoutPlanCell } from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { fraction, planStateLabel, planStateTone, widthClass } from "./helpers";
import { MaskedMark, Pill } from "./parts";

/**
 * The meal-plan cell (families list, panel summary cards): a days meter with
 * «٧/٧» when ready, «قيد الإنشاء · ٤/٧» while generating, a failed pill, or
 * «لا يوجد». A served plan behind a failed newer run carries a warning mark.
 * When the day count is unknown (outside the probe window) the state pill
 * stands in for the meter — never a guessed number.
 */
export function MealPlanPill({ cell, locale }: { cell: MealPlanCell; locale: AdminLocale }) {
  if (cell.state === "none") {
    return <span className="ad-muted">{t("fm_state_none", locale)}</span>;
  }
  const masked = cell.masked ? <MaskedMark locale={locale} /> : null;
  if (cell.state === "failed") {
    return (
      <span className="ad-mealcell">
        <Pill tone="crit">{planStateLabel("failed", locale)}</Pill>
        {masked}
      </span>
    );
  }

  const days =
    cell.daysReady != null
      ? `${fmtNumber(cell.daysReady, locale)}/${fmtNumber(cell.daysTotal, locale)}`
      : null;
  const meter = (tone: "ok" | "pur") =>
    days ? (
      <span className="ad-mini-meter" aria-hidden="true">
        <i
          className={`${widthClass(fraction(cell.daysReady, cell.daysTotal))}${
            tone === "pur" ? " ad-pur" : ""
          }`}
        />
      </span>
    ) : null;

  if (cell.state === "generating") {
    return (
      <span className="ad-mealcell">
        {meter("pur")}
        <Pill tone="pur">
          {planStateLabel("generating", locale)}
          {days ? ` · ${days}` : null}
          {days ? <span className="ad-sr"> {t("fm_days_ready", locale)}</span> : null}
        </Pill>
        {masked}
      </span>
    );
  }

  if (!days) {
    return (
      <span className="ad-mealcell">
        <Pill tone="ok">{planStateLabel("ready", locale)}</Pill>
        {masked}
      </span>
    );
  }
  return (
    <span className="ad-mealcell">
      {meter("ok")}
      <span className="ad-num">
        {days}
        <span className="ad-sr"> {t("fm_days_ready", locale)}</span>
      </span>
      {masked}
    </span>
  );
}

/**
 * The exercise-plan cell: ready / generating / failed pill or «لا يوجد»,
 * with the same warning mark when an older program is served. (The list row
 * carries no "waiting for meals" signal — that state lives on the panel and
 * page, in ProgramSummaryBox.)
 */
export function WorkoutPlanPill({ cell, locale }: { cell: WorkoutPlanCell; locale: AdminLocale }) {
  if (cell.state === "none") {
    return <span className="ad-muted">{t("fm_state_none", locale)}</span>;
  }
  return (
    <span className="ad-mealcell">
      <Pill tone={planStateTone(cell.state)}>{planStateLabel(cell.state, locale)}</Pill>
      {cell.masked ? <MaskedMark locale={locale} /> : null}
    </span>
  );
}
