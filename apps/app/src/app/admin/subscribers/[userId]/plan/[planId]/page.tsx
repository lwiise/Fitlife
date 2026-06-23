import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { MealPlanSchema } from "@fitlife/plan-engine";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadPlanForInspect } from "@/lib/admin/detail";
import { fmtDate } from "@/lib/admin/format";
import { getAdminLocale } from "@/lib/admin/locale";
import { planStatusLabel, t } from "@/lib/admin/i18n";
import { DetailHeader } from "../../../../_components/DetailHeader";
import { PlanViewer } from "@/app/plan/PlanViewer";

/**
 * Admin view of a subscriber's meal plan — the real PlanViewer (read-only: no
 * regenerate / add-member / PDF export), not a raw JSON dump. Plan data describes a
 * household's meals + health needs, so opening it records a `view_plan_data` audit
 * event (PDPL).
 */
export default async function AdminPlanViewPage({
  params,
}: {
  params: Promise<{ userId: string; planId: string }>;
}) {
  const admin = await requireAdmin();
  const { userId, planId } = await params;

  const plan = await loadPlanForInspect(userId, planId);
  if (!plan) notFound();

  const locale = await getAdminLocale();

  await logAdminAccess({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: "view_plan_data",
    detail: { planId },
  });

  const parsed = MealPlanSchema.safeParse(plan.planData);

  return (
    <>
      <DetailHeader
        backHref={`/admin/subscribers/${userId}`}
        backLabel={t("back_to_subscriber", locale)}
        name={`${t("plan_data_title", locale)} — ${planStatusLabel(plan.status, locale)}`}
        locale={locale}
        localeNext={`/admin/subscribers/${userId}/plan/${planId}`}
      />

      <main className="container-app space-y-4 py-6">
        <p className="flex items-center gap-2 rounded-lg border border-brand-warm-orange/30 bg-brand-warm-orange/10 px-3 py-2 adm-body text-brand-ink">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          {t("plan_data_logged_note", locale)}
        </p>

        <p className="adm-body text-brand-ink-muted">
          {fmtDate(plan.generatedAt ?? plan.createdAt, locale)}
        </p>

        {parsed.success ? (
          // The plan content is Arabic — force RTL so it reads correctly even when
          // the admin chrome is in English. PlanViewer is read-only with no export.
          <div dir="rtl">
            <PlanViewer
              plan={parsed.data}
              planId={plan.id}
              readOnly
              hideExport
            />
          </div>
        ) : (
          <div className="rounded-xl border border-brand-ink/10 bg-surface-elevated p-10 text-center adm-body text-brand-ink-muted">
            {t("plan_no_data", locale)}
          </div>
        )}
      </main>
    </>
  );
}
