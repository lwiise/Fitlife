import { PRICING_TIERS, type Tier } from "@fitlife/config";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { parseFamilyListQuery, parseFamilyPanelState } from "@/lib/admin/familyList";
import { tierLabel } from "@/lib/admin/i18n";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
import { loadFamilyList } from "@/lib/admin/queries";
import { FamiliesConsole } from "../../_families/FamiliesConsole";
import {
  pageRows,
  startingQuery,
  statusFilterValues,
  statusOptionLabel,
} from "../../_families/listModel";
import { packFamilyRows } from "../../_families/rowCodec";
import { familyRowTexts } from "../../_families/rowText";
import "../../_families/families.css";
import { pageMetadata } from "../../_shell/titles";

/**
 * «العائلات | لوحة تحكم Fit Life». The saved view is not in the title: it
 * changes in place, without a navigation that could retitle the page.
 */
export function generateMetadata() {
  return pageMetadata("sh_families");
}

/**
 * /admin/families — every family, with the side panel (Concept A · Console).
 *
 * The server's part is one round of parallel reads. The families come from
 * the 60s-cached dataset as lean rows, and the PDPL audit row records how
 * many of them this load hands the browser (`total` — every family, since the
 * filters run there) next to the URL's view and filters: so it is written as
 * soon as the list is in hand, still beside the locale and currency reads,
 * and the page renders only once it is in (spec §2.4). A warm dataset read is
 * a cache hit, so the insert starts at once. From then on the list is client
 * state — search, filters, sort, paging, views and the panel never come back
 * here; the URL only seeds the first render.
 *
 * The payload is kept to what the browser needs. The rows travel as tuples
 * (rowCodec.ts — the field names cross once, not once per family). Display
 * strings whose format depends on the ICU build (money, dates, relative
 * times) are formatted here only for the rows the first render shows — the
 * page the URL names, and the open family — so the server render and the
 * hydrating client print the same text; the console formats any other row
 * itself, from the same "now", when it first shows.
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

  const listRead = loadFamilyList();
  const [list, , locale, currency] = await Promise.all([
    listRead,
    listRead.then((loaded) =>
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
          // The family records this load discloses: the whole list.
          total: loaded.rows.length,
        },
      }),
    ),
    getAdminLocale(),
    getAdminCurrency(),
  ]);

  // The rows the first render shows, as the console will compute them: their
  // strings are hydrated, so the server formats them; the rest are the
  // console's to format (FamilyRowText).
  const nowIso = new Date().toISOString();
  const shown = pageRows(list.rows, startingQuery(list.rows, query, panel.open));
  const openRow = panel.open ? list.rows.find((row) => row.userId === panel.open) : undefined;
  if (openRow && !shown.includes(openRow)) shown.push(openRow);
  const texts = familyRowTexts(shown, { locale, currency, nowIso });
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
      rows={packFamilyRows(list.rows)}
      texts={texts}
      nowIso={nowIso}
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
