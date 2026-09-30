import Link from "next/link";
import type { MealPlanListItem } from "@/lib/admin/console-types";
import { fmtMoney, fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { joinSep } from "../_ui/Sep";
import { mealPlanHref } from "./helpers";
import { DateText, Ltr, PlanStatePill } from "./parts";

/*
 * Links to the plan view never prefetch: opening a plan is an audited access,
 * and a prefetch must not be able to reach that page on the operator's behalf.
 */

const dateOf = (p: MealPlanListItem) => p.generatedAt ?? p.createdAt;

function daysText(p: MealPlanListItem, locale: AdminLocale): string {
  return p.daysReady != null
    ? `${fmtNumber(p.daysReady, locale)}/${fmtNumber(p.daysTotal, locale)}`
    : "—";
}

/**
 * Meal plans as a compact list (the prototype's `minihist`): date — linking
 * to that plan's read-only view — then status, then days and cost. Statuses
 * are the raw row status. Pass the plans to list (e.g. without the served
 * one for «الخطط السابقة»); `limit` keeps the first N.
 */
export function MealPlanHistory({
  plans,
  userId,
  locale,
  currency,
  limit,
}: {
  plans: readonly MealPlanListItem[];
  userId: string;
  locale: AdminLocale;
  currency: Currency;
  limit?: number;
}) {
  const rows = limit != null ? plans.slice(0, limit) : plans;
  if (rows.length === 0) return <p className="ad-muted">{t("no_plans", locale)}</p>;
  return (
    <ul className="ad-minihist">
      {rows.map((p) => (
        <li key={p.id}>
          <span>
            <Link className="ad-link" href={mealPlanHref(userId, p.id)} prefetch={false}>
              <span className="ad-sr">{t("fm_open_plan", locale)}: </span>
              <DateText iso={dateOf(p)} locale={locale} />
            </Link>
          </span>
          <span>
            <PlanStatePill state={p.status} locale={locale} />
          </span>
          <span className="ad-num ad-muted">
            {joinSep(
              daysText(p, locale),
              p.costUsd != null ? fmtMoney(p.costUsd, currency, locale, 2) : "—",
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every meal plan with its full run detail — date, status, days, tokens
 * in/out, cost, model — and an open link on every row (the old detail page's
 * plans table). Costs keep four decimals so a small run never reads as zero.
 */
export function MealPlanTable({
  plans,
  userId,
  locale,
  currency,
}: {
  plans: readonly MealPlanListItem[];
  userId: string;
  locale: AdminLocale;
  currency: Currency;
}) {
  if (plans.length === 0) return <div className="ad-empty">{t("no_plans", locale)}</div>;
  const n = (v: number | null) => (v != null ? fmtNumber(v, locale) : "—");
  return (
    <div className="ad-tbl-wrap">
      <table className="ad-tbl" aria-label={t("section_plans", locale)}>
        <thead>
          <tr>
            <th scope="col">{t("fm_col_date", locale)}</th>
            <th scope="col">{t("col_status", locale)}</th>
            <th scope="col" className="ad-end">
              {t("field_days", locale)}
            </th>
            <th scope="col" className="ad-end">
              {t("fm_tokens_head", locale)}
            </th>
            <th scope="col" className="ad-end">
              {t("field_cost", locale)}
            </th>
            <th scope="col">{t("field_model", locale)}</th>
            <th scope="col" className="ad-end">
              <span className="ad-sr">{t("fm_open_plan", locale)}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td>
                <DateText iso={dateOf(p)} locale={locale} />
              </td>
              <td>
                <PlanStatePill state={p.status} locale={locale} />
              </td>
              <td className="ad-end ad-num">{daysText(p, locale)}</td>
              <td className="ad-end ad-num ad-muted">
                {n(p.aiInputTokens)} / {n(p.aiOutputTokens)}
              </td>
              <td className="ad-end ad-num">
                {p.costUsd != null ? fmtMoney(p.costUsd, currency, locale, 4, 4) : "—"}
              </td>
              <td className="ad-muted">{p.aiModel ? <Ltr mono>{p.aiModel}</Ltr> : "—"}</td>
              <td className="ad-end">
                <Link className="ad-link" href={mealPlanHref(userId, p.id)} prefetch={false}>
                  {t("inspect_plan", locale)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
