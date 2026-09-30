import { notFound } from "next/navigation";
import { WorkoutPlanSchema } from "@fitlife/plan-engine";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadWorkoutForInspect } from "@/lib/admin/family";
import { isUuid } from "@/lib/admin/familyList";
import { t } from "@/lib/admin/i18n";
import { getAdminLocale } from "@/lib/admin/locale";
import { WorkoutViewer } from "@/app/plan/WorkoutViewer";
import { Card, Empty } from "@/app/admin/_ui";
import { loadFamilyName } from "@/app/admin/_family/data";
import { ViewerHead } from "@/app/admin/_family/ViewerHead";
import "@/app/admin/_family/family.css";

/**
 * A family's exercise program as the family sees it — the real WorkoutViewer
 * in its read-only mode (no links into the customer's own screens, no «أنتِ»
 * marker, no session marking), the program twin of the meal-plan view. A
 * program is generated from the whole trainee profile (pregnancy,
 * postpartum, injuries), so opening it records a `view_plan_data` audit event
 * (PDPL), written alongside the read. The program must belong to the family
 * in the URL; content that does not validate shows an explanation instead.
 */
export default async function FamilyProgramPage({
  params,
}: {
  params: Promise<{ userId: string; planId: string }>;
}) {
  const admin = await requireAdmin();
  const { userId: rawUser, planId: rawPlan } = await params;
  if (!isUuid(rawUser) || !isUuid(rawPlan)) notFound();
  const userId = rawUser.toLowerCase();
  const planId = rawPlan.toLowerCase();

  const [, program, familyName, locale] = await Promise.all([
    logAdminAccess({
      adminUserId: admin.userId,
      subscriberId: userId,
      action: "view_plan_data",
      detail: { planId, kind: "workout" },
    }),
    loadWorkoutForInspect(userId, planId),
    loadFamilyName(userId),
    getAdminLocale(),
  ]);
  if (!program) notFound();

  const parsed = WorkoutPlanSchema.safeParse(program.planData);

  return (
    <div className="ad-a-page">
      <div className="ad-a-page-in">
        <ViewerHead
          userId={userId}
          backTab="exercise"
          familyName={familyName}
          title={t("fp_program_title", locale)}
          status={program.status}
          createdAt={program.createdAt}
          generatedAt={program.generatedAt}
          audit={t("fp_program_logged", locale)}
          locale={locale}
        />
        {parsed.success ? (
          // Program content is Arabic: right-to-left and tagged Arabic even in
          // the English console.
          <div className="ad-viewer" dir="rtl" lang="ar">
            <WorkoutViewer plan={parsed.data} readOnly />
          </div>
        ) : (
          <Card>
            <Empty title={t("fp_program_unavailable", locale)}>
              {t("fp_program_no_data", locale)}
            </Empty>
          </Card>
        )}
      </div>
    </div>
  );
}
