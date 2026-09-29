import type { RunKind, RunRow } from "@/lib/admin/console-types";
import { fmtMoney, fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { genStatusLabel, t } from "@/lib/admin/i18n";
import { fmtDateTime, fmtDuration, runStatusTone } from "./helpers";
import { ErrorText, Ltr, Pill } from "./parts";

const KIND_KEY = { meal: "fm_kind_meal", workout: "fm_kind_workout" } as const;
const KIND_TONE = { meal: "pur", workout: "info" } as const;

/** A run's kind as a plain chip («وجبات» purple, «تمارين» blue). */
export function RunKindChip({ kind, locale }: { kind: RunKind; locale: AdminLocale }) {
  return (
    <Pill tone={KIND_TONE[kind]} plain>
      {t(KIND_KEY[kind], locale)}
    </Pill>
  );
}

/**
 * Every generation run, meal and exercise, newest first (the prototype's
 * `runsTable` plus the model column the old page had): when, kind, status,
 * duration, tokens in/out, cost, model, error. Costs keep four decimals so a
 * small run never reads as zero.
 */
export function RunsTable({
  runs,
  locale,
  currency,
}: {
  runs: readonly RunRow[];
  locale: AdminLocale;
  currency: Currency;
}) {
  if (runs.length === 0) return <div className="ad-empty">{t("no_generations", locale)}</div>;
  const n = (v: number | null) => (v != null ? fmtNumber(v, locale) : "—");
  return (
    <div className="ad-tbl-wrap">
      <table className="ad-tbl" aria-label={t("section_generations", locale)}>
        <thead>
          <tr>
            <th scope="col">{t("col_when", locale)}</th>
            <th scope="col">{t("fm_kind", locale)}</th>
            <th scope="col">{t("col_status", locale)}</th>
            <th scope="col" className="ad-end">
              {t("field_duration", locale)}
            </th>
            <th scope="col" className="ad-end">
              {t("fm_tokens_head", locale)}
            </th>
            <th scope="col" className="ad-end">
              {t("field_cost", locale)}
            </th>
            <th scope="col">{t("field_model", locale)}</th>
            <th scope="col">{t("field_error", locale)}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>
                <time dateTime={run.createdAt}>{fmtDateTime(run.createdAt, locale)}</time>
              </td>
              <td>
                <RunKindChip kind={run.kind} locale={locale} />
              </td>
              <td>
                <Pill tone={runStatusTone(run.status)}>{genStatusLabel(run.status, locale)}</Pill>
              </td>
              <td className="ad-end ad-num">{fmtDuration(run.durationMs, locale)}</td>
              <td className="ad-end ad-num ad-muted">
                {n(run.tokensIn)} / {n(run.tokensOut)}
              </td>
              <td className="ad-end ad-num">
                {run.costUsd != null ? fmtMoney(run.costUsd, currency, locale, 4, 4) : "—"}
              </td>
              <td className="ad-muted">{run.model ? <Ltr mono>{run.model}</Ltr> : "—"}</td>
              <td className="ad-err">
                {run.errorMessage ? <ErrorText text={run.errorMessage} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
