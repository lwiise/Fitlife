import { PRICING_TIERS, type Tier } from "@fitlife/config";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import {
  buildOverviewView,
  buildSubscriberRows,
  filterSortPaginate,
  loadAdminDataset,
} from "@/lib/admin/queries";
import { getAdminLocale } from "@/lib/admin/locale";
import type { SubscriberSortKey } from "@/lib/admin/types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { statusLabel, t, tierLabel } from "@/lib/admin/i18n";
import { AdminTopBar } from "./_components/AdminTopBar";
import { RevenueChartSection } from "./_components/RevenueChartSection";
import { AiCostStrip } from "./_components/AiCostStrip";
import { FilterBar } from "./_components/FilterBar";
import { SubscriberTable } from "./_components/SubscriberTable";
import { Pagination } from "./_components/Pagination";
import { flatten, type RawParams } from "./_components/searchParams";

const SORT_KEYS: SubscriberSortKey[] = [
  "signupAt",
  "lastActivityAt",
  "lifetimeAiCostUsd",
  "plansGenerated",
  "beneficiaries",
  "displayName",
  "status",
];
const STATUS_VALUES = ["trialing", "active", "past_due", "cancelled", "expired"];

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const admin = await requireAdmin();
  const locale = await getAdminLocale();

  const params = flatten(await searchParams);
  const baseParams = params;
  const currency: Currency = params.cur === "usd" ? "usd" : "sar";

  const dataset = await loadAdminDataset();
  const overview = buildOverviewView(dataset, {
    metric: params.metric,
    metrics: params.metrics,
    range: params.range,
    from: params.from,
    to: params.to,
    interval: params.interval,
    cmp: params.cmp,
  });
  const rows = buildSubscriberRows(dataset);

  const sort = SORT_KEYS.includes(params.sort as SubscriberSortKey)
    ? (params.sort as SubscriberSortKey)
    : "signupAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const list = filterSortPaginate(rows, {
    search: params.search,
    tier: params.tier,
    status: params.status,
    sort,
    dir,
    page,
  });

  // PDPL: record the list access (who / filters / window / when).
  await logAdminAccess({
    adminUserId: admin.userId,
    action: "view_subscriber_list",
    detail: {
      total: list.total,
      page: list.page,
      filters: {
        search: params.search ?? null,
        tier: params.tier ?? null,
        status: params.status ?? null,
      },
      metric: overview.selectedMetric,
      range: overview.preset,
      interval: overview.interval,
      cmp: overview.comparisonOn,
      cur: currency,
      section: "overview_v2",
    },
  });

  const tierOptions = (Object.keys(PRICING_TIERS) as Tier[]).map((tier) => ({
    value: tier,
    label: tierLabel(tier, locale, PRICING_TIERS[tier].name_ar),
  }));
  const statusOptions = STATUS_VALUES.map((s) => ({
    value: s,
    label: statusLabel(s, locale),
  }));

  return (
    <>
      <AdminTopBar locale={locale} activeNav="overview" adminEmail={admin.email} />

      <main className="container-app space-y-6 py-6">
        <h1 className="sr-only">{t("nav_overview", locale)}</h1>
        {overview.subscriberCount === 0 ? (
          <EmptyState locale={locale} />
        ) : (
          <>
            <RevenueChartSection
              view={overview}
              baseParams={baseParams}
              locale={locale}
            />

            <AiCostStrip
              view={overview}
              currency={currency}
              baseParams={baseParams}
              locale={locale}
            />

            {dataset.truncated.length > 0 ? (
              <p className="rounded-lg border border-brand-warm-orange/30 bg-brand-warm-orange/10 px-3 py-2 text-sm text-brand-ink">
                {t("truncated_warning", locale)}
              </p>
            ) : null}

            <section className="space-y-3" aria-labelledby="admin-subscribers-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="admin-subscribers-heading"
                  className="adm-h2 text-brand-ink"
                >
                  {t("table_title", locale)}
                </h2>
                <FilterBar
                  tiers={tierOptions}
                  statuses={statusOptions}
                  labels={{
                    search: t("search_placeholder", locale),
                    tier: t("filter_tier", locale),
                    status: t("filter_status", locale),
                    all: t("filter_all", locale),
                  }}
                />
              </div>

              <SubscriberTable
                result={list}
                baseParams={baseParams}
                sortState={{ sort, dir }}
                currency={currency}
                locale={locale}
              />

              <Pagination
                page={list.page}
                pageCount={list.pageCount}
                total={list.total}
                baseParams={baseParams}
                locale={locale}
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}

function EmptyState({ locale }: { locale: AdminLocale }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-brand-ink/15 bg-surface-elevated py-24 text-center">
      <p className="adm-h2 text-brand-ink">{t("table_empty", locale)}</p>
    </div>
  );
}
