import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadSubscriberHealth, type MemberHealth } from "@/lib/admin/detail";
import type { AdminLocale } from "@/lib/admin/format";
import { getAdminLocale } from "@/lib/admin/locale";
import { roleLabel, t } from "@/lib/admin/i18n";
import { DetailHeader } from "../../../_components/DetailHeader";
import { DetailCard, Field } from "../../../_components/DetailCard";

/**
 * Sensitive health detail — the "extra click" behind data minimization. Loading
 * this page records a distinct `view_health_detail` audit event (PDPL).
 */
export default async function SubscriberHealthPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const admin = await requireAdmin();
  const { userId } = await params;

  const health = await loadSubscriberHealth(userId);
  if (!health) notFound();

  const locale = await getAdminLocale();

  // PDPL: explicitly log the view of health/medical detail.
  await logAdminAccess({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: "view_health_detail",
    detail: { memberCount: health.members.length },
  });

  return (
    <>
      <DetailHeader
        backHref={`/admin/subscribers/${userId}`}
        backLabel={t("back_to_subscriber", locale)}
        name={`${health.displayName ?? "—"} — ${t("health_title", locale)}`}
        locale={locale}
        localeNext={`/admin/subscribers/${userId}/health`}
      />

      <main className="container-app space-y-4 py-6">
        <p className="flex items-center gap-2 rounded-lg border border-brand-warm-orange/30 bg-brand-warm-orange/10 px-3 py-2 adm-body text-brand-ink">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          {t("health_logged_note", locale)}
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {health.members.map((m) => (
            <MemberHealthCard key={m.id} member={m} locale={locale} />
          ))}
        </div>
      </main>
    </>
  );
}

function MemberHealthCard({
  member,
  locale,
}: {
  member: MemberHealth;
  locale: AdminLocale;
}) {
  const conditions = member.medicalConditions;
  const allergies = listToStrings(member.allergies);
  const dislikes = listToStrings(member.dislikes);
  const yn = (v: boolean | null) =>
    v == null ? "—" : v ? t("yes", locale) : t("no", locale);

  return (
    <DetailCard title={`${member.name} — ${roleLabel(member.role, locale)}`}>
      <dl className="grid gap-x-6 sm:grid-cols-2">
        {member.id === "mom" ? (
          <Field label={t("field_pregnant", locale)} value={yn(member.isPregnant)} />
        ) : null}
        <Field
          label={t("field_trimester", locale)}
          value={member.trimester ?? "—"}
        />
        <Field
          label={t("field_postpartum", locale)}
          value={member.monthsPostpartum ?? "—"}
        />
        <Field
          label={t("field_high_risk", locale)}
          value={yn(member.highRiskPregnancy)}
        />
        <Field
          label={t("field_consulted", locale)}
          value={yn(member.consultedDoctor)}
        />
      </dl>

      <div className="mt-2 space-y-2 border-t border-brand-ink/10 pt-2">
        <ListField label={t("field_conditions", locale)} items={conditions} locale={locale} />
        <ListField label={t("field_allergies", locale)} items={allergies} locale={locale} />
        <ListField label={t("field_dislikes", locale)} items={dislikes} locale={locale} />
      </div>
    </DetailCard>
  );
}

function ListField({
  label,
  items,
  locale,
}: {
  label: string;
  items: string[];
  locale: AdminLocale;
}) {
  return (
    <div>
      <p className="adm-label text-brand-ink-muted">{label}</p>
      {items.length === 0 ? (
        <p className="adm-body text-brand-ink-muted">{t("none_listed", locale)}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="rounded-full bg-brand-surface px-2.5 py-0.5 adm-body text-brand-ink"
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** jsonb allergies/dislikes may be string[] or [{name_ar|name}] — normalize. */
function listToStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      return String(o.name_ar ?? o.name ?? o.label ?? JSON.stringify(item));
    }
    return String(item);
  });
}
