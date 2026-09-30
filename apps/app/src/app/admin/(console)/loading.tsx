import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { OverviewSkeleton } from "../_overview/OverviewSkeleton";
import "../_overview/overview.css";

/** The Overview's skeleton (see OverviewSkeleton), in the admin's language. */
export default async function OverviewLoading() {
  const locale = await getAdminLocale();
  return <OverviewSkeleton label={t("ov_loading", locale)} />;
}
