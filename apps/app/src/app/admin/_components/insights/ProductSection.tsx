import Link from "next/link";
import type { InsightsView } from "@/lib/admin/insights";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtDate, fmtMonth, fmtNumber, fmtPct } from "@/lib/admin/format";
import { failureCauseLabel, localeName, statusLabel, t } from "@/lib/admin/i18n";
import { DetailCard } from "../DetailCard";
import { ChartFrame } from "../ChartFrame";
import { LineChart } from "../LineChart";
import { BarChart } from "../BarChart";
import { DonutChart } from "../DonutChart";
import { Gauge } from "../Gauge";
import { KpiCard } from "../KpiCard";

const TH = "whitespace-nowrap px-4 py-2.5 text-start text-xs font-semibold uppercase text-brand-ink-muted";
const TD = "whitespace-nowrap px-4 py-2.5 text-sm text-brand-ink";

/** Section 5 — Is the product delivering? Quality, freshness, engagement, ops. */
export function ProductSection({
  view,
  locale,
}: {
  view: InsightsView;
  locale: AdminLocale;
}) {
  const successLine = view.successRate.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.successPct ?? 0,
    valueLabel: fmtPct(p.successPct, locale),
  }));
  const successEmpty = view.successRate.every((p) => p.successPct == null);

  const failureBars = view.failureBuckets.map((b) => ({
    label: failureCauseLabel(b.cause, locale),
    value: b.count,
    valueLabel: fmtNumber(b.count, locale),
  }));

  const localeDonut = (rows: { locale: string; count: number; pct: number }[]) =>
    rows.map((l) => ({
      label: localeName(l.locale),
      value: l.count,
      valueLabel: `${fmtNumber(l.count, locale)} · ${fmtPct(l.pct, locale)}`,
    }));

  const ops = view.ops;

  return (
    <section aria-labelledby="sec-product" className="space-y-3">
      <h2 id="sec-product" className="text-lg font-bold text-brand-ink">
        {t("section_product", locale)}
      </h2>

      {/* Plan freshness + engagement */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DetailCard title={t("chart_plan_freshness", locale)} titleAs="h3">
          <div className="flex flex-col items-center gap-2">
            <Gauge
              value={view.planFreshness.rate}
              ariaLabel={t("chart_plan_freshness", locale)}
              locale={locale}
              tone="emerald"
            />
            <p className="text-center text-xs leading-snug text-brand-ink-muted">
              {t("freshness_hint", locale)} ({fmtNumber(view.planFreshness.freshCount, locale)}/
              {fmtNumber(view.planFreshness.activeHouseholds, locale)})
            </p>
            <p className="text-center text-xs text-brand-ink-muted">{t("approx_freshness", locale)}</p>
          </div>
        </DetailCard>
        <KpiCard
          locale={locale}
          accent="emerald"
          label={t("engagement_7d", locale)}
          value={fmtPct(view.engagement.active7Pct, locale)}
          hint={
            <span dir="auto">
              {fmtNumber(view.engagement.active7, locale)} / {fmtNumber(view.engagement.base, locale)}
            </span>
          }
        />
        <KpiCard
          locale={locale}
          accent="purple"
          label={t("engagement_30d", locale)}
          value={fmtPct(view.engagement.active30Pct, locale)}
          hint={
            <span dir="auto">
              {fmtNumber(view.engagement.active30, locale)} / {fmtNumber(view.engagement.base, locale)}
            </span>
          }
        />
      </div>

      {/* Success rate + failures by cause */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard title={t("chart_success_rate", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("chart_success_rate", locale)}
            locale={locale}
            state={successEmpty ? "empty" : "ready"}
          >
            <LineChart data={successLine} ariaLabel={t("chart_success_rate", locale)} tone="emerald" />
          </ChartFrame>
        </DetailCard>
        <DetailCard title={t("chart_failures_by_cause", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("chart_failures_by_cause", locale)}
            locale={locale}
            state={failureBars.length === 0 ? "empty" : "ready"}
          >
            <BarChart data={failureBars} ariaLabel={t("chart_failures_by_cause", locale)} tone="pink" />
          </ChartFrame>
        </DetailCard>
      </div>

      {/* Locale mix */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard title={t("chart_locale_users", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("chart_locale_users", locale)}
            locale={locale}
            state={view.localeMix.users.length === 0 ? "empty" : "ready"}
          >
            <DonutChart data={localeDonut(view.localeMix.users)} ariaLabel={t("chart_locale_users", locale)} />
          </ChartFrame>
        </DetailCard>
        <DetailCard title={t("chart_locale_cooks", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("chart_locale_cooks", locale)}
            locale={locale}
            state={view.localeMix.cooks.length === 0 ? "empty" : "ready"}
          >
            <DonutChart data={localeDonut(view.localeMix.cooks)} ariaLabel={t("chart_locale_cooks", locale)} />
          </ChartFrame>
        </DetailCard>
      </div>

      {/* Raw failure log + ops drill-downs */}
      <DetailCard
        title={`${t("ops_failures", locale)} (${fmtNumber(ops.failureTotal, locale)})`}
        titleAs="h3"
        className="p-0"
      >
        {ops.failures.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-ink-muted">{t("ops_none", locale)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <caption className="sr-only">{t("ops_failures", locale)}</caption>
              <thead className="border-b border-brand-ink/10">
                <tr>
                  <th scope="col" className={TH}>{t("col_name", locale)}</th>
                  <th scope="col" className={TH}>{t("col_when", locale)}</th>
                  <th scope="col" className={TH}>{t("col_error", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {ops.failures.map((f, i) => (
                  <tr key={i} className="border-t border-brand-ink/5">
                    <td className={TD}>
                      <Link
                        href={`/admin/subscribers/${f.userId}`}
                        className="inline-flex min-h-11 items-center font-medium text-brand-purple-900 hover:underline"
                      >
                        {f.name}
                      </Link>
                    </td>
                    <td className={`${TD} text-brand-ink-muted`}>{fmtDate(f.createdAt, locale)}</td>
                    <td className={`${TD} max-w-xs truncate text-xs text-red-700`} dir="ltr">
                      {f.error ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ops.failureTotal > ops.failures.length ? (
              <p className="px-4 py-2 text-xs text-brand-ink-muted">
                + {fmtNumber(ops.failureTotal - ops.failures.length, locale)} {t("ops_and_more", locale)}
              </p>
            ) : null}
          </div>
        )}
      </DetailCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <DetailCard
          title={`${t("ops_medical", locale)} (${fmtNumber(ops.medicalGate.length, locale)})`}
          titleAs="h3"
        >
          {ops.medicalGate.length === 0 ? (
            <p className="text-sm text-brand-ink-muted">{t("ops_none", locale)}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {ops.medicalGate.map((u, i) => (
                <li key={i}>
                  <Link
                    href={`/admin/subscribers/${u.userId}`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand-surface px-2.5 text-sm font-medium text-brand-purple-900 hover:underline"
                  >
                    {u.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DetailCard>

        <DetailCard title={t("ops_chat_cap", locale)} titleAs="h3">
          <p dir="ltr" className="text-2xl font-extrabold tabular-nums text-brand-ink">
            {fmtNumber(ops.chatCapToday, locale)}
          </p>
        </DetailCard>

        <DetailCard
          title={`${t("ops_billing", locale)} (${fmtNumber(ops.billing.length, locale)})`}
          titleAs="h3"
        >
          {ops.billing.length === 0 ? (
            <p className="text-sm text-brand-ink-muted">{t("ops_none", locale)}</p>
          ) : (
            <ul className="space-y-1.5">
              {ops.billing.map((b, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/admin/subscribers/${b.userId}`}
                    className="inline-flex min-h-11 items-center font-medium text-brand-purple-900 hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="text-red-700">{statusLabel(b.status, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </DetailCard>
      </div>
    </section>
  );
}
