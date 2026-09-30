import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { SubscriberRouteSkeleton } from "@/app/admin/_family/RouteSkeleton";
import "@/app/admin/_family/family.css";

/**
 * The loading state of a family and its child views (health, a meal plan, a
 * program): Next shows this segment's loading.tsx for all four, so the shape
 * follows the path being opened (SubscriberRouteSkeleton). The family page's
 * shape is its head, the tab bar and a tab body. A tab switch does not show
 * it — the page stays on screen while the next tab's body streams in.
 *
 * Prefetching never renders the pages behind it, whose render writes the PDPL
 * audit row: without PPR (next.config enables neither PPR nor
 * cacheComponents), a link's default prefetch stops at the first loading
 * boundary, and sends only the route's shape when there is none. So a view
 * is logged only when someone opens it. A `prefetch={true}` link to any page
 * here would break that — it renders the whole page, audit row included.
 */
export default async function SubscriberLoading() {
  const locale = await getAdminLocale();
  return (
    <SubscriberRouteSkeleton
      labels={{ family: t("fp_loading", locale), view: t("fp_loading_view", locale) }}
    />
  );
}
