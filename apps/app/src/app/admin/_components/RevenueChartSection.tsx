import type { AdminLocale } from "@/lib/admin/format";
import type { OverviewView } from "@/lib/admin/types";
import { t } from "@/lib/admin/i18n";
import { OverviewChartControls } from "./OverviewChartControls";
import { TrendsBoard } from "./TrendsBoard";
import { InfoTooltip } from "./InfoTooltip";

export function RevenueChartSection({
  view,
  baseParams,
  locale,
}: {
  view: OverviewView;
  baseParams: Record<string, string>;
  locale: AdminLocale;
}) {
  const title = t("section_trends", locale);

  return (
    <section aria-labelledby="ov-chart-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 id="ov-chart-heading" className="adm-h2 text-brand-ink">
            {title}
          </h2>
          <InfoTooltip
            id="ov-trends-info"
            text={t("approx_snapshot", locale)}
            label={t("info_more", locale)}
          />
        </div>
        {/* Range / granularity / compare genuinely re-fetch (different buckets) →
            these stay a server-driven GET form. The metric tabs + chart switch on
            the client (TrendsBoard) since their data is already loaded. */}
        <OverviewChartControls
          locale={locale}
          preset={view.preset}
          interval={view.interval}
          comparisonOn={view.comparisonOn}
          fromValue={view.fromValue}
          toValue={view.toValue}
          baseParams={baseParams}
        />
      </div>

      <TrendsBoard view={view} baseParams={baseParams} locale={locale} />
    </section>
  );
}
