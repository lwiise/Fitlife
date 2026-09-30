import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { buildOverviewView, loadAdminDataset } from "@/lib/admin/queries";
import { loadEngagementStats, type EngagementStats } from "@/lib/admin/engagement";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { Card } from "../_ui/Card";
import { Empty, Note } from "../_ui/Note";
import { CostTiles } from "../_overview/CostTiles";
import { EngagementTiles } from "../_overview/EngagementTiles";
import { MetricBoard } from "../_overview/MetricBoard";
import { OverviewScope } from "../_overview/OverviewScope";
import { RangeControls } from "../_overview/RangeControls";
import { boardLabels, buildOverviewModel, rangeLabels } from "../_overview/model";
import { flattenParams, overviewAuditDetail, type RawParams } from "../_overview/urls";
import "../_overview/overview.css";

/**
 * /admin — the Overview (Concept A · Console): headline metrics, the chart,
 * AI cost and the engagement layer, all scoped to the URL's range.
 *
 * One round of parallel reads: the audit row (PDPL) is written alongside the
 * data, never before or after it, and records the RAW parameters so it does
 * not wait on anything. The dataset and the engagement counters are cached
 * (60s). Range, interval and metric-set changes navigate in a transition —
 * the page stays on screen, dimmed, until the new figures arrive.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const admin = await requireAdmin();
  const params = flattenParams(await searchParams);
  const currencyRead = getAdminCurrency();

  const [, dataset, engagement, locale, currency] = await Promise.all([
    currencyRead.then((cur) =>
      logAdminAccess({
        adminUserId: admin.userId,
        action: "view_subscriber_list",
        detail: overviewAuditDetail(params, cur),
      }),
    ),
    loadAdminDataset(),
    // Secondary figures: a failed read shows «—» instead of failing the page.
    loadEngagementStats().catch((error: unknown): EngagementStats | null => {
      console.error("[admin] engagement stats failed", error);
      return null;
    }),
    getAdminLocale(),
    currencyRead,
  ]);

  const view = buildOverviewView(dataset, {
    metric: params.metric,
    metrics: params.metrics,
    range: params.range,
    from: params.from,
    to: params.to,
    interval: params.interval,
    cmp: params.cmp,
  });
  const title = t("nav_overview", locale);

  if (view.subscriberCount === 0) {
    return (
      <div className="ad-a-ov">
        <div className="ad-a-ov-in ad-ov-in">
          <div className="ad-ovhead">
            <h1>{title}</h1>
          </div>
          <Card>
            <Empty title={t("table_empty", locale)}>{t("ov_empty_body", locale)}</Empty>
          </Card>
        </div>
      </div>
    );
  }

  const model = buildOverviewModel({ view, engagement, locale, currency });

  return (
    <div className="ad-a-ov">
      <OverviewScope
        busyLabel={t("ov_updating", locale)}
        metrics={model.board.metrics.map((m) => m.key)}
        head={
          <div className="ad-ovhead">
            <h1>{title}</h1>
            <RangeControls head={model.head} labels={rangeLabels(locale)} />
          </div>
        }
      >
        {dataset.truncated.length > 0 ? (
          <Note tone="warn">{t("truncated_warning", locale)}</Note>
        ) : null}
        <MetricBoard
          board={model.board}
          labels={boardLabels(locale)}
          locale={locale}
          currency={currency}
        />
        <CostTiles cost={model.cost} vsPrior={t("vs_prior", locale)} rtl={locale === "ar"} />
        <EngagementTiles engagement={model.engagement} />
      </OverviewScope>
    </div>
  );
}
