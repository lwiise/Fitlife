import Link from "next/link";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { buildQuery } from "./searchParams";
import { LocaleToggle } from "./LocaleToggle";

/**
 * Admin chrome: product mark, nav tabs (Overview / Insights), an optional period
 * control (overview only), the ar/en toggle, and the signed-in admin identity.
 */
export function AdminTopBar({
  locale,
  activeNav,
  adminEmail,
  periodDays,
  baseParams,
}: {
  locale: AdminLocale;
  activeNav: "overview" | "insights";
  adminEmail: string | null;
  /** Provide both to show the period control (overview). */
  periodDays?: number;
  baseParams?: Record<string, string>;
}) {
  const initial = (adminEmail ?? "?").charAt(0).toUpperCase();
  const localeNext = activeNav === "insights" ? "/admin/insights" : "/admin";

  return (
    <header className="border-b border-brand-ink/10 bg-surface-elevated">
      <div className="container-app flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
        <Link href="/admin" className="flex min-h-11 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-brand-purple-900 text-sm font-extrabold text-white"
          >
            FL
          </span>
          <span className="font-bold text-brand-ink">{t("app_title", locale)}</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label={t("nav_label", locale)}>
          <NavTab
            href="/admin"
            label={t("nav_overview", locale)}
            active={activeNav === "overview"}
          />
          {/* Insights is temporarily hidden from the admin panel. To re-enable,
              restore this tab and flip INSIGHTS_HIDDEN in admin/insights/page.tsx. */}
        </nav>

        <div className="ms-auto flex flex-wrap items-center gap-3">
          {periodDays != null && baseParams ? (
            <PeriodControl
              locale={locale}
              periodDays={periodDays}
              baseParams={baseParams}
            />
          ) : null}

          <LocaleToggle locale={locale} next={localeNext} />

          {adminEmail ? (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-full bg-brand-lavender text-sm font-bold text-brand-purple-900"
              >
                {initial}
              </span>
              <span dir="ltr" className="hidden text-sm text-brand-ink-muted sm:inline">
                {adminEmail}
              </span>
              <span dir="ltr" className="sr-only sm:hidden">
                {adminEmail}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function NavTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-purple-900/10 text-brand-purple-900"
          : "text-brand-ink-muted hover:text-brand-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function PeriodControl({
  locale,
  periodDays,
  baseParams,
}: {
  locale: AdminLocale;
  periodDays: number;
  baseParams: Record<string, string>;
}) {
  const options: Array<{ days: number; label: string }> = [
    { days: 30, label: t("period_30", locale) },
    { days: 90, label: t("period_90", locale) },
  ];
  return (
    <div
      className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
      role="group"
      aria-label={t("period_label", locale)}
    >
      {options.map((o) => {
        const active = o.days === periodDays;
        return (
          <Link
            key={o.days}
            href={buildQuery(baseParams, { days: o.days === 30 ? undefined : o.days })}
            aria-current={active ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
