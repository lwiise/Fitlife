import Link from "next/link";
import { PRICING_TIERS, type Tier } from "@fitlife/config";
import type { InsightsView } from "@/lib/admin/insights";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtDate, fmtNumber } from "@/lib/admin/format";
import { t, tierLabel } from "@/lib/admin/i18n";
import { DetailCard } from "../DetailCard";
import { ChartFrame } from "../ChartFrame";
import { FunnelChart } from "../FunnelChart";
import { Gauge } from "../Gauge";

function tierName(tier: string | null, locale: AdminLocale): string {
  const arName = tier && tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
  return tierLabel(tier, locale, arName);
}

const TH = "whitespace-nowrap px-4 py-2.5 text-start text-xs font-semibold uppercase text-brand-ink-muted";
const TD = "whitespace-nowrap px-4 py-2.5 text-sm text-brand-ink";

/** Section 3 — Are we converting? Funnel, activation, trials-expiring list. */
export function ConversionSection({
  view,
  locale,
}: {
  view: InsightsView;
  locale: AdminLocale;
}) {
  const funnelSteps = [
    { key: "funnel_signups", value: view.funnel.signups },
    { key: "funnel_onboarded", value: view.funnel.onboarded },
    { key: "funnel_first_plan", value: view.funnel.firstPlan },
    { key: "status_trialing", value: view.funnel.trialing },
    { key: "status_active", value: view.funnel.active },
  ].map((s) => ({
    label: t(s.key as Parameters<typeof t>[0], locale),
    value: s.value,
    valueLabel: fmtNumber(s.value, locale),
  }));
  const within7 = view.trials.filter((tr) => tr.daysLeft <= 7).length;

  return (
    <section aria-labelledby="sec-conversion" className="space-y-3">
      <h2 id="sec-conversion" className="text-lg font-bold text-brand-ink">
        {t("section_conversion", locale)}
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <DetailCard title={t("chart_funnel", locale)} titleAs="h3" className="lg:col-span-2">
          <ChartFrame
            ariaLabel={t("chart_funnel", locale)}
            locale={locale}
            state={view.funnel.signups === 0 ? "empty" : "ready"}
          >
            <FunnelChart steps={funnelSteps} ariaLabel={t("chart_funnel", locale)} />
          </ChartFrame>
        </DetailCard>

        <DetailCard title={t("conv_activation", locale)} titleAs="h3">
          <div className="flex flex-col items-center gap-2">
            <Gauge
              value={view.activation.rate}
              ariaLabel={t("conv_activation", locale)}
              locale={locale}
              tone="emerald"
            />
            <p className="text-center text-xs leading-snug text-brand-ink-muted">
              {t("conv_activation_hint", locale)} ({fmtNumber(view.activation.activated, locale)}/
              {fmtNumber(view.activation.total, locale)})
            </p>
          </div>
        </DetailCard>
      </div>

      <DetailCard
        title={`${t("conv_trials_expiring", locale)} · ${t("trials_next_7", locale)}: ${fmtNumber(within7, locale)} · ${t("trials_next_14", locale)}: ${fmtNumber(view.trials.length, locale)}`}
        titleAs="h3"
        className="p-0"
      >
        {view.trials.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-ink-muted">{t("ops_none", locale)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              <caption className="sr-only">{t("conv_trials_expiring", locale)}</caption>
              <thead className="border-b border-brand-ink/10">
                <tr>
                  <th scope="col" className={TH}>{t("col_name", locale)}</th>
                  <th scope="col" className={TH}>{t("col_tier", locale)}</th>
                  <th scope="col" className={TH}>{t("col_trial_ends", locale)}</th>
                  <th scope="col" className={TH}>{t("col_days_left", locale)}</th>
                  <th scope="col" className={TH}>{t("col_plan_yn", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {view.trials.map((tr) => (
                  <tr key={tr.userId} className="border-t border-brand-ink/5">
                    <td className={TD}>
                      <Link
                        href={`/admin/subscribers/${tr.userId}`}
                        className="inline-flex min-h-11 items-center font-medium text-brand-purple-900 hover:underline"
                      >
                        {tr.name ?? "—"}
                      </Link>
                    </td>
                    <td className={`${TD} text-brand-ink-muted`}>{tierName(tr.tier, locale)}</td>
                    <td className={`${TD} text-brand-ink-muted`}>{fmtDate(tr.trialEndsAt, locale)}</td>
                    <td className={`${TD} tabular-nums`} dir="ltr">
                      {fmtNumber(tr.daysLeft, locale)} {t("days_unit", locale)}
                    </td>
                    <td className={TD}>
                      {tr.planGenerated ? (
                        <span className="text-brand-emerald">{t("yes", locale)}</span>
                      ) : (
                        <span className="text-brand-ink-muted">{t("no", locale)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailCard>
    </section>
  );
}
