import type { InsightsView } from "@/lib/admin/insights";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtMonth, fmtNumber, fmtSar } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { DetailCard } from "../DetailCard";
import { ChartFrame } from "../ChartFrame";
import { BarChart } from "../BarChart";
import { LineChart } from "../LineChart";
import { WaterfallChart } from "../WaterfallChart";

const allZero = (values: number[]) => values.every((v) => v === 0);

/** Section 1 — Are we growing? New signups, cumulative growth, MRR movement. */
export function GrowthSection({
  view,
  locale,
}: {
  view: InsightsView;
  locale: AdminLocale;
}) {
  const signupBars = view.newSignups.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.value,
    valueLabel: fmtNumber(p.value, locale),
  }));
  const growthLine = view.cumulativeSubscribers.map((p) => ({
    label: fmtMonth(p.monthStart, locale),
    value: p.value,
    valueLabel: fmtNumber(p.value, locale),
  }));
  const waterfall = view.mrrMovement.map((m) => ({
    label: fmtMonth(m.monthStart, locale),
    up: m.newSar,
    down: m.churnedSar,
    net: m.netSar,
    upLabel: fmtSar(m.newSar, locale),
    downLabel: fmtSar(m.churnedSar, locale),
    netLabel: fmtSar(m.netSar, locale),
  }));

  return (
    <section aria-labelledby="sec-growth" className="space-y-3">
      <h2 id="sec-growth" className="text-lg font-bold text-brand-ink">
        {t("section_growth", locale)}
      </h2>

      <DetailCard title={t("chart_mrr_movement", locale)} titleAs="h3">
        <ChartFrame
          ariaLabel={t("chart_mrr_movement", locale)}
          locale={locale}
          note={t("approx_no_expansion", locale)}
          state={waterfall.every((d) => d.up === 0 && d.down === 0) ? "empty" : "ready"}
        >
          <WaterfallChart
            data={waterfall}
            ariaLabel={t("chart_mrr_movement", locale)}
            legend={{
              up: t("mrr_new", locale),
              down: t("mrr_churned", locale),
              net: t("mrr_net", locale),
            }}
          />
        </ChartFrame>
      </DetailCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard title={t("chart_growth", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("chart_growth", locale)}
            locale={locale}
            state={allZero(growthLine.map((d) => d.value)) ? "empty" : "ready"}
          >
            <LineChart data={growthLine} ariaLabel={t("chart_growth", locale)} tone="purple" area />
          </ChartFrame>
        </DetailCard>
        <DetailCard title={t("chart_signups", locale)} titleAs="h3">
          <ChartFrame
            ariaLabel={t("chart_signups", locale)}
            locale={locale}
            state={allZero(signupBars.map((d) => d.value)) ? "empty" : "ready"}
          >
            <BarChart data={signupBars} ariaLabel={t("chart_signups", locale)} tone="purple" />
          </ChartFrame>
        </DetailCard>
      </div>
    </section>
  );
}
