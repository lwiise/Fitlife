import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { FamiliesSkeleton } from "../../_families/FamiliesSkeleton";
import "../../_families/families.css";

/** The families page's skeleton (see FamiliesSkeleton), in the admin's language. */
export default async function FamiliesLoading() {
  const locale = await getAdminLocale();
  return <FamiliesSkeleton label={t("sh_pal_loading", locale)} />;
}
