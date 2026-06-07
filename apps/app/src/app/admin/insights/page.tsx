import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { getAdminLocale } from "@/lib/admin/locale";
import {
  computeOps,
  computeTrends,
  loadInsightsDataset,
  type InsightsOps,
  type InsightsTrends,
} from "@/lib/admin/insights";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtDate, fmtMonth, fmtNumber, fmtUsd } from "@/lib/admin/format";
import { statusLabel, t } from "@/lib/admin/i18n";
import { AdminTopBar } from "../_components/AdminTopBar";
import { DetailCard } from "../_components/DetailCard";
import { KpiCard } from "../_components/KpiCard";
import { BarChart } from "../_components/BarChart";
import { StackedBarChart } from "../_components/StackedBarChart";
import { FunnelChart } from "../_components/FunnelChart";

export default async function InsightsPage() {
  const admin = await requireAdmin();
  const locale = await getAdminLocale();

  const dataset = await loadInsightsDataset();
  const trends = computeTrends(dataset, 6);
  const ops = computeOps(dataset);

  await logAdminAccess({ adminUserId: admin.userId, action: "view_insights" });

  return (
    <>
      <AdminTopBar locale={locale} activeNav="insights" adminEmail={admin.email} />

      <main className="container-app space-y-6 py-6">
        <h1 className="sr-only">{t("insights_title", locale)}</h1>
        {dataset.truncated.length > 0 ? (
          <p className="rounded-lg border border-brand-warm-orange/30 bg-brand-warm-orange/10 px-3 py-2 text-sm text-brand-ink">
            {t("truncated_warning", locale)}
          </p>
        ) : null}

        <TrendsSection trends={trends} locale={locale} />
        <OpsSection ops={ops} locale={locale} />
      </main>
    </>
  );
}

function TrendsSection({
  trends,
  locale,
}: {
  trends: InsightsTrends;
  locale: AdminLocale;
}) {
  const signupBars = trends.newSignups.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.value,
    valueLabel: fmtNumber(p.value, locale),
  }));
  const growthBars = trends.cumulativeSubscribers.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.value,
    valueLabel: fmtNumber(p.value, locale),
  }));
  const costBars = trends.aiCost.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.value,
    valueLabel: fmtUsd(p.value, locale, 2),
  }));
  const genBars = trends.generations.map((g) => ({
    label: fmtMonth(g.monthStart, locale),
    completed: g.completed,
    failed: g.failed,
    totalLabel: fmtNumber(g.completed + g.failed, locale),
  }));
  const funnelSteps = [
    { key: "funnel_signups", value: trends.funnel.signups },
    { key: "funnel_onboarded", value: trends.funnel.onboarded },
    { key: "funnel_first_plan", value: trends.funnel.firstPlan },
    { key: "status_trialing", value: trends.funnel.trialing },
    { key: "status_active", value: trends.funnel.active },
  ].map((s) => ({
    label: t(s.key as Parameters<typeof t>[0], locale),
    value: s.value,
    valueLabel: fmtNumber(s.value, locale),
  }));

  return (
    <section aria-label={t("section_trends", locale)} className="space-y-3">
      <h2 className="text-lg font-bold text-brand-ink">{t("section_trends", locale)}</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          locale={locale}
          accent="yellow"
          label={t("stat_total_ai", locale)}
          value={fmtUsd(trends.totalAiCostUsd, locale, 2)}
        />
        <KpiCard
          locale={locale}
          accent="ink"
          label={t("stat_cost_per_plan", locale)}
          value={trends.costPerPlanUsd != null ? fmtUsd(trends.costPerPlanUsd, locale, 4) : "—"}
        />
        <KpiCard
          locale={locale}
          accent="ink"
          label={t("stat_cost_per_user", locale)}
          value={
            trends.costPerActiveUserUsd != null
              ? fmtUsd(trends.costPerActiveUserUsd, locale, 4)
              : "—"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard title={t("chart_growth", locale)} titleAs="h3">
          <BarChart data={growthBars} ariaLabel={t("chart_growth", locale)} tone="purple" />
        </DetailCard>
        <DetailCard title={t("chart_signups", locale)} titleAs="h3">
          <BarChart data={signupBars} ariaLabel={t("chart_signups", locale)} tone="purple" />
        </DetailCard>
        <DetailCard title={t("chart_ai_cost", locale)} titleAs="h3">
          <BarChart data={costBars} ariaLabel={t("chart_ai_cost", locale)} tone="pink" />
        </DetailCard>
        <DetailCard title={t("chart_generations", locale)} titleAs="h3">
          <StackedBarChart
            data={genBars}
            ariaLabel={t("chart_generations", locale)}
            legend={{
              completed: t("gen_completed", locale),
              failed: t("gen_failed", locale),
            }}
          />
        </DetailCard>
      </div>

      <DetailCard title={t("chart_funnel", locale)} titleAs="h3">
        <FunnelChart steps={funnelSteps} ariaLabel={t("chart_funnel", locale)} />
      </DetailCard>
    </section>
  );
}

function OpsSection({ ops, locale }: { ops: InsightsOps; locale: AdminLocale }) {
  return (
    <section aria-label={t("section_ops", locale)} className="space-y-3">
      <h2 className="text-lg font-bold text-brand-ink">{t("section_ops", locale)}</h2>

      <div className="grid gap-4 lg:grid-cols-2">
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
                    <th scope="col" className={OPS_TH}>{t("col_name", locale)}</th>
                    <th scope="col" className={OPS_TH}>{t("col_when", locale)}</th>
                    <th scope="col" className={OPS_TH}>{t("col_error", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {ops.failures.map((f, i) => (
                    <tr key={i} className="border-t border-brand-ink/5">
                      <td className={OPS_TD}>
                        <Link
                          href={`/admin/subscribers/${f.userId}`}
                          className="inline-flex min-h-11 items-center font-medium text-brand-purple-900 hover:underline"
                        >
                          {f.name}
                        </Link>
                      </td>
                      <td className={`${OPS_TD} text-brand-ink-muted`}>
                        {fmtDate(f.createdAt, locale)}
                      </td>
                      <td className={`${OPS_TD} max-w-xs truncate text-xs text-red-700`} dir="ltr">
                        {f.error ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ops.failureTotal > ops.failures.length ? (
                <p className="px-4 py-2 text-xs text-brand-ink-muted">
                  + {fmtNumber(ops.failureTotal - ops.failures.length, locale)}{" "}
                  {t("ops_and_more", locale)}
                </p>
              ) : null}
            </div>
          )}
        </DetailCard>

        <DetailCard
          title={`${t("ops_medical", locale)} (${fmtNumber(ops.medicalGate.length, locale)})`}
          titleAs="h3"
        >
          <OpsUserList users={ops.medicalGate} locale={locale} />
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

function OpsUserList({
  users,
  locale,
}: {
  users: Array<{ userId: string; name: string }>;
  locale: AdminLocale;
}) {
  if (users.length === 0)
    return <p className="text-sm text-brand-ink-muted">{t("ops_none", locale)}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {users.map((u, i) => (
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
  );
}

const OPS_TH =
  "whitespace-nowrap px-4 py-2.5 text-start text-xs font-semibold uppercase text-brand-ink-muted";
const OPS_TD = "whitespace-nowrap px-4 py-2.5 text-sm text-brand-ink";
