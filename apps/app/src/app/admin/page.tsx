import { PRICING_TIERS, type Tier } from "@fitlife/config";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import {
  buildOverviewActionQueue,
  buildSubscriberRows,
  computeKpis,
  filterSortPaginate,
  loadAdminDataset,
} from "@/lib/admin/queries";
import { getPeriodPair } from "@/lib/admin/period";
import { getAdminLocale } from "@/lib/admin/locale";
import type { SubscriberSortKey } from "@/lib/admin/types";
import type { AdminLocale } from "@/lib/admin/format";
import { statusLabel, t, tierLabel } from "@/lib/admin/i18n";
import { AdminTopBar } from "./_components/AdminTopBar";
import { KpiStrip } from "./_components/KpiStrip";
import { ActionQueue } from "./_components/ActionQueue";
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

  const periodDays = params.days === "90" ? 90 : 30;

  const dataset = await loadAdminDataset();
  const kpis = computeKpis(dataset, getPeriodPair(periodDays));
  const rows = buildSubscriberRows(dataset);
  const actionItems = buildOverviewActionQueue(dataset);

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

  // PDPL: record the list access (who / filters / when).
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
      periodDays,
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
      <AdminTopBar
        locale={locale}
        activeNav="overview"
        periodDays={periodDays}
        baseParams={baseParams}
        adminEmail={admin.email}
      />

      <main className="container-app space-y-6 py-6">
        <h1 className="sr-only">{t("nav_overview", locale)}</h1>
        {kpis.subscriberCount === 0 ? (
          <EmptyState locale={locale} />
        ) : (
          <>
            <KpiStrip kpis={kpis} locale={locale} />

            {dataset.truncated.length > 0 ? (
              <p className="rounded-lg border border-brand-warm-orange/30 bg-brand-warm-orange/10 px-3 py-2 text-sm text-brand-ink">
                {t("truncated_warning", locale)}
              </p>
            ) : null}

            <ActionQueue items={actionItems} locale={locale} />

            <section className="space-y-3" aria-labelledby="admin-subscribers-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="admin-subscribers-heading"
                  className="text-lg font-bold text-brand-ink"
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
    <div className="grid place-items-center rounded-2xl border border-dashed border-brand-ink/15 bg-surface-elevated py-24 text-center">
      <p className="text-base font-medium text-brand-ink">
        {t("table_empty", locale)}
      </p>
    </div>
  );
}
