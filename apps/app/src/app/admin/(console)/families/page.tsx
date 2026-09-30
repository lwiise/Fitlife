import { PRICING_TIERS, type Tier } from "@fitlife/config";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { parseFamilyListQuery, parseFamilyPanelState } from "@/lib/admin/familyList";
import { tierLabel } from "@/lib/admin/i18n";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
import { loadFamilyList } from "@/lib/admin/queries";
import { FamiliesConsole } from "../../_families/FamiliesConsole";
import { statusFilterValues, statusOptionLabel } from "../../_families/listModel";
import { familyRowTexts } from "../../_families/rowText";
import "../../_families/families.css";

/**
 * /admin/families — every family, with the side panel (Concept A · Console).
 *
 * The server's part is one round of parallel reads: the PDPL audit row goes
 * out alongside the data, never before or after it (it records the URL's view
 * and filters, not the result, so it waits on nothing), and the families come
 * from the 60s-cached dataset as lean rows. From then on the list is client
 * state — search, filters, sort, paging, views and the panel never come back
 * here; the URL only seeds the first render. Display strings whose format
 * depends on the ICU build (money, dates, relative times) are formatted here,
 * once, so the server render and the hydrating client print the same text.
 */
export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const query = parseFamilyListQuery(params);
  const panel = parseFamilyPanelState(params);

  const [, list, locale, currency] = await Promise.all([
    logAdminAccess({
      adminUserId: admin.userId,
      action: "view_subscriber_list",
      detail: {
        section: "families",
        view: query.view,
        filters: {
          q: query.q || null,
          tier: query.tier || null,
          status: query.status || null,
        },
      },
    }),
    loadFamilyList(),
    getAdminLocale(),
    getAdminCurrency(),
  ]);

  const texts = familyRowTexts(list.rows, { locale, currency, nowIso: new Date().toISOString() });
  const tierOptions = (Object.keys(PRICING_TIERS) as Tier[]).map((tier) => ({
    value: tier,
    label: tierLabel(tier, locale, PRICING_TIERS[tier].name_ar),
  }));
  const statusOptions = statusFilterValues(
    list.rows.map((row) => row.status),
    query.status,
  ).map((status) => ({ value: status, label: statusOptionLabel(status, locale) }));

  return (
    <FamiliesConsole
      rows={list.rows}
      texts={texts}
      initialQuery={query}
      initialPanel={panel}
      locale={locale}
      currency={currency}
      tierOptions={tierOptions}
      statusOptions={statusOptions}
      truncated={list.truncated}
    />
  );
}
