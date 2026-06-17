import { Activity, CreditCard, Users } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtNumber } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";

/**
 * Relates the three audience numbers that otherwise sit far apart on the page:
 * total accounts → paying subscriptions → users active in the selected range.
 * One labelled lockup so the funnel relationship is legible at a glance.
 */
export function AudienceBar({
  total,
  activeSubs,
  activeUsers,
  locale,
}: {
  total: number;
  activeSubs: number;
  activeUsers: number;
  locale: AdminLocale;
}) {
  const stats = [
    { icon: Users, label: t("audience_total", locale), value: total },
    { icon: CreditCard, label: t("metric_active_subs", locale), value: activeSubs },
    { icon: Activity, label: t("kpi_active_users", locale), value: activeUsers },
  ];

  return (
    <section
      aria-label={t("audience_label", locale)}
      className="rounded-xl border border-brand-ink/10 bg-surface-elevated p-4"
    >
      <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {stats.map(({ icon: Icon, label, value }, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-surface text-brand-purple-900">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span
                dir="ltr"
                className="text-xl font-extrabold leading-none tabular-nums text-brand-ink"
              >
                {fmtNumber(value, locale)}
              </span>
              <span className="text-xs text-brand-ink/70">{label}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-brand-ink/70">{t("audience_caption", locale)}</p>
    </section>
  );
}
