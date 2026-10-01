import { notFound } from "next/navigation";
import { MealPlanSchema } from "@fitlife/plan-engine";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadPlanForInspect } from "@/lib/admin/detail";
import { isUuid } from "@/lib/admin/familyList";
import { t } from "@/lib/admin/i18n";
import { getAdminLocale } from "@/lib/admin/locale";
import { PlanViewer } from "@/app/plan/PlanViewer";
import { Card, Empty } from "@/app/admin/_ui";
import { loadFamilyName } from "@/app/admin/_family/data";
import { ViewerHead } from "@/app/admin/_family/ViewerHead";
import { familyPageMetadata } from "@/app/admin/_shell/titles";
import "@/app/admin/_family/family.css";

/** «الخطة الغذائية، هند القحطاني | لوحة تحكم Fit Life». */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string; planId: string }>;
}) {
  const { userId } = await params;
  return familyPageMetadata(userId, loadFamilyName, (name, locale) => [
    t("fp_tab_meal", locale),
    name,
  ]);
}

/**
 * A family's meal plan as the family sees it — the real PlanViewer, read-only
 * (no regenerate, no add-member, no PDF export), not a raw JSON dump. Plan
 * data describes a household's meals and health needs, so opening it records
 * a `view_plan_data` audit event (PDPL), written alongside the read. The plan
 * must belong to the family in the URL. Content that no longer validates
 * shows an explanation instead of the viewer.
 */
export default async function FamilyMealPlanPage({
  params,
}: {
  params: Promise<{ userId: string; planId: string }>;
}) {
  const admin = await requireAdmin();
  const { userId: rawUser, planId: rawPlan } = await params;
  if (!isUuid(rawUser) || !isUuid(rawPlan)) notFound();
  const userId = rawUser.toLowerCase();
  const planId = rawPlan.toLowerCase();

  const [, plan, familyName, locale] = await Promise.all([
    logAdminAccess({
      adminUserId: admin.userId,
      subscriberId: userId,
      action: "view_plan_data",
      detail: { planId, kind: "meal" },
    }),
    loadPlanForInspect(userId, planId),
    loadFamilyName(userId),
    getAdminLocale(),
  ]);
  if (!plan) notFound();

  const parsed = MealPlanSchema.safeParse(plan.planData);

  return (
    <div className="ad-a-page">
      <div className="ad-a-page-in">
        <ViewerHead
          userId={userId}
          backTab="meal"
          familyName={familyName}
          title={t("fp_tab_meal", locale)}
          status={plan.status}
          createdAt={plan.createdAt}
          generatedAt={plan.generatedAt}
          audit={t("plan_data_logged_note", locale)}
          locale={locale}
        />
        {parsed.success ? (
          // Plan content is Arabic: right-to-left and tagged Arabic even in
          // the English console.
          <div className="ad-viewer" dir="rtl" lang="ar">
            <PlanViewer plan={parsed.data} planId={plan.id} readOnly hideExport />
          </div>
        ) : (
          <Card>
            <Empty title={t("fp_plan_unavailable", locale)}>{t("plan_no_data", locale)}</Empty>
          </Card>
        )}
      </div>
    </div>
  );
}
