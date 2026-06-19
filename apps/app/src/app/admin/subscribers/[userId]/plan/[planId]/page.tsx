import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadPlanForInspect } from "@/lib/admin/detail";
import { fmtDate, fmtNumber } from "@/lib/admin/format";
import { getAdminLocale } from "@/lib/admin/locale";
import { planStatusLabel, t } from "@/lib/admin/i18n";
import { DetailHeader } from "../../../../_components/DetailHeader";

/**
 * Raw plan_data inspector. Plan data describes a household's meals/health needs,
 * so opening it records a `view_plan_data` audit event (PDPL).
 */
export default async function PlanInspectPage({
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

  const json = JSON.stringify(plan.planData ?? null, null, 2);

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
          {fmtDate(plan.generatedAt ?? plan.createdAt, locale)} ·{" "}
          <span dir="ltr" className="tabular-nums">
            {fmtNumber(json.length, locale)}
          </span>{" "}
          chars
        </p>

        <pre
          dir="ltr"
          className="max-h-[70vh] overflow-auto rounded-xl border border-brand-ink/10 bg-brand-ink/5 p-4 text-xs leading-relaxed text-brand-ink"
        >
          <code>{json}</code>
        </pre>
      </main>
    </>
  );
}
