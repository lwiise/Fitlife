import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { Skeleton, SkeletonGroup } from "../../_ui/Skeleton";

/**
 * Insights' loading state, inside the console frame like the page itself:
 * the frame already draws the top bar and owns <main>, so this is only the
 * page's heading and three sections of chart blocks (the pulse stops under
 * reduced motion).
 */
export default async function InsightsLoading() {
  const locale = await getAdminLocale();
  return (
    <div className="ad-a-ov">
      <SkeletonGroup label={t("loading_label", locale)} className="ad-a-ov-in">
        <Skeleton shape="title" width={30} />
        {[0, 1, 2].map((s) => (
          <div key={s} className="ad-stack">
            <Skeleton shape="text" width={20} />
            <div className="ad-grid-2">
              <Skeleton shape="block" />
              <Skeleton shape="block" />
            </div>
          </div>
        ))}
      </SkeletonGroup>
    </div>
  );
}
