import Link from "next/link";
import type { WorkoutPlanListItem } from "@/lib/admin/console-types";
import { fmtMoney, fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { fmtDay, programHref } from "./helpers";
import { DateText, ErrorText, Ltr, PlanStatePill, TableScroll } from "./parts";

/*
 * Links to the program view never prefetch: opening a program is an audited
 * access, and a prefetch must not be able to reach that page on the
 * operator's behalf.
 */

const dateOf = (p: WorkoutPlanListItem) => p.generatedAt ?? p.createdAt;

/**
 * Exercise programs as a compact list (the prototype's `progHistory`): date —
 * linking to that program's read-only view — then status, then cost.
 * Statuses are the raw row status. `limit` keeps the first N.
 */
export function ProgramHistory({
  plans,
  userId,
  locale,
  currency,
  limit,
}: {
  plans: readonly WorkoutPlanListItem[];
  userId: string;
  locale: AdminLocale;
  currency: Currency;
  limit?: number;
}) {
  const rows = limit != null ? plans.slice(0, limit) : plans;
  if (rows.length === 0) return <p className="ad-muted">{t("fm_no_programs", locale)}</p>;
  return (
    <ul className="ad-minihist">
      {rows.map((p) => (
        <li key={p.id}>
          <span>
            <Link className="ad-link" href={programHref(userId, p.id)} prefetch={false}>
              <span className="ad-sr">{t("fm_open_program", locale)}: </span>
              <DateText iso={dateOf(p)} locale={locale} />
            </Link>
          </span>
          <span>
            <PlanStatePill state={p.status} locale={locale} />
          </span>
          <span className="ad-num ad-muted">
            {p.costUsd != null ? fmtMoney(p.costUsd, currency, locale, 2) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every exercise program with its run detail — date, status, trainees,
 * sessions a week, cost, model, error — and an open link on every row.
 * Trainee and session counts are known for the served program only (the
 * rest read «—»: the list never loads a program's content). Rows are named
 * by their date, as in MealPlanTable: a row header, and the date again in
 * the link («فتح البرنامج: ٢٠ سبتمبر ٢٠٢٦»).
 */
export function ProgramTable({
  plans,
  userId,
  locale,
  currency,
}: {
  plans: readonly WorkoutPlanListItem[];
  userId: string;
  locale: AdminLocale;
  currency: Currency;
}) {
  if (plans.length === 0) return <div className="ad-empty">{t("fm_no_programs", locale)}</div>;
  const n = (v: number | null) => (v != null ? fmtNumber(v, locale) : "—");
  return (
    <TableScroll label={t("fm_prog_history", locale)}>
      <thead>
        <tr>
          <th scope="col">{t("fm_col_date", locale)}</th>
          <th scope="col">{t("col_status", locale)}</th>
          <th scope="col" className="ad-end">
            {t("fm_trainees", locale)}
          </th>
          <th scope="col" className="ad-end">
            {t("fm_sessions_wk", locale)}
          </th>
          <th scope="col" className="ad-end">
            {t("field_cost", locale)}
          </th>
          <th scope="col">{t("field_model", locale)}</th>
          <th scope="col">{t("field_error", locale)}</th>
          <th scope="col" className="ad-end">
            <span className="ad-sr">{t("fm_open_program", locale)}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {plans.map((p) => (
          <tr key={p.id}>
            <th scope="row">
              <DateText iso={dateOf(p)} locale={locale} />
            </th>
            <td>
              <PlanStatePill state={p.status} locale={locale} />
            </td>
            <td className="ad-end ad-num">{n(p.traineeCount)}</td>
            <td className="ad-end ad-num">{n(p.sessionsPerWeek)}</td>
            <td className="ad-end ad-num">
              {p.costUsd != null ? fmtMoney(p.costUsd, currency, locale, 4, 4) : "—"}
            </td>
            <td className="ad-muted">{p.aiModel ? <Ltr mono>{p.aiModel}</Ltr> : "—"}</td>
            <td className="ad-err">
              {p.errorMessage ? <ErrorText text={p.errorMessage} /> : null}
            </td>
            <td className="ad-end">
              <Link className="ad-link" href={programHref(userId, p.id)} prefetch={false}>
                {t("fm_open_program", locale)}
                <span className="ad-sr">: {fmtDay(dateOf(p), locale)}</span>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </TableScroll>
  );
}
